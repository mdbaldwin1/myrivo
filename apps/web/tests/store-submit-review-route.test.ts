import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn<(request: NextRequest) => Response | null>();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();
const logAuditEventMock = vi.fn();
const notifyOwnersStoreSubmittedForReviewMock = vi.fn();
const notifyPlatformAdminsStoreSubmittedForReviewMock = vi.fn();
const authGetUserMock = vi.fn();
const storesMaybeSingleMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...(args as [NextRequest]))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/notifications/owner-notifications", () => ({
  notifyOwnersStoreSubmittedForReview: (...args: unknown[]) => notifyOwnersStoreSubmittedForReviewMock(...args),
  notifyPlatformAdminsStoreSubmittedForReview: (...args: unknown[]) => notifyPlatformAdminsStoreSubmittedForReviewMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => authGetUserMock(...args)
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: (...args: unknown[]) => storesMaybeSingleMock(...args)
            }))
          }))
        }))
      }))
    }))
  }))
}));

beforeEach(() => {
  enforceTrustedOriginMock.mockReset();
  getOwnedStoreBundleForOptionalSlugMock.mockReset();
  logAuditEventMock.mockReset();
  notifyOwnersStoreSubmittedForReviewMock.mockReset();
  notifyPlatformAdminsStoreSubmittedForReviewMock.mockReset();
  authGetUserMock.mockReset();
  storesMaybeSingleMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("store submit-review route", () => {
  test("submits draft store for review", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: { id: "store-1", slug: "demo-store", name: "Demo Store", status: "draft" }
    });
    storesMaybeSingleMock.mockResolvedValue({
      data: { id: "store-1", name: "Demo Store", slug: "demo-store", status: "pending_review" },
      error: null
    });

    const route = await import("@/app/api/stores/current/submit-review/route");
    const request = new NextRequest("http://localhost:3000/api/stores/current/submit-review", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      store: { id: "store-1", status: "pending_review" }
    });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnersStoreSubmittedForReviewMock).toHaveBeenCalledTimes(1);
    expect(notifyPlatformAdminsStoreSubmittedForReviewMock).toHaveBeenCalledTimes(1);
  });

  test("returns conflict when store is not draft", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: { id: "store-1", slug: "demo-store", name: "Demo Store", status: "active" }
    });

    const route = await import("@/app/api/stores/current/submit-review/route");
    const request = new NextRequest("http://localhost:3000/api/stores/current/submit-review", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.POST(request);
    expect(response.status).toBe(409);
  });
});
