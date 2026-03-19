import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OnboardingAnalyticsRange = "7d" | "30d" | "90d";

type OnboardingSessionAnalyticsRow = {
  id: string;
  store_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  first_product_completed_at: string | null;
  generation_requested_at: string | null;
  generation_completed_at: string | null;
  generation_failed_at: string | null;
  reveal_viewed_at: string | null;
  preview_home_viewed_at: string | null;
  preview_products_viewed_at: string | null;
  preview_about_viewed_at: string | null;
  studio_handoff_at: string | null;
  catalog_handoff_at: string | null;
  payments_handoff_at: string | null;
  launch_checklist_handoff_at: string | null;
};

type StorePaymentRow = {
  id: string;
  stripe_account_id: string | null;
};

export type OnboardingAnalyticsSummary = {
  filters: {
    range: OnboardingAnalyticsRange;
    from: string;
    to: string;
  };
  totals: {
    sessionsStarted: number;
    firstProductCompleted: number;
    generationRequested: number;
    generationSucceeded: number;
    generationFailed: number;
    revealViewed: number;
    previewHomeViewed: number;
    previewProductsViewed: number;
    previewAboutViewed: number;
    studioHandoffs: number;
    catalogHandoffs: number;
    paymentsHandoffs: number;
    launchChecklistHandoffs: number;
    paymentsConnected: number;
    completed: number;
  };
  funnel: Array<{
    id: string;
    label: string;
    count: number;
    rate: number;
  }>;
  timing: {
    avgMinutesToFirstPreview: number | null;
    avgMinutesToGenerationSuccess: number | null;
  };
  daily: Array<{
    date: string;
    sessionsStarted: number;
    generationSucceeded: number;
    revealViewed: number;
    completed: number;
  }>;
};

function getWindowDays(range: OnboardingAnalyticsRange) {
  if (range === "7d") {
    return 7;
  }
  if (range === "30d") {
    return 30;
  }
  return 90;
}

function createDailyBucket(date: string) {
  return {
    date,
    sessionsStarted: 0,
    generationSucceeded: 0,
    revealViewed: 0,
    completed: 0
  };
}

function averageMinutes(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

export async function getOnboardingAnalyticsSummary(range: OnboardingAnalyticsRange): Promise<OnboardingAnalyticsSummary> {
  const admin = createSupabaseAdminClient();
  const days = getWindowDays(range);
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const fromIso = start.toISOString();
  const toIso = end.toISOString();

  const { data: sessions, error: sessionsError } = await admin
    .from("store_onboarding_sessions")
    .select(
      "id,store_id,status,started_at,completed_at,first_product_completed_at,generation_requested_at,generation_completed_at,generation_failed_at,reveal_viewed_at,preview_home_viewed_at,preview_products_viewed_at,preview_about_viewed_at,studio_handoff_at,catalog_handoff_at,payments_handoff_at,launch_checklist_handoff_at"
    )
    .gte("started_at", fromIso)
    .lte("started_at", toIso)
    .order("started_at", { ascending: true })
    .returns<OnboardingSessionAnalyticsRow[]>();

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const storeIds = Array.from(new Set((sessions ?? []).map((session) => session.store_id)));
  const { data: stores, error: storesError } = storeIds.length
    ? await admin.from("stores").select("id,stripe_account_id").in("id", storeIds).returns<StorePaymentRow[]>()
    : { data: [] as StorePaymentRow[], error: null };

  if (storesError) {
    throw new Error(storesError.message);
  }

  const stripeByStoreId = new Map((stores ?? []).map((store) => [store.id, store.stripe_account_id]));
  const daily = new Map<string, ReturnType<typeof createDailyBucket>>();
  const previewLagMinutes: number[] = [];
  const generationLagMinutes: number[] = [];

  const totals = {
    sessionsStarted: 0,
    firstProductCompleted: 0,
    generationRequested: 0,
    generationSucceeded: 0,
    generationFailed: 0,
    revealViewed: 0,
    previewHomeViewed: 0,
    previewProductsViewed: 0,
    previewAboutViewed: 0,
    studioHandoffs: 0,
    catalogHandoffs: 0,
    paymentsHandoffs: 0,
    launchChecklistHandoffs: 0,
    paymentsConnected: 0,
    completed: 0
  };

  for (const session of sessions ?? []) {
    totals.sessionsStarted += 1;
    const dayKey = new Date(session.started_at).toISOString().slice(0, 10);
    const day = daily.get(dayKey) ?? createDailyBucket(dayKey);
    day.sessionsStarted += 1;
    daily.set(dayKey, day);

    if (session.first_product_completed_at) {
      totals.firstProductCompleted += 1;
    }
    if (session.generation_requested_at) {
      totals.generationRequested += 1;
    }
    if (session.generation_completed_at) {
      totals.generationSucceeded += 1;
      day.generationSucceeded += 1;
      generationLagMinutes.push((new Date(session.generation_completed_at).getTime() - new Date(session.started_at).getTime()) / 60000);
    }
    if (session.generation_failed_at) {
      totals.generationFailed += 1;
    }
    if (session.reveal_viewed_at) {
      totals.revealViewed += 1;
      day.revealViewed += 1;
      previewLagMinutes.push((new Date(session.reveal_viewed_at).getTime() - new Date(session.started_at).getTime()) / 60000);
    }
    if (session.preview_home_viewed_at) {
      totals.previewHomeViewed += 1;
    }
    if (session.preview_products_viewed_at) {
      totals.previewProductsViewed += 1;
    }
    if (session.preview_about_viewed_at) {
      totals.previewAboutViewed += 1;
    }
    if (session.studio_handoff_at) {
      totals.studioHandoffs += 1;
    }
    if (session.catalog_handoff_at) {
      totals.catalogHandoffs += 1;
    }
    if (session.payments_handoff_at) {
      totals.paymentsHandoffs += 1;
      if (stripeByStoreId.get(session.store_id)) {
        totals.paymentsConnected += 1;
      }
    }
    if (session.launch_checklist_handoff_at) {
      totals.launchChecklistHandoffs += 1;
    }
    if (session.status === "completed" || session.completed_at) {
      totals.completed += 1;
      day.completed += 1;
    }
  }

  const base = totals.sessionsStarted || 1;

  return {
    filters: {
      range,
      from: fromIso,
      to: toIso
    },
    totals,
    funnel: [
      { id: "sessions_started", label: "Sessions started", count: totals.sessionsStarted, rate: totals.sessionsStarted / base },
      { id: "first_product_completed", label: "First product completed", count: totals.firstProductCompleted, rate: totals.firstProductCompleted / base },
      { id: "generation_succeeded", label: "Generation succeeded", count: totals.generationSucceeded, rate: totals.generationSucceeded / base },
      { id: "reveal_viewed", label: "Reveal viewed", count: totals.revealViewed, rate: totals.revealViewed / base },
      { id: "payments_handoff", label: "Payments handoff", count: totals.paymentsHandoffs, rate: totals.paymentsHandoffs / base },
      { id: "payments_connected", label: "Payments connected", count: totals.paymentsConnected, rate: totals.paymentsConnected / base },
      { id: "launch_checklist_handoff", label: "Launch checklist opened", count: totals.launchChecklistHandoffs, rate: totals.launchChecklistHandoffs / base },
      { id: "completed", label: "Onboarding completed", count: totals.completed, rate: totals.completed / base }
    ],
    timing: {
      avgMinutesToFirstPreview: averageMinutes(previewLagMinutes),
      avgMinutesToGenerationSuccess: averageMinutes(generationLagMinutes)
    },
    daily: Array.from(daily.values())
  };
}
