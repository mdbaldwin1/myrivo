import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OnboardingGenerationRunRecord = {
  id: string;
  store_id: string;
  session_id: string;
  status: "pending" | "running" | "succeeded" | "failed" | "partially_applied";
  provider: string | null;
  model: string | null;
};

export async function createOnboardingGenerationRun(input: {
  storeId: string;
  sessionId: string;
  provider: string;
  model: string;
  inputJson: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("store_onboarding_generation_runs")
    .insert({
      store_id: input.storeId,
      session_id: input.sessionId,
      status: "running",
      provider: input.provider,
      model: input.model,
      input_json: input.inputJson,
      started_at: now
    })
    .select("id,store_id,session_id,status,provider,model")
    .single<OnboardingGenerationRunRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create onboarding generation run.");
  }

  return data;
}

export async function updateOnboardingGenerationRun(input: {
  runId: string;
  status: "running" | "succeeded" | "failed" | "partially_applied";
  outputJson?: Record<string, unknown>;
  appliedSnapshotJson?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    status: input.status
  };

  if (input.outputJson !== undefined) {
    patch.output_json = input.outputJson;
  }
  if (input.appliedSnapshotJson !== undefined) {
    patch.applied_snapshot_json = input.appliedSnapshotJson;
  }
  if (input.errorCode !== undefined) {
    patch.error_code = input.errorCode;
  }
  if (input.errorMessage !== undefined) {
    patch.error_message = input.errorMessage;
  }
  if (input.status === "succeeded" || input.status === "failed" || input.status === "partially_applied") {
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await admin.from("store_onboarding_generation_runs").update(patch).eq("id", input.runId);
  if (error) {
    throw new Error(error.message);
  }
}
