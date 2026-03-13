import { describe, expect, test, vi } from "vitest";
import { getMarketingAnalyticsSummary } from "@/lib/marketing/analytics-query";

function createQuery(data: unknown) {
  return {
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data, error: null })
  };
}

describe("marketing analytics query", () => {
  test("reduces sessions, conversion by page and CTA, and experiment snapshots", async () => {
    const sessions = [
      {
        id: "sess-1",
        entry_path: "/pricing?utm_source=instagram",
        landing_page_key: "pricing",
        first_seen_at: "2026-03-12T10:00:00.000Z",
        experiment_assignments_json: { homepage_primary_cta_copy: "create_account" }
      },
      {
        id: "sess-2",
        entry_path: "/",
        landing_page_key: "home",
        first_seen_at: "2026-03-12T12:00:00.000Z",
        experiment_assignments_json: { homepage_primary_cta_copy: "start_free" }
      }
    ];
    const events = [
      {
        event_type: "page_view",
        occurred_at: "2026-03-12T10:01:00.000Z",
        path: "/pricing?utm_source=instagram",
        page_key: "pricing",
        section_key: null,
        cta_key: null,
        cta_label: null,
        value_json: null,
        experiment_assignments_json: { homepage_primary_cta_copy: "create_account" },
        session_id: "sess-1"
      },
      {
        event_type: "cta_click",
        occurred_at: "2026-03-12T10:02:00.000Z",
        path: "/pricing?utm_source=instagram",
        page_key: "pricing",
        section_key: "hero",
        cta_key: "pricing_hero_start_free",
        cta_label: "Start free",
        value_json: null,
        experiment_assignments_json: { homepage_primary_cta_copy: "create_account" },
        session_id: "sess-1"
      },
      {
        event_type: "signup_started",
        occurred_at: "2026-03-12T10:03:00.000Z",
        path: "/signup?source=pricing",
        page_key: "pricing",
        section_key: "hero",
        cta_key: "pricing_hero_start_free",
        cta_label: "Start free",
        value_json: null,
        experiment_assignments_json: { homepage_primary_cta_copy: "create_account" },
        session_id: "sess-1"
      },
      {
        event_type: "signup_completed",
        occurred_at: "2026-03-12T10:05:00.000Z",
        path: "/signup?source=pricing",
        page_key: "pricing",
        section_key: "hero",
        cta_key: "pricing_hero_start_free",
        cta_label: "Start free",
        value_json: null,
        experiment_assignments_json: { homepage_primary_cta_copy: "create_account" },
        session_id: "sess-1"
      },
      {
        event_type: "page_view",
        occurred_at: "2026-03-12T12:01:00.000Z",
        path: "/",
        page_key: "home",
        section_key: null,
        cta_key: null,
        cta_label: null,
        value_json: null,
        experiment_assignments_json: { homepage_primary_cta_copy: "start_free" },
        session_id: "sess-2"
      }
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "marketing_sessions") {
          return {
            select: vi.fn(() => createQuery(sessions))
          };
        }

        if (table === "marketing_events") {
          return {
            select: vi.fn(() => createQuery(events))
          };
        }

        throw new Error(`Unexpected table ${table}`);
      })
    };

    const summary = await getMarketingAnalyticsSummary({
      supabase: supabase as never,
      range: "30d",
      now: new Date("2026-03-12T23:59:59.000Z")
    });

    expect(summary.headline.sessions).toBe(2);
    expect(summary.headline.pageViews).toBe(2);
    expect(summary.headline.ctaClicks).toBe(1);
    expect(summary.headline.signupStarts).toBe(1);
    expect(summary.headline.signupCompletions).toBe(1);
    expect(summary.headline.signupStartRate).toBe(0.5);
    expect(summary.headline.signupCompletionRate).toBe(1);
    expect(summary.byPage[0]).toMatchObject({
      pageKey: "pricing",
      sessions: 1,
      pageViews: 1,
      ctaClicks: 1,
      signupStarts: 1,
      signupCompletions: 1
    });
    expect(summary.byCta[0]).toMatchObject({
      ctaKey: "pricing_hero_start_free",
      clicks: 1,
      signupStarts: 1,
      signupCompletions: 1
    });
    expect(summary.experiments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          experimentKey: "homepage_primary_cta_copy",
          variantKey: "create_account",
          sessions: 1,
          signupStarts: 1,
          signupCompletions: 1
        }),
        expect.objectContaining({
          experimentKey: "homepage_primary_cta_copy",
          variantKey: "start_free",
          sessions: 1
        })
      ])
    );
  });
});
