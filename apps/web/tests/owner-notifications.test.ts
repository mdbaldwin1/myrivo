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
  test("dispatches low stock notification when inventory crosses threshold", async () => {
    mockRecipientLookup(["admin-1"], "owner-1");

    const { notifyOwnersInventoryLevel } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersInventoryLevel({
      storeId: "store-1",
      productId: "product-1",
      productTitle: "Whipped Tallow",
      inventoryQty: 8,
      previousInventoryQty: 20,
      productStatus: "active"
    });

    expect(dispatchNotificationMock).toHaveBeenCalledTimes(2);
    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-1",
        eventType: "inventory.low_stock",
        actionUrl: "/dashboard/stores/store-slug/catalog",
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
      productTitle: "Whipped Tallow",
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
      productTitle: "Whipped Tallow",
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

  test("dispatches setup warning for missing launch prerequisites", async () => {
    mockRecipientLookup(["admin-1"], "owner-1");

    const { notifyOwnersSystemSetupWarning } = await import("@/lib/notifications/owner-notifications");
    await notifyOwnersSystemSetupWarning({
      storeId: "store-1",
      storeSlug: "at-home-apothecary",
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
