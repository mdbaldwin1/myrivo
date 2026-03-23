import { describe, expect, test } from "vitest";
import type { OwnedStoreBundle } from "@/lib/stores/owner-store";
import { buildStoreEditorSettingsPayload } from "@/lib/store-editor/config";

function buildBundle(overrides?: Partial<OwnedStoreBundle>): OwnedStoreBundle {
  return {
    store: {
      id: "store-1",
      name: "Olive Mercantile",
      slug: "olive-mercantile",
      status: "draft",
      has_launched_once: false,
      stripe_account_id: null
    },
    role: "owner",
    availableStores: [],
    permissionsJson: {},
    branding: null,
    settings: null,
    contentBlocks: [],
    ...overrides
  };
}

describe("buildStoreEditorSettingsPayload", () => {
  test("fills editor-facing defaults when settings are missing", () => {
    const payload = buildStoreEditorSettingsPayload(buildBundle(), {
      provider: "none",
      source: "default",
      apiKey: null,
      webhookSecret: null
    });

    expect(payload.checkoutRules).toEqual({
      fulfillmentMessage: null,
      checkoutEnableLocalPickup: false,
      checkoutLocalPickupLabel: "Porch pickup",
      checkoutLocalPickupFeeCents: 0,
      checkoutEnableFlatRateShipping: true,
      checkoutFlatRateShippingLabel: "Shipped (flat fee)",
      checkoutFlatRateShippingFeeCents: 0,
      checkoutAllowOrderNote: false,
      checkoutOrderNotePrompt: "If you have any questions, comments, or concerns about your order, leave a note below."
    });
    expect(payload.integrations.shipping.hasApiKey).toBe(false);
    expect(payload.integrations.shipping.hasWebhookSecret).toBe(false);
  });
});
