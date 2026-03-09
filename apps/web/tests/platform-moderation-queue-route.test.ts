import { beforeEach, describe, expect, test, vi } from "vitest";

type AuthContext = {
  context: { globalRole: "admin" | "support" | "user"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthContext>>();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  adminFromMock.mockReset();
});

describe("platform moderation queue route", () => {
  test("returns 403 when role is not allowed", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "user", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/moderation/queue/route");
    const response = await route.GET();
    expect(response.status).toBe(403);
  });

  test("returns moderation queue summary for support role", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    let reviewMediaCallCount = 0;

    adminFromMock.mockImplementation((table: string) => {
      if (table === "reviews") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      {
                        id: "review-1",
                        store_id: "store-1",
                        product_id: null,
                        reviewer_name: "A Customer",
                        reviewer_email: "customer@example.com",
                        rating: 4,
                        title: "Great",
                        body: "Nice product",
                        created_at: "2026-03-08T00:00:00Z"
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            })),
            in: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [{ id: "review-1", store_id: "store-1" }],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "review_media") {
        reviewMediaCallCount += 1;
        if (reviewMediaCallCount === 1) {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    returns: vi.fn(async () => ({
                      data: [],
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [{ review_id: "review-1", id: "media-1" }],
                  error: null
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
                data: [{ id: "store-1", slug: "demo", name: "Demo Store" }],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "products") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              returns: vi.fn(async () => ({ data: [], error: null }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/moderation/queue/route");
    const response = await route.GET();
    const payload = (await response.json()) as { summary: { pendingReviewsCount: number }; pendingReviews: Array<{ id: string; store: { slug: string } | null }> };

    expect(response.status).toBe(200);
    expect(payload.summary.pendingReviewsCount).toBe(1);
    expect(payload.pendingReviews[0]?.id).toBe("review-1");
    expect(payload.pendingReviews[0]?.store?.slug).toBe("demo");
  });
});
