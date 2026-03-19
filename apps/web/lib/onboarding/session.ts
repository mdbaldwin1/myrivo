import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createDefaultOnboardingAnswers,
  getNextOnboardingWorkflowStep,
  isOnboardingSessionStatus,
  isOnboardingWorkflowStepId,
  normalizeOnboardingAnswers,
  type OnboardingAnswers,
  type OnboardingSessionStatus,
  type OnboardingWorkflowStepId
} from "@/lib/onboarding/workflow";

type AccessibleStoreRow = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
};

type MembershipRow = {
  role: "owner" | "admin" | "staff" | "customer";
  status: "active" | "invited" | "suspended";
};

type SessionRow = {
  id: string;
  store_id: string;
  owner_user_id: string;
  status: OnboardingSessionStatus;
  current_step: OnboardingWorkflowStepId | null;
  last_completed_step: OnboardingWorkflowStepId | null;
  first_product_id: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  last_seen_at: string | null;
  generation_requested_at: string | null;
  generation_completed_at: string | null;
  generation_failed_at: string | null;
  generation_error_code: string | null;
  generation_error_message: string | null;
};

type AnswersRow = {
  store_id: string;
  session_id: string;
  answers_json: Record<string, unknown> | null;
  normalized_answers_json: Record<string, unknown> | null;
  step_progress_json: Record<string, unknown> | null;
  updated_at: string;
};

export type OnboardingSessionBundle = {
  store: {
    id: string;
    name: string;
    slug: string;
  };
  session: Omit<SessionRow, "current_step" | "last_completed_step"> & {
    current_step: OnboardingWorkflowStepId | null;
    last_completed_step: OnboardingWorkflowStepId | null;
  };
  answers: OnboardingAnswers;
  stepProgress: Record<string, unknown>;
};

async function loadAccessibleStore(userId: string, storeId: string) {
  const admin = createSupabaseAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,name,slug,owner_user_id")
    .eq("id", storeId)
    .maybeSingle<AccessibleStoreRow>();

  if (storeError) {
    throw new Error(storeError.message);
  }

  if (!store) {
    return null;
  }

  if (store.owner_user_id === userId) {
    return store;
  }

  const { data: membership, error: membershipError } = await admin
    .from("store_memberships")
    .select("role,status")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<MembershipRow>();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership || membership.role === "customer") {
    return null;
  }

  return store;
}

async function loadAccessibleStoreBySlug(userId: string, storeSlug: string) {
  const admin = createSupabaseAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,name,slug,owner_user_id")
    .eq("slug", storeSlug)
    .maybeSingle<AccessibleStoreRow>();

  if (storeError) {
    throw new Error(storeError.message);
  }

  if (!store) {
    return null;
  }

  if (store.owner_user_id === userId) {
    return store;
  }

  const { data: membership, error: membershipError } = await admin
    .from("store_memberships")
    .select("role,status")
    .eq("store_id", store.id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<MembershipRow>();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership || membership.role === "customer") {
    return null;
  }

  return store;
}

