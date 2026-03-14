import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { logAuditEvent } from "@/lib/audit/log";
import type { AccessibilityReportRecord } from "@/lib/accessibility-reports";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateAccessibilityReportSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["new", "triaged", "in_progress", "resolved", "dismissed"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  ownerNotes: z.string().trim().max(4000).optional().default(""),
  remediationNotes: z.string().trim().max(4000).optional().default("")
});

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const admin = createSupabaseAdminClient();
  const [
    { data: reports, error: reportsError },
    { count: totalCount, error: totalError },
    { count: openCount, error: openError },
    { count: criticalCount, error: criticalError }
  ] = await Promise.all([
    admin
      .from("accessibility_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<AccessibilityReportRecord[]>(),
    admin.from("accessibility_reports").select("id", { count: "exact", head: true }),
    admin.from("accessibility_reports").select("id", { count: "exact", head: true }).in("status", ["new", "triaged", "in_progress"]),
    admin
      .from("accessibility_reports")
      .select("id", { count: "exact", head: true })
      .eq("priority", "critical")
      .in("status", ["new", "triaged", "in_progress"])
  ]);

  const aggregateError = reportsError ?? totalError ?? openError ?? criticalError;
  if (aggregateError) {
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    summary: {
      totalCount: totalCount ?? 0,
      openCount: openCount ?? 0,
      criticalOpenCount: criticalCount ?? 0
    },
    reports: reports ?? []
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const parsed = await parseJsonRequest(request, updateAccessibilityReportSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const admin = createSupabaseAdminClient();
  const updatePayload: Record<string, unknown> = {
    status: parsed.data.status,
    priority: parsed.data.priority,
    owner_notes: parsed.data.ownerNotes.trim() || null,
    remediation_notes: parsed.data.remediationNotes.trim() || null
  };

  if (parsed.data.status === "triaged") {
    updatePayload.triaged_at = new Date().toISOString();
  }

  if (parsed.data.status === "resolved" || parsed.data.status === "dismissed") {
    updatePayload.resolved_at = new Date().toISOString();
    updatePayload.resolved_by_user_id = auth.context?.userId ?? null;
  } else {
    updatePayload.resolved_at = null;
    updatePayload.resolved_by_user_id = null;
  }

  const { data, error } = await admin
    .from("accessibility_reports")
    .update(updatePayload)
    .eq("id", parsed.data.reportId)
    .select("*")
    .single<AccessibilityReportRecord>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    action: "update",
    entity: "accessibility_report",
    entityId: parsed.data.reportId,
    metadata: {
      status: parsed.data.status,
      priority: parsed.data.priority,
      actor_role: auth.context?.globalRole ?? "user"
    }
  });

  return NextResponse.json({ report: data });
}
