import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const getOwnedStoreBundleForSlugMock = vi.fn();
const notifyCustomerReviewModeratedMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();
const logAuditEventMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args),
  getOwnedStoreBundleForSlug: (...args: unknown[]) => getOwnedStoreBundleForSlugMock(...args)
}));

vi.mock("@/lib/notifications/owner-notifications", () => ({
  notifyCustomerReviewModerated: (...args: unknown[]) => notifyCustomerReviewModeratedMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClientMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

beforeEach(() => {
  enforceTrustedOriginMock.mockReset();
  getOwnedStoreBundleMock.mockReset();
  getOwnedStoreBundleForSlugMock.mockReset();
  notifyCustomerReviewModeratedMock.mockReset();
  createSupabaseServerClientMock.mockReset();
  logAuditEventMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
});

describe("dashboard review moderation route", () => {
  test("requires reject reason", async () => {
    const route = await import("@/app/api/dashboard/reviews/[reviewId]/moderation/route");
    const request = new NextRequest("http://localhost:3000/api/dashboard/reviews/rev-1/moderation", {
      method: "PATCH",
      body: JSON.stringify({ action: "reject" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ reviewId: "9bc3e8a4-51df-4f11-866b-f2f0807294ab" }) });
    expect(response.status).toBe(400);
  });

  test("rejects sentiment-based reject reasons", async () => {
    const route = await import("@/app/api/dashboard/reviews/[reviewId]/moderation/route");
    const request = new NextRequest("http://localhost:3000/api/dashboard/reviews/rev-1/moderation", {
      method: "PATCH",
      body: JSON.stringify({ action: "reject", reason: "low rating" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ reviewId: "9bc3e8a4-51df-4f11-866b-f2f0807294ab" }) });
    expect(response.status).toBe(400);
  });

  test("rejects invalid moderation transition", async () => {
    const reviewsSelectMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              id: "review-1",
              status: "published",
              store_id: "store-1",
              reviewer_user_id: null,
              metadata: {}
            },
            error: null
          }))
        }))
      }))
    }));

    const reviewsUpdateMock = vi.fn();

    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "owner-1" } } })) },
      from: vi.fn((table: string) => {
        if (table !== "reviews") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: reviewsSelectMock,
          update: reviewsUpdateMock
        };
      })
    });

    getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1", slug: "demo" }, role: "owner" });

    const route = await import("@/app/api/dashboard/reviews/[reviewId]/moderation/route");
    const request = new NextRequest("http://localhost:3000/api/dashboard/reviews/rev-1/moderation", {
      method: "PATCH",
      body: JSON.stringify({ action: "publish" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ reviewId: "9bc3e8a4-51df-4f11-866b-f2f0807294ab" }) });
    expect(response.status).toBe(409);
    expect(reviewsUpdateMock).not.toHaveBeenCalled();
  });

  test("writes an audit event after successful moderation", async () => {
    const updateSelectSingleMock = vi.fn(async () => ({
      data: {
        id: "review-1",
        store_id: "store-1",
        product_id: null,
        review_type: "store",
        status: "rejected",
        moderation_reason: "Contains abusive language",
        published_at: null,
        updated_at: "2026-03-13T12:00:00Z"
      },
      error: null
    }));

    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "owner-1" } } })) },
      from: vi.fn((table: string) => {
        if (table !== "reviews") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "review-1",
                    status: "published",
                    store_id: "store-1",
                    reviewer_user_id: null,
                    metadata: {}
                  },
                  error: null
                }))
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: updateSelectSingleMock
                }))
              }))
            }))
          }))
        };
      })
    });

    getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1", slug: "demo" }, role: "owner" });

    const route = await import("@/app/api/dashboard/reviews/[reviewId]/moderation/route");
    const request = new NextRequest("http://localhost:3000/api/dashboard/reviews/rev-1/moderation", {
      method: "PATCH",
      body: JSON.stringify({ action: "reject", reason: "Contains abusive language" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ reviewId: "9bc3e8a4-51df-4f11-866b-f2f0807294ab" }) });
    expect(response.status).toBe(200);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