async function loadLatestSession(storeId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("store_onboarding_sessions")
    .select(
      "id,store_id,owner_user_id,status,current_step,last_completed_step,first_product_id,started_at,updated_at,completed_at,last_seen_at,generation_requested_at,generation_completed_at,generation_failed_at,generation_error_code,generation_error_message"
    )
    .eq("store_id", storeId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<SessionRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function loadAnswers(storeId: string, sessionId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("store_onboarding_answers")
    .select("store_id,session_id,answers_json,normalized_answers_json,step_progress_json,updated_at")
    .eq("store_id", storeId)
    .eq("session_id", sessionId)
    .maybeSingle<AnswersRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function createOrResumeOnboardingSession(input: {
  storeId: string;
  ownerUserId: string;
  storeName: string;
}) {
  const existing = await loadLatestSession(input.storeId);
  if (existing) {
    const answers = await loadAnswers(input.storeId, existing.id);
    if (!answers) {
      const defaultAnswers = createDefaultOnboardingAnswers(input.storeName);
      const admin = createSupabaseAdminClient();
      await admin.from("store_onboarding_answers").upsert(
        {
          store_id: input.storeId,
          session_id: existing.id,
          answers_json: defaultAnswers,
          normalized_answers_json: defaultAnswers,
          step_progress_json: {}
        },
        { onConflict: "store_id,session_id" }
      );
    }
    return existing;
  }

  const admin = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("store_onboarding_sessions")
    .insert({
      store_id: input.storeId,
      owner_user_id: input.ownerUserId,
      status: "in_progress",
      current_step: getNextOnboardingWorkflowStep(null),
      last_completed_step: null
    })
    .select(
      "id,store_id,owner_user_id,status,current_step,last_completed_step,first_product_id,started_at,updated_at,completed_at,last_seen_at,generation_requested_at,generation_completed_at,generation_failed_at,generation_error_code,generation_error_message"
    )
    .single<SessionRow>();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Unable to create onboarding session.");
  }

  const defaultAnswers = createDefaultOnboardingAnswers(input.storeName);
  const { error: answersError } = await admin.from("store_onboarding_answers").insert({
    store_id: input.storeId,
    session_id: session.id,
    answers_json: defaultAnswers,
    normalized_answers_json: defaultAnswers,
    step_progress_json: {}
  });

  if (answersError) {
    throw new Error(answersError.message);
  }

  return session;
}

export async function getOnboardingSessionBundleForUser(userId: string, storeId: string): Promise<OnboardingSessionBundle | null> {
  const store = await loadAccessibleStore(userId, storeId);
  if (!store) {
    return null;
  }

  const session = await createOrResumeOnboardingSession({
    storeId: store.id,
    ownerUserId: store.owner_user_id,
    storeName: store.name
  });
  const answersRow = await loadAnswers(store.id, session.id);
  const answers = normalizeOnboardingAnswers(answersRow?.answers_json ?? {}, store.name);

  return {
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug
    },
    session: {
      ...session,
      current_step: isOnboardingWorkflowStepId(session.current_step) ? session.current_step : getNextOnboardingWorkflowStep(null),
      last_completed_step: isOnboardingWorkflowStepId(session.last_completed_step) ? session.last_completed_step : null,
      status: isOnboardingSessionStatus(session.status) ? session.status : "in_progress"
    },
    answers,
    stepProgress: (answersRow?.step_progress_json ?? {}) as Record<string, unknown>
  };
}

export async function getOnboardingSessionBundleForUserBySlug(userId: string, storeSlug: string): Promise<OnboardingSessionBundle | null> {
  const store = await loadAccessibleStoreBySlug(userId, storeSlug);
  if (!store) {
    return null;
  }

  const session = await createOrResumeOnboardingSession({
    storeId: store.id,
    ownerUserId: store.owner_user_id,
    storeName: store.name
  });
  const answersRow = await loadAnswers(store.id, session.id);
  const answers = normalizeOnboardingAnswers(answersRow?.answers_json ?? {}, store.name);

  return {
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug
    },
    session: {
      ...session,
      current_step: isOnboardingWorkflowStepId(session.current_step) ? session.current_step : getNextOnboardingWorkflowStep(null),
      last_completed_step: isOnboardingWorkflowStepId(session.last_completed_step) ? session.last_completed_step : null,
      status: isOnboardingSessionStatus(session.status) ? session.status : "in_progress"
    },
    answers,
    stepProgress: (answersRow?.step_progress_json ?? {}) as Record<string, unknown>
  };
}

export async function updateOnboardingSession(input: {
  sessionId: string;
  storeId: string;
  currentStep?: OnboardingWorkflowStepId;
  lastCompletedStep?: OnboardingWorkflowStepId | null;
  status?: OnboardingSessionStatus;
  firstProductId?: string | null;
  generationErrorCode?: string | null;
  generationErrorMessage?: string | null;
  generationRequestedAt?: string | null;
  generationCompletedAt?: string | null;
  generationFailedAt?: string | null;
  completedAt?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    last_seen_at: new Date().toISOString()
  };

  if (input.currentStep) {
    patch.current_step = input.currentStep;
  }
  if (input.lastCompletedStep !== undefined) {
    patch.last_completed_step = input.lastCompletedStep;
  }
  if (input.status) {
    patch.status = input.status;
  }
  if (input.firstProductId !== undefined) {
    patch.first_product_id = input.firstProductId;
  }
  if (input.generationErrorCode !== undefined) {
    patch.generation_error_code = input.generationErrorCode;
  }
  if (input.generationErrorMessage !== undefined) {
    patch.generation_error_message = input.generationErrorMessage;
  }
  if (input.generationRequestedAt !== undefined) {
    patch.generation_requested_at = input.generationRequestedAt;
  }
  if (input.generationCompletedAt !== undefined) {
    patch.generation_completed_at = input.generationCompletedAt;
  }
  if (input.generationFailedAt !== undefined) {
    patch.generation_failed_at = input.generationFailedAt;
  }
  if (input.completedAt !== undefined) {
    patch.completed_at = input.completedAt;
  }

  const { error } = await admin
    .from("store_onboarding_sessions")
    .update(patch)
    .eq("id", input.sessionId)
    .eq("store_id", input.storeId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateOnboardingAnswers(input: {
  sessionId: string;
  storeId: string;
  storeName: string;
  answers: OnboardingAnswers;
  stepProgress?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const normalized = normalizeOnboardingAnswers(input.answers, input.storeName);
  const { error } = await admin.from("store_onboarding_answers").upsert(
    {
      store_id: input.storeId,
      session_id: input.sessionId,
      answers_json: input.answers,
      normalized_answers_json: normalized,
      step_progress_json: input.stepProgress ?? {}
    },
    { onConflict: "store_id,session_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
