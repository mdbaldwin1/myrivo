import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const getOwnedStoreBundleForSlugMock = vi.fn();
const notifyCustomerReviewRespondedMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args),
  getOwnedStoreBundleForSlug: (...args: unknown[]) => getOwnedStoreBundleForSlugMock(...args)
}));

vi.mock("@/lib/notifications/owner-notifications", () => ({
  notifyCustomerReviewResponded: (...args: unknown[]) => notifyCustomerReviewRespondedMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClientMock(...args)
}));

beforeEach(() => {
  enforceTrustedOriginMock.mockReset();
  getOwnedStoreBundleMock.mockReset();
  getOwnedStoreBundleForSlugMock.mockReset();
  notifyCustomerReviewRespondedMock.mockReset();
  createSupabaseServerClientMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1", slug: "demo" }, role: "owner" });
  getOwnedStoreBundleForSlugMock.mockResolvedValue({ store: { id: "store-1", slug: "demo" }, role: "owner" });
});

describe("dashboard review response route", () => {
  test("blocks response updates for non-published reviews", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "owner-1" } } })) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "review-1", status: "pending", store_id: "store-1", reviewer_user_id: null },
                error: null
              }))
            }))
          }))
        }))
      }))
    });

    const route = await import("@/app/api/dashboard/reviews/[reviewId]/response/route");
    const request = new NextRequest("http://localhost:3000/api/dashboard/reviews/rev-1/response", {
      method: "PUT",
      body: JSON.stringify({ body: "Thanks for your feedback", storeSlug: "demo" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PUT(request, { params: Promise.resolve({ reviewId: "9bc3e8a4-51df-4f11-866b-f2f0807294ab" }) });
    expect(response.status).toBe(409);
  });

  test("upserts owner response for published review", async () => {
    const upsertMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "resp-1",
            review_id: "review-1",
            store_id: "store-1",
            author_user_id: "owner-1",
            body: "Appreciate your review",
            created_at: "2026-03-09T12:00:00Z",
            updated_at: "2026-03-09T12:00:00Z"
          },
          error: null
        }))
      }))
    }));

    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "owner-1" } } })) },
      from: vi.fn((table: string) => {
        if (table === "reviews") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: "review-1", status: "published", store_id: "store-1", reviewer_user_id: null },
                    error: null
                  }))
                }))
              }))
            }))
          };
        }

        if (table === "review_responses") {
          return {
            upsert: upsertMock
          };
        }

        throw new Error(`Unexpected table ${table}`);
      })
    });

    const route = await import("@/app/api/dashboard/reviews/[reviewId]/response/route");
    const request = new NextRequest("http://localhost:3000/api/dashboard/reviews/rev-1/response", {
      method: "PUT",
      body: JSON.stringify({ body: "Appreciate your review", storeSlug: "demo" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PUT(request, { params: Promise.resolve({ reviewId: "9bc3e8a4-51df-4f11-866b-f2f0807294ab" }) });
    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
