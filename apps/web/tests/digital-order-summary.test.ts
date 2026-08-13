import { describe, expect, test } from "vitest";
import { loadMerchantDigitalOrderSummary } from "@/lib/digital-products/order-summary";

function createClient(rows: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        in: () => builder,
        order: () => builder,
        returns: async () => ({ data: rows[table] ?? [], error: null })
      };
      return builder;
    }
  };
}

describe("merchant digital order summary", () => {
  test("derives safe manifest, delivery, access, grant, and attempt state", async () => {
    const summary = await loadMerchantDigitalOrderSummary({
      orderId: "11111111-1111-4111-8111-111111111111",
      storeId: "22222222-2222-4222-8222-222222222222",
      activeDisputeStatus: "needs_response",
      client: createClient({
        digital_purchase_manifest_items: [
          {
            order_item_id: "33333333-3333-4333-8333-333333333333",
            asset_version_id: "44444444-4444-4444-8444-444444444444",
            label: "Printable art",
            customer_filename: "art.pdf",
            mime_type: "application/pdf",
            sort_order: 0
          }
        ],
        digital_order_entitlements: [
          {
            order_item_id: "33333333-3333-4333-8333-333333333333",
            asset_version_id: "44444444-4444-4444-8444-444444444444",
            customer_filename: "art.pdf",
            mime_type: "application/pdf",
            max_download_grants: 5,
            download_grants_used: 1,
            status: "suspended",
            first_accessed_at: "2026-08-13T12:00:00.000Z",
            last_accessed_at: "2026-08-13T13:00:00.000Z"
          }
        ],
        digital_delivery_jobs: [{ id: "55555555-5555-4555-8555-555555555555", status: "succeeded" }],
        digital_delivery_attempts: [{
          job_id: "55555555-5555-4555-8555-555555555555",
          attempt_number: 1,
          status: "succeeded",
          started_at: "2026-08-13T11:00:00.000Z",
          finished_at: "2026-08-13T11:01:00.000Z"
        }],
        digital_delivery_notifications: [{ id: "66666666-6666-4666-8666-666666666666", status: "failed" }],
        digital_delivery_notification_attempts: [{
          notification_id: "66666666-6666-4666-8666-666666666666",
          attempt_number: 2,
          status: "failed",
          started_at: "2026-08-13T11:02:00.000Z",
          finished_at: "2026-08-13T11:03:00.000Z"
        }],
        digital_order_access_tokens: [{ expires_at: "2099-08-15T11:00:00.000Z" }]
      })
    });

    expect(summary).toEqual({
      fileCount: 1,
      deliveryStatus: "succeeded",
      notificationStatus: "failed",
      accessStatus: "suspended",
      firstAccessedAt: "2026-08-13T12:00:00.000Z",
      lastAccessedAt: "2026-08-13T13:00:00.000Z",
      attempts: [{ attemptNumber: 1, status: "succeeded", startedAt: "2026-08-13T11:00:00.000Z", finishedAt: "2026-08-13T11:01:00.000Z" }],
      notificationAttempts: [{ attemptNumber: 2, status: "failed", startedAt: "2026-08-13T11:02:00.000Z", finishedAt: "2026-08-13T11:03:00.000Z" }],
      files: [{ label: "Printable art", filename: "art.pdf", format: "PDF", grantsRemaining: 4, status: "suspended" }],
      activeLinkExpiresAt: "2099-08-15T11:00:00.000Z",
      activeDisputeStatus: "needs_response"
    });
    expect(JSON.stringify(summary)).not.toMatch(/token|storage|safe_error|55555555|66666666/i);
  });
});
