import { NextRequest, NextResponse } from "next/server";
import { resolveMarketingEmailComplianceDefaults } from "@/lib/marketing-email/compliance";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SubscriberRow = {
  id: string;
  email: string;
  status: "subscribed" | "unsubscribed";
  message_type: "marketing";
  source: string;
  metadata_json: Record<string, unknown>;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user }
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, searchParams.get("storeSlug"), "staff");
  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const format = searchParams.get("format");
  const statusFilter = searchParams.get("status");
  const allowedStatus = statusFilter === "subscribed" || statusFilter === "unsubscribed" ? statusFilter : null;

  let query = supabase
    .from("store_email_subscribers")
    .select("id,email,status,source,metadata_json,subscribed_at,unsubscribed_at,created_at")
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  if (allowedStatus) {
    query = query.eq("status", allowedStatus);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const subscribers = ((data ?? []) as Omit<SubscriberRow, "message_type">[]).map((row) => ({
    ...row,
    message_type: "marketing" as const
  }));

  if (format === "csv") {
    const header = "email,message_type,status,source,subscribed_at,unsubscribed_at,created_at";
    const rows = subscribers.map((row) =>
      [
        row.email,
        row.message_type,
        row.status,
        row.source,
        row.subscribed_at,
        row.unsubscribed_at ?? "",
        row.created_at
      ]
        .map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"email-subscribers-${bundle.store.slug}.csv\"`
      }
    });
  }

  return NextResponse.json({
    subscribers: subscribers.map((row) => ({
      ...row,
      consent_source: typeof row.metadata_json.consent_source === "string" ? row.metadata_json.consent_source : row.source,
      consent_location: typeof row.metadata_json.consent_location === "string" ? row.metadata_json.consent_location : null,
      consent_captured_at:
        typeof row.metadata_json.consent_captured_at === "string" ? row.metadata_json.consent_captured_at : row.subscribed_at,
      suppression_reason:
        typeof row.metadata_json.suppression_reason === "string" ? row.metadata_json.suppression_reason : null,
      suppression_recorded_at:
        typeof row.metadata_json.suppression_recorded_at === "string" ? row.metadata_json.suppression_recorded_at : row.unsubscribed_at
    })),
    summary: {
      total: subscribers.length,
      subscribed: subscribers.filter((entry) => entry.status === "subscribed").length,
      unsubscribed: subscribers.filter((entry) => entry.status === "unsubscribed").length,
      messageType: "marketing"
    },
    compliance: resolveMarketingEmailComplianceDefaults(bundle.store, bundle.settings)
  });
}
