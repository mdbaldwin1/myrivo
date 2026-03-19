import { describe, expect, test } from "vitest";
import { onboardingStarterPackageSchema } from "@/lib/onboarding/generation/contracts";
import { generateDeterministicOnboardingStarterPackage } from "@/lib/onboarding/generation/deterministic-provider";

describe("onboarding generation fallback", () => {
  test("builds a complete starter package from onboarding input", () => {
    const result = generateDeterministicOnboardingStarterPackage({
      sessionId: "11111111-1111-4111-8111-111111111111",
      storeId: "22222222-2222-4222-8222-222222222222",
      ownerUserId: "33333333-3333-4333-8333-333333333333",
      ownerEmail: "owner@example.com",
      store: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Sunset Mercantile",
        slug: "sunset-mercantile"
      },
      answers: {
        storeIdentity: {
          storeName: "Sunset Mercantile"
        },
        branding: {
          logoAssetPath: null,
          visualDirection: "natural_wellness",
          visualDirectionSource: "user"
        },
        storeProfile: {
          description: "a calm wellness shop for bath, body, and ritual products"
        },
        firstProduct: {
          title: "Lavender Soak",
          description: "A calming bath soak with a quiet herbal profile.",
          priceDollars: "24",
          optionMode: "none",
          inventoryMode: "made_to_order"
        },
        payments: {
          connectDeferred: true
        }
      },
      firstProduct: {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Lavender Soak",
        description: "A calming bath soak with a quiet herbal profile.",
        priceCents: 2400,
        seoTitle: null,
        seoDescription: null,
        imageAltText: null
      }
    });

    expect(result.provider).toBe("deterministic");
    expect(result.model).toBe("deterministic-v1");
    const parsed = onboardingStarterPackageSchema.parse(result.output);
    expect(parsed.branding.primaryColor).toBe(result.output.branding.primaryColor);
    expect(parsed.settings.footerTagline).toBe(result.output.settings.footerTagline);
    expect(result.output.home.hero.headline).toContain("Sunset Mercantile");
    expect(result.output.product.description.length).toBeGreaterThan(20);
    expect(result.output.policies.faqs.length).toBeGreaterThanOrEqual(2);
    expect(result.output.home.hero.eyebrow.toLowerCase()).not.toContain("preview");
    expect(result.output.settings.footerNote.toLowerCase()).not.toContain("draft");
    expect(result.output.home.contentBlocks.some((block) => /studio|catalog|draft/i.test(`${block.title} ${block.body}`))).toBe(false);
  });

  test("varies ai_choice palettes by store category", () => {
    const flowerResult = generateDeterministicOnboardingStarterPackage({
      sessionId: "11111111-1111-4111-8111-111111111111",
      storeId: "22222222-2222-4222-8222-222222222222",
      ownerUserId: "33333333-3333-4333-8333-333333333333",
      ownerEmail: "owner@example.com",
      store: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Margie's Flower Shop",
        slug: "margies-flower-shop"
      },
      answers: {
        storeIdentity: {
          storeName: "Margie's Flower Shop"
        },
        branding: {
          logoAssetPath: null,
          visualDirection: "ai_choice",
          visualDirectionSource: "ai"
        },
        storeProfile: {
          description: "A flower shop for weddings, funerals, birthdays, and everyday bouquets."
        },
        firstProduct: {
          title: "Roses",
          description: "",
          priceDollars: "30",
          optionMode: "single_axis",
          inventoryMode: "made_to_order"
        },
        payments: {
          connectDeferred: true
        }
      },
      firstProduct: {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Roses",
        description: "",
        priceCents: 3000,
        seoTitle: null,
        seoDescription: null,
        imageAltText: null
      }
    });

    expect(flowerResult.output.branding.primaryColor).toBe("#A14D70");
    expect(flowerResult.output.branding.accentColor).toBe("#E6A8B7");
    expect(flowerResult.output.home.hero.eyebrow.toLowerCase()).toContain("flowers");
  });
});
