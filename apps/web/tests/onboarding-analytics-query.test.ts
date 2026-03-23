import { beforeEach, describe, expect, test, vi } from "vitest";
import { getOnboardingAnalyticsSummary } from "@/lib/onboarding/analytics-query";

const adminFromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  adminFromMock.mockReset();
});

describe("onboarding analytics query", () => {
  test("builds funnel totals and timing from onboarding sessions", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "store_onboarding_sessions") {
        return {
          select: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                order: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      {
                        id: "session-1",
                        store_id: "store-1",
                        status: "completed",
                        started_at: "2026-03-19T12:00:00.000Z",
                        completed_at: "2026-03-19T12:10:00.000Z",
                        first_product_completed_at: "2026-03-19T12:02:00.000Z",
                        generation_requested_at: "2026-03-19T12:03:00.000Z",
                        generation_completed_at: "2026-03-19T12:05:00.000Z",
                        generation_failed_at: null,
                        reveal_viewed_at: "2026-03-19T12:06:00.000Z",
                        preview_home_viewed_at: "2026-03-19T12:06:00.000Z",
                        preview_products_viewed_at: "2026-03-19T12:07:00.000Z",
                        preview_about_viewed_at: null,
                        studio_handoff_at: "2026-03-19T12:08:00.000Z",
                        catalog_handoff_at: null,
                        payments_handoff_at: "2026-03-19T12:09:00.000Z",
                        launch_checklist_handoff_at: "2026-03-19T12:09:30.000Z"
                      },
                      {
                        id: "session-2",
                        store_id: "store-2",
                        status: "generation_failed",
                        started_at: "2026-03-19T14:00:00.000Z",
                        completed_at: null,
                        first_product_completed_at: null,
                        generation_requested_at: "2026-03-19T14:03:00.000Z",
                        generation_completed_at: null,
                        generation_failed_at: "2026-03-19T14:04:00.000Z",
                        reveal_viewed_at: null,
                        preview_home_viewed_at: null,
                        preview_products_viewed_at: null,
                        preview_about_viewed_at: null,
                        studio_handoff_at: null,
                        catalog_handoff_at: null,
                        payments_handoff_at: null,
                        launch_checklist_handoff_at: null
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [
                  { id: "store-1", stripe_account_id: "acct_123" },
                  { id: "store-2", stripe_account_id: null }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const summary = await getOnboardingAnalyticsSummary("30d");

    expect(summary.totals.sessionsStarted).toBe(2);
    expect(summary.totals.firstProductCompleted).toBe(1);
    expect(summary.totals.generationSucceeded).toBe(1);
    expect(summary.totals.generationFailed).toBe(1);
    expect(summary.totals.revealViewed).toBe(1);
    expect(summary.totals.paymentsHandoffs).toBe(1);
    expect(summary.totals.paymentsConnected).toBe(1);
    expect(summary.totals.completed).toBe(1);
    expect(summary.timing.avgMinutesToGenerationSuccess).toBe(5);
    expect(summary.timing.avgMinutesToFirstPreview).toBe(6);
    expect(summary.funnel.find((step) => step.id === "payments_connected")?.count).toBe(1);
  });
});
