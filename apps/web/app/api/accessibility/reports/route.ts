import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { getAccessibilityReportDefaultPriority } from "@/lib/accessibility-reports";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const accessibilityReportSchema = z.object({
  reporterName: z.string().trim().max(160).optional().default(""),
  reporterEmail: z.string().trim().email().max(320),
  pageUrl: z.string().trim().max(1000).optional().default(""),
  featureArea: z.string().trim().min(2).max(160),
  issueSummary: z.string().trim().min(8).max(240),
  expectedBehavior: z.string().trim().max(4000).optional().default(""),
  actualBehavior: z.string().trim().min(8).max(4000),
  assistiveTechnology: z.string().trim().max(200).optional().default(""),
  browser: z.string().trim().max(120).optional().default(""),
  device: z.string().trim().max(120).optional().default(""),
  blocksCriticalFlow: z.boolean().optional().default(false)
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = await checkRateLimit(request, {
    key: "accessibility-report",
    limit: 6,
    windowMs: 60_000
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parsed = await parseJsonRequest(request, accessibilityReportSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const supabase = createSupabaseAdminClient();
  const normalizedEmail = parsed.data.reporterEmail.trim().toLowerCase();
  const metadata = {
    user_agent: request.headers.get("user-agent"),
    referer: request.headers.get("referer")
  };

  const { data, error } = await supabase
    .from("accessibility_reports")
    .insert({
      reporter_name: parsed.data.reporterName.trim() || null,
      reporter_email: normalizedEmail,
      page_url: parsed.data.pageUrl.trim() || null,
      feature_area: parsed.data.featureArea.trim(),
      issue_summary: parsed.data.issueSummary.trim(),
      expected_behavior: parsed.data.expectedBehavior.trim() || null,
      actual_behavior: parsed.data.actualBehavior.trim(),
      assistive_technology: parsed.data.assistiveTechnology.trim() || null,
      browser: parsed.data.browser.trim() || null,
      device: parsed.data.device.trim() || null,
      blocks_critical_flow: parsed.data.blocksCriticalFlow,
      priority: getAccessibilityReportDefaultPriority(parsed.data.blocksCriticalFlow),
      source: "public_form",
      metadata_json: metadata
    })
    .select("id,priority")
    .single<{ id: string; priority: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    action: "create",
    entity: "accessibility_report",
    entityId: data?.id ?? null,
    metadata: {
      reporter_email: normalizedEmail,
      feature_area: parsed.data.featureArea.trim(),
      priority: data?.priority ?? getAccessibilityReportDefaultPriority(parsed.data.blocksCriticalFlow),
      blocks_critical_flow: parsed.data.blocksCriticalFlow,
      source: "public_form"
    }
  });

  return NextResponse.json({ success: true, reportId: data?.id ?? null });
}
