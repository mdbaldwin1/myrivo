import { describe, expect, test } from "vitest";
import {
  storefrontStudioOwnedStoreSettingsSectionIds,
  storeSettingsWorkspaceNavigationSectionIds,
  storeSettingsWorkspaceSections
} from "@/lib/store-editor/store-settings-workspace";

describe("store settings workspace classification", () => {
  test("keeps storefront-builder settings distinct from operations-only settings", () => {
    const ownershipById = Object.fromEntries(storeSettingsWorkspaceSections.map((section) => [section.id, section.ownership]));

    expect(ownershipById.general).toBe("operations");
    expect(ownershipById.branding).toBe("builder");
    expect(ownershipById.legal).toBe("operations");
    expect(ownershipById.privacy).toBe("operations");
    expect(ownershipById.billing).toBe("operations");
    expect(ownershipById.fulfillment).toBe("operations");
    expect(ownershipById.domains).toBe("operations");
    expect(ownershipById.team).toBe("operations");
    expect(ownershipById.integrations).toBe("operations");
  });

  test("exposes only operational or mixed sections in settings workspace navigation", () => {
    expect(storeSettingsWorkspaceNavigationSectionIds).toEqual([
      "general",
      "domains",
      "fulfillment",
      "integrations",
      "billing",
      "team",
      "legal",
      "privacy"
    ]);
  });

  test("tracks Studio-owned settings sections separately from settings navigation", () => {
    expect(storefrontStudioOwnedStoreSettingsSectionIds).toEqual(["branding"]);
  });
});
