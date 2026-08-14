import { describe, expect, test } from "vitest";
import { buildCustomDomainUnavailableState, isNonPlatformCustomHost } from "@/lib/storefront/custom-domain-fallback";

describe("custom domain storefront fallback", () => {
  test("identifies non-platform custom hosts", () => {
    expect(isNonPlatformCustomHost({ host: "www.athomeapothecary.com", appUrl: "https://www.myrivo.app" })).toBe(true);
    expect(isNonPlatformCustomHost({ host: "myrivo.app", appUrl: "https://www.myrivo.app" })).toBe(false);
    expect(isNonPlatformCustomHost({ host: "localhost:3000", appUrl: "https://www.myrivo.app" })).toBe(false);
    expect(isNonPlatformCustomHost({ host: "myrivo-git-main.vercel.app", appUrl: "https://www.myrivo.app" })).toBe(false);
  });

  test("builds a branded unavailable shell from the custom domain", () => {
    const state = buildCustomDomainUnavailableState({
      host: "www.athomeapothecary.com",
      storeSlug: "at-home-apothecary"
    });

    expect(state.kind).toBe("service_unavailable");
    expect(state.store.name).toBe("At Home Apothecary");
    expect(state.store.slug).toBe("at-home-apothecary");
    expect(state.settings?.announcement).toBe("Please check back soon.");
  });
});
