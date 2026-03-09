import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { summarizePendingQueueLatency } from "@/lib/reviews/health";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const sinceIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: submissionsLast7d, error: submissionsError },
    { count: approvalsLast7d, error: approvalsError },
    { count: rejectionsLast7d, error: rejectionsError },
    { count: lowStarLast7d, error: lowStarError },
    { count: pendingQueueDepth, error: pendingDepthError },
    { data: pendingRows, error: pendingRowsError },
    { count: uploadFailuresLast7d, error: uploadFailuresError },
    { data: recentUploadFailures, error: recentFailuresError }
  ] = await Promise.all([
    admin.from("reviews").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "published").gte("updated_at", sinceIso),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "rejected").gte("updated_at", sinceIso),
    admin.from("reviews").select("id", { count: "exact", head: true }).lte("rating", 2).gte("created_at", sinceIso),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("reviews").select("id,created_at").eq("status", "pending").limit(500).returns<Array<{ id: string; created_at: string }>>(),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("entity", "review_pipeline")
      .eq("action", "upload_error")
      .gte("created_at", sinceIso),
    admin
      .from("audit_events")
      .select("id,store_id,created_at,metadata")
      .eq("entity", "review_pipeline")
      .eq("action", "upload_error")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Array<{ id: string; store_id: string | null; created_at: string; metadata: Record<string, unknown> | null }>>()
  ]);

  const aggregateError =
    submissionsError ?? approvalsError ?? rejectionsError ?? lowStarError ?? pendingDepthError ?? pendingRowsError ?? uploadFailuresError ?? recentFailuresError;

  if (aggregateError) {
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  const latency = summarizePendingQueueLatency((pendingRows ?? []).map((row) => row.created_at), now);

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    windowDays: 7,
    summary: {
      submissionsLast7d: submissionsLast7d ?? 0,
      approvalsLast7d: approvalsLast7d ?? 0,
      rejectionsLast7d: rejectionsLast7d ?? 0,
      lowStarLast7d: lowStarLast7d ?? 0,
      pendingQueueDepth: pendingQueueDepth ?? 0,
      pendingAvgAgeHours: latency.pendingAvgAgeHours,
      pendingOldestAgeHours: latency.pendingOldestAgeHours,
      uploadFailuresLast7d: uploadFailuresLast7d ?? 0
    },
    recentUploadFailures: (recentUploadFailures ?? []).map((row) => ({
      id: row.id,
      storeId: row.store_id,
      createdAt: row.created_at,
      stage: (row.metadata?.stage as string | undefined) ?? "unknown",
      reason: (row.metadata?.reason as string | undefined) ?? "unknown",
      message: (row.metadata?.message as string | undefined) ?? null
    }))
  });
}
