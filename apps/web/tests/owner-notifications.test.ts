import { beforeEach, describe, expect, test, vi } from "vitest";

const dispatchNotificationMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/notifications/dispatcher", () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotificationMock(...args)
}));

vi.mock("@/lib/notifications/sender", () => ({
  resolvePlatformNotificationFromAddress: vi.fn(() => "orders@mailer.example.com"),
  resolvePlatformNotificationReplyTo: vi.fn(() => "support@example.com")
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

function mockRecipientLookup(recipientUserIds: string[], ownerUserId: string = "owner-1", storeSlug: string = "store-slug") {
  adminFromMock.mockImplementation((table: string) => {
    if (table === "store_memberships") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: recipientUserIds.map((userId) => ({ user_id: userId, role: "admin", status: "active" })),
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
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { owner_user_id: ownerUserId, slug: storeSlug },
              error: null
            }))
          }))
        }))
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
}

beforeEach(() => {
  vi.resetModules();
  dispatchNotificationMock.mockReset();
  adminFromMock.mockReset();
  dispatchNotificationMock.mockResolvedValue({ ok: true });
});

describe("owner notification helpers", () => {
  test("routes owner review notifications directly to the pending review", async () => {
    mockRecipientLookup(["admin-1"], "owner-1", "sunset-mercantile");

    const { notifyOwnersReviewCreated } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersReviewCreated({
      storeId: "store-1",
      storeSlug: "sunset-mercantile",
      reviewId: "review-123",
      productId: "product-1",
      rating: 5,
      reviewerName: "Molly",
      holdForModeration: true
    });

    expect(dispatchNotificationMock).toHaveBeenCalledTimes(2);
    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "review.created.owner",
        actionUrl: "/dashboard/stores/sunset-mercantile/reviews?reviewId=review-123"
      })
    );
  });

  test("routes order-created and pickup-scheduled notifications directly to the order flyout", async () => {
    mockRecipientLookup(["admin-1"], "owner-1", "sunset-mercantile");
    adminFromMock.mockImplementation((table: string) => {
      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [{ user_id: "admin-1", role: "admin", status: "active" }],
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
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { owner_user_id: "owner-1", slug: "sunset-mercantile" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "order-12345678",
                  store_id: "store-1",
                  customer_email: "buyer@example.com",
                  fulfillment_method: "pickup",
                  pickup_window_start_at: "2026-03-15T15:00:00.000Z",
                  pickup_window_end_at: "2026-03-15T17:00:00.000Z",
                  stores: { slug: "sunset-mercantile" }
                },
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { notifyOwnersOrderCreated } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersOrderCreated("order-12345678");

    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "order.created.owner",
        actionUrl: "/dashboard/stores/sunset-mercantile/orders?orderId=order-12345678"
      })
    );

    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "order.pickup.updated",
        actionUrl: "/dashboard/stores/sunset-mercantile/orders?orderId=order-12345678"
      })
    );
  });

  test("dispatches low stock notification when inventory crosses threshold", async () => {
    mockRecipientLookup(["admin-1"], "owner-1");

    const { notifyOwnersInventoryLevel } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersInventoryLevel({
      storeId: "store-1",
      productId: "product-1",
      productTitle: "Everyday Hand Cream",
      inventoryQty: 8,
      previousInventoryQty: 20,
      productStatus: "active"
    });

    expect(dispatchNotificationMock).toHaveBeenCalledTimes(2);
    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-1",
        eventType: "inventory.low_stock",
        actionUrl: "/dashboard/stores/store-slug/catalog?productId=product-1",
        dedupeKey: "inventory.low_stock:store-1:product-1:20->8:admin-1"
      })
    );
  });

  test("does not dispatch when inventory remains low without threshold transition", async () => {
    mockRecipientLookup(["admin-1"], "owner-1");

    const { notifyOwnersInventoryLevel } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersInventoryLevel({
      storeId: "store-1",
      productId: "product-1",
      productTitle: "Everyday Hand Cream",
      inventoryQty: 5,
      previousInventoryQty: 7,
      productStatus: "active"
    });

    expect(dispatchNotificationMock).not.toHaveBeenCalled();
  });

  test("dispatches out of stock notification when quantity hits zero", async () => {
    mockRecipientLookup(["admin-1"], "owner-1");

    const { notifyOwnersInventoryLevel } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersInventoryLevel({
      storeId: "store-1",
      productId: "product-1",
      productTitle: "Everyday Hand Cream",
      inventoryQty: 0,
      previousInventoryQty: 2,
      productStatus: "active"
    });

    expect(dispatchNotificationMock).toHaveBeenCalledTimes(2);
    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "inventory.out_of_stock",
        dedupeKey: "inventory.out_of_stock:store-1:product-1:2->0:admin-1"
      })
    );
  });

  test("routes team invite accepted notifications directly to the accepted member record", async () => {
    mockRecipientLookup(["admin-1"], "owner-1", "sunset-mercantile");

    const { notifyOwnersTeamInviteAccepted } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersTeamInviteAccepted({
      storeId: "store-1",
      storeSlug: "at-home-apothecary",
      acceptedInviteId: "invite-123",
      acceptedByUserId: "user-42",
      acceptedEmail: "newstaff@example.com",
      role: "staff"
    });

    expect(dispatchNotificationMock).toHaveBeenCalledTimes(2);
    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "team.invite.accepted",
        actionUrl: "/dashboard/stores/at-home-apothecary/store-settings/team?memberUserId=user-42"
      })
    );
  });

  test("routes platform store review notifications directly to the governance record", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [{ id: "platform-admin-1" }],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { notifyPlatformAdminsStoreSubmittedForReview } = await import("@/lib/notifications/owner-notifications");
    await notifyPlatformAdminsStoreSubmittedForReview({
      storeId: "store-1",
      storeSlug: "sunset-mercantile",
      storeName: "Sunset Mercantile",
      submittedByUserId: "owner-1"
    });

    expect(dispatchNotificationMock).toHaveBeenCalledTimes(1);
    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "store.review.submitted.admin",
        actionUrl: "/dashboard/admin/stores?storeId=store-1"
      })
    );
  });

  test("dispatches setup warning for missing launch prerequisites", async () => {
    mockRecipientLookup(["admin-1"], "owner-1");

    const { notifyOwnersSystemSetupWarning } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersSystemSetupWarning({
      storeId: "store-1",
      storeSlug: "sunset-mercantile",
      missingSteps: ["Payments", "First product"],
      source: "onboarding_launch",
      actorUserId: "admin-1"
    });

    expect(dispatchNotificationMock).toHaveBeenCalledTimes(1);
    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "system.setup.warning",
        actionUrl: "/dashboard/stores/at-home-apothecary/store-settings/general"
      })
    );
  });
});
