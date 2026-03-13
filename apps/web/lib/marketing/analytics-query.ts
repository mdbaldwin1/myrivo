import type { SupabaseClient } from "@supabase/supabase-js";

export type MarketingAnalyticsRange = "7d" | "30d" | "90d";

type MarketingSessionRow = {
  id: string;
  entry_path: string | null;
  landing_page_key: string | null;
  first_seen_at: string;
  experiment_assignments_json: Record<string, string> | null;
};

type MarketingEventRow = {
  event_type: string;
  occurred_at: string;
  path: string | null;
  page_key: string | null;
  section_key: string | null;
  cta_key: string | null;
  cta_label: string | null;
  value_json: Record<string, unknown> | null;
  experiment_assignments_json: Record<string, string> | null;
  session_id: string;
};

export type MarketingAnalyticsSummary = {
  filters: {
    range: MarketingAnalyticsRange;
    from: string;
    to: string;
  };
  headline: {
    sessions: number;
    pageViews: number;
    ctaClicks: number;
    signupStarts: number;
    signupCompletions: number;
    demoRequestStarts: number;
    signupStartRate: number;
    signupCompletionRate: number;
  };
  daily: Array<{
    date: string;
    sessions: number;
    pageViews: number;
    signupStarts: number;
    signupCompletions: number;
  }>;
  byPage: Array<{
    pageKey: string;
    entryPath: string | null;
    sessions: number;
    pageViews: number;
    ctaClicks: number;
    signupStarts: number;
    signupCompletions: number;
    demoRequestStarts: number;
  }>;
  byCta: Array<{
    pageKey: string | null;
    sectionKey: string | null;
    ctaKey: string;
    ctaLabel: string | null;
    clicks: number;
    signupStarts: number;
    signupCompletions: number;
    demoRequestStarts: number;
  }>;
  experiments: Array<{
    experimentKey: string;
    variantKey: string;
    sessions: number;
    signupStarts: number;
    signupCompletions: number;
  }>;
};

function getWindowDays(range: MarketingAnalyticsRange) {
  if (range === "7d") {
    return 7;
  }
  if (range === "30d") {
    return 30;
  }
  return 90;
}

function normalizeRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

