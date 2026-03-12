import { describe, expect, test } from "vitest";
import { createDefaultStoreExperienceContent } from "@/lib/store-experience/content";
import { resolveStorefrontPresentation } from "@/lib/storefront/presentation";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";

function createBaseRuntime() {
  return createStorefrontRuntime({
    store: {
      id: "store-1",
      name: "Olive Mercantile",
      slug: "olive-mercantile"
    },
    viewer: {
      isAuthenticated: true,
      canManageStore: true
    },
    branding: {
      logo_path: null,
      primary_color: "#111111",
      accent_color: "#eeeeee",
      theme_json: {
        heroHeadline: "Live headline",
        productGridColumns: 3,
        reviewsEnabled: false
      }
    },
    settings: {
      support_email: "support@olive.test",
      fulfillment_message: "Ready in 2 days",
      shipping_policy: "Ships next week.",
      return_policy: "Returns within 14 days.",
      announcement: "Live announcement",
      footer_tagline: null,
      footer_note: null,
      instagram_url: null,
      facebook_url: null,
      tiktok_url: null,
      storefront_copy_json: {
        nav: {
          home: "Home live"
        },
        about: {
          questionsHeading: "Live questions"
        }
      },
      about_article_html: "<p>Live article</p>",
      about_sections: [],
      policy_faqs: [],
      updated_at: "2026-03-10T00:00:00.000Z"
    },
    experienceContent: createDefaultStoreExperienceContent(),
    contentBlocks: [
      {
        id: "block-1",
        sort_order: 0,
        eyebrow: "Live",
        title: "Live block",
        body: "Live body",
        cta_label: null,
        cta_url: null,
        is_active: true
      }
    ],
    products: [],
    mode: "studio",
    surface: "home"
  });
}

describe("storefront presentation", () => {
  test("resolves theme, copy, and content blocks from experience content", () => {
    const runtime = createBaseRuntime();
    runtime.experienceContent.home = {
      announcement: "Draft announcement",
      fulfillmentMessage: "Delivered tomorrow",
      hero: {
        headline: "Draft hero",
        subcopy: "Draft subcopy"
      },
      visibility: {
        showFeaturedProducts: false,
        featuredProductsLimit: 2
      },
      contentBlocks: [
        {
          id: "draft-block",
          sortOrder: 2,
          eyebrow: "Draft",
          title: "Draft block",
          body: "Draft block body",
          isActive: true
        }
      ],
      copy: {
        home: {
          shopProductsCta: "Browse draft products"
        }
      }
    };
    runtime.experienceContent.productsPage = {
      layout: {
        gridColumns: 4
      },
      reviews: {
        enabled: true
      }
    };

    const presentation = resolveStorefrontPresentation(runtime);

    expect(presentation.themeConfig.heroHeadline).toBe("Draft hero");
    expect(presentation.themeConfig.heroSubcopy).toBe("Draft subcopy");
    expect(presentation.themeConfig.homeFeaturedProductsLimit).toBe(2);
    expect(presentation.themeConfig.homeShowFeaturedProducts).toBe(false);
    expect(presentation.themeConfig.productGridColumns).toBe(4);
    expect(presentation.themeConfig.reviewsEnabled).toBe(true);
    expect(presentation.settings?.announcement).toBe("Draft announcement");
    expect(presentation.settings?.fulfillment_message).toBe("Delivered tomorrow");
    expect(presentation.copy.home.shopProductsCta).toBe("Browse draft products");
    expect(presentation.contentBlocks).toEqual([
      {
        id: "draft-block",
        sort_order: 2,
        eyebrow: "Draft",
        title: "Draft block",
        body: "Draft block body",
        cta_label: null,
        cta_url: null,
        is_active: true
      }
    ]);
  });

  test("resolves about and policies settings overlays from experience content", () => {
    const runtime = createBaseRuntime();
    runtime.experienceContent.aboutPage = {
      aboutArticleHtml: "<p>Draft article</p>",
      aboutSections: [
        {
          id: "section-1",
          title: "Our craft",
          body: "Built carefully",
          imageUrl: null,
          layout: "full"
        }
      ],
      copy: {
        about: {
          questionsHeading: "Draft questions"
        }
      }
    };
    runtime.experienceContent.policiesPage = {
      supportEmail: "help@olive.test",
      shippingPolicy: "Draft shipping policy",
      returnPolicy: "Draft return policy",
      policyFaqs: [
        {
          id: "faq-1",
          question: "When do you ship?",
          answer: "Twice weekly",
          sortOrder: 1,
          isActive: true
        }
      ]
    };

    const presentation = resolveStorefrontPresentation(runtime);

    expect(presentation.settings?.about_article_html).toBe("<p>Draft article</p>");
    expect(presentation.settings?.about_sections).toEqual([
      {
        id: "section-1",
        title: "Our craft",
        body: "Built carefully",
        imageUrl: null,
        layout: "full"
      }
    ]);
    expect(presentation.settings?.support_email).toBe("help@olive.test");
    expect(presentation.settings?.shipping_policy).toBe("Draft shipping policy");
    expect(presentation.settings?.return_policy).toBe("Draft return policy");
    expect(presentation.settings?.policy_faqs).toEqual([
      {
        id: "faq-1",
        question: "When do you ship?",
        answer: "Twice weekly",
        sort_order: 1,
        is_active: true
      }
    ]);
    expect(presentation.copy.about.questionsHeading).toBe("Draft questions");
  });
});