export async function getMarketingAnalyticsSummary(input: {
  supabase: SupabaseClient;
  range?: MarketingAnalyticsRange;
  now?: Date;
}) {
  const range = input.range ?? "30d";
  const now = input.now ?? new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - (getWindowDays(range) - 1));
  from.setHours(0, 0, 0, 0);

  const [{ data: sessions, error: sessionsError }, { data: events, error: eventsError }] = await Promise.all([
    input.supabase
      .from("marketing_sessions")
      .select("id,entry_path,landing_page_key,first_seen_at,experiment_assignments_json")
      .gte("first_seen_at", from.toISOString())
      .lte("first_seen_at", now.toISOString())
      .order("first_seen_at", { ascending: true })
      .returns<MarketingSessionRow[]>(),
    input.supabase
      .from("marketing_events")
      .select("event_type,occurred_at,path,page_key,section_key,cta_key,cta_label,value_json,experiment_assignments_json,session_id")
      .gte("occurred_at", from.toISOString())
      .lte("occurred_at", now.toISOString())
      .order("occurred_at", { ascending: true })
      .returns<MarketingEventRow[]>()
  ]);

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }
  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const daily = new Map<
    string,
    {
      sessions: Set<string>;
      pageViews: number;
      signupStarts: number;
      signupCompletions: number;
    }
  >();
  const byPage = new Map<
    string,
    {
      pageKey: string;
      entryPath: string | null;
      sessions: Set<string>;
      pageViews: number;
      ctaClicks: number;
      signupStarts: number;
      signupCompletions: number;
      demoRequestStarts: number;
    }
  >();
  const byCta = new Map<
    string,
    {
      pageKey: string | null;
      sectionKey: string | null;
      ctaKey: string;
      ctaLabel: string | null;
      clicks: number;
      signupStarts: number;
      signupCompletions: number;
      demoRequestStarts: number;
    }
  >();
  const experiments = new Map<
    string,
    {
      experimentKey: string;
      variantKey: string;
      sessions: Set<string>;
      signupStarts: number;
      signupCompletions: number;
    }
  >();

  const sessionsById = new Map(sessions.map((session) => [session.id, session]));

  for (const session of sessions) {
    const date = session.first_seen_at.slice(0, 10);
    const day = daily.get(date) ?? { sessions: new Set<string>(), pageViews: 0, signupStarts: 0, signupCompletions: 0 };
    day.sessions.add(session.id);
    daily.set(date, day);

    const pageKey = session.landing_page_key ?? "unknown";
    const page = byPage.get(pageKey) ?? {
      pageKey,
      entryPath: session.entry_path,
      sessions: new Set<string>(),
      pageViews: 0,
      ctaClicks: 0,
      signupStarts: 0,
      signupCompletions: 0,
      demoRequestStarts: 0
    };
    page.sessions.add(session.id);
    if (!page.entryPath && session.entry_path) {
      page.entryPath = session.entry_path;
    }
    byPage.set(pageKey, page);

    for (const [experimentKey, variantKey] of Object.entries(session.experiment_assignments_json ?? {})) {
      const bucketKey = `${experimentKey}:${variantKey}`;
      const experiment = experiments.get(bucketKey) ?? {
        experimentKey,
        variantKey,
        sessions: new Set<string>(),
        signupStarts: 0,
        signupCompletions: 0
      };
      experiment.sessions.add(session.id);
      experiments.set(bucketKey, experiment);
    }
  }

  let pageViews = 0;
  let ctaClicks = 0;
  let signupStarts = 0;
  let signupCompletions = 0;
  let demoRequestStarts = 0;

  for (const event of events) {
    const session = sessionsById.get(event.session_id);
    const pageKey = event.page_key ?? session?.landing_page_key ?? "unknown";
    const date = event.occurred_at.slice(0, 10);
    const day = daily.get(date) ?? { sessions: new Set<string>(), pageViews: 0, signupStarts: 0, signupCompletions: 0 };
    const page = byPage.get(pageKey) ?? {
      pageKey,
      entryPath: session?.entry_path ?? event.path ?? null,
      sessions: new Set<string>(),
      pageViews: 0,
      ctaClicks: 0,
      signupStarts: 0,
      signupCompletions: 0,
      demoRequestStarts: 0
    };
    page.sessions.add(event.session_id);

    if (event.event_type === "page_view") {
      pageViews += 1;
      day.pageViews += 1;
      page.pageViews += 1;
    }

    if (event.cta_key) {
      const ctaKey = `${pageKey}:${event.section_key ?? "unknown"}:${event.cta_key}`;
      const cta = byCta.get(ctaKey) ?? {
        pageKey: event.page_key ?? null,
        sectionKey: event.section_key ?? null,
        ctaKey: event.cta_key,
        ctaLabel: event.cta_label ?? null,
        clicks: 0,
        signupStarts: 0,
        signupCompletions: 0,
        demoRequestStarts: 0
      };

      if (event.event_type === "cta_click") {
        ctaClicks += 1;
        page.ctaClicks += 1;
        cta.clicks += 1;
      }
      if (event.event_type === "signup_started") {
        signupStarts += 1;
        day.signupStarts += 1;
        page.signupStarts += 1;
        cta.signupStarts += 1;
      }
      if (event.event_type === "signup_completed") {
        signupCompletions += 1;
        day.signupCompletions += 1;
        page.signupCompletions += 1;
        cta.signupCompletions += 1;
      }
      if (event.event_type === "demo_request_started") {
        demoRequestStarts += 1;
        page.demoRequestStarts += 1;
        cta.demoRequestStarts += 1;
      }

      byCta.set(ctaKey, cta);
    } else {
      if (event.event_type === "signup_started") {
        signupStarts += 1;
        day.signupStarts += 1;
        page.signupStarts += 1;
      }
      if (event.event_type === "signup_completed") {
        signupCompletions += 1;
        day.signupCompletions += 1;
        page.signupCompletions += 1;
      }
      if (event.event_type === "demo_request_started") {
        demoRequestStarts += 1;
        page.demoRequestStarts += 1;
      }
    }

    for (const [experimentKey, variantKey] of Object.entries(event.experiment_assignments_json ?? {})) {
      const bucketKey = `${experimentKey}:${variantKey}`;
      const experiment = experiments.get(bucketKey) ?? {
        experimentKey,
        variantKey,
        sessions: new Set<string>(),
        signupStarts: 0,
        signupCompletions: 0
      };
      experiment.sessions.add(event.session_id);
      if (event.event_type === "signup_started") {
        experiment.signupStarts += 1;
      }
      if (event.event_type === "signup_completed") {
        experiment.signupCompletions += 1;
      }
      experiments.set(bucketKey, experiment);
    }

    daily.set(date, day);
    byPage.set(pageKey, page);
  }

  return {
    filters: {
      range,
      from: from.toISOString(),
      to: now.toISOString()
    },
    headline: {
      sessions: sessions.length,
      pageViews,
      ctaClicks,
      signupStarts,
      signupCompletions,
      demoRequestStarts,
      signupStartRate: normalizeRate(signupStarts, sessions.length),
      signupCompletionRate: normalizeRate(signupCompletions, signupStarts)
    },
    daily: Array.from(daily.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({
        date,
        sessions: value.sessions.size,
        pageViews: value.pageViews,
        signupStarts: value.signupStarts,
        signupCompletions: value.signupCompletions
      })),
    byPage: Array.from(byPage.values())
      .map((entry) => ({
        ...entry,
        sessions: entry.sessions.size
      }))
      .sort((a, b) => b.signupStarts - a.signupStarts || b.sessions - a.sessions),
    byCta: Array.from(byCta.values()).sort((a, b) => b.signupStarts - a.signupStarts || b.clicks - a.clicks),
    experiments: Array.from(experiments.values())
      .map((entry) => ({
        ...entry,
        sessions: entry.sessions.size
      }))
      .sort((a, b) => b.signupStarts - a.signupStarts || b.sessions - a.sessions)
  } satisfies MarketingAnalyticsSummary;
}
