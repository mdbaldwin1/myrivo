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

  test("propagates product, cart, order-summary, and email-capture settings into storefront renderers", () => {
    const runtime = createBaseRuntime();
    runtime.branding = {
      logo_path: runtime.branding?.logo_path ?? null,
      primary_color: runtime.branding?.primary_color ?? null,
      accent_color: runtime.branding?.accent_color ?? null,
      theme_json: {
        ...(runtime.branding?.theme_json ?? {}),
        reviewsShowOnProductDetail: false
      }
    };
    runtime.settings = {
      support_email: runtime.settings?.support_email ?? null,
      fulfillment_message: runtime.settings?.fulfillment_message ?? null,
      shipping_policy: runtime.settings?.shipping_policy ?? null,
      return_policy: runtime.settings?.return_policy ?? null,
      announcement: runtime.settings?.announcement ?? null,
      seo_title: runtime.settings?.seo_title ?? null,
      seo_description: runtime.settings?.seo_description ?? null,
      seo_noindex: runtime.settings?.seo_noindex ?? false,
      seo_location_city: runtime.settings?.seo_location_city ?? null,
      seo_location_region: runtime.settings?.seo_location_region ?? null,
      seo_location_state: runtime.settings?.seo_location_state ?? null,
      seo_location_postal_code: runtime.settings?.seo_location_postal_code ?? null,
      seo_location_country_code: runtime.settings?.seo_location_country_code ?? null,
      seo_location_address_line1: runtime.settings?.seo_location_address_line1 ?? null,
      seo_location_address_line2: runtime.settings?.seo_location_address_line2 ?? null,
      seo_location_show_full_address: runtime.settings?.seo_location_show_full_address ?? false,
      footer_tagline: runtime.settings?.footer_tagline ?? null,
      footer_note: runtime.settings?.footer_note ?? null,
      instagram_url: runtime.settings?.instagram_url ?? null,
      facebook_url: runtime.settings?.facebook_url ?? null,
      tiktok_url: runtime.settings?.tiktok_url ?? null,
      storefront_copy_json: runtime.settings?.storefront_copy_json ?? {},
      about_article_html: runtime.settings?.about_article_html ?? null,
      about_sections: runtime.settings?.about_sections ?? [],
      policy_faqs: runtime.settings?.policy_faqs ?? [],
      updated_at: runtime.settings?.updated_at ?? null,
      email_capture_enabled: true,
      email_capture_heading: "Stay in the loop",
      email_capture_description: "Get the latest restocks and seasonal drops.",
      email_capture_success_message: "Thanks for subscribing.",
      checkout_enable_local_pickup: false,
      checkout_local_pickup_label: "Pickup",
      checkout_local_pickup_fee_cents: 0,
      checkout_enable_flat_rate_shipping: true,
      checkout_flat_rate_shipping_label: "Flat rate shipping",
      checkout_flat_rate_shipping_fee_cents: 700,
      checkout_allow_order_note: false,
      checkout_order_note_prompt: "Leave a note"
    };
    runtime.experienceContent.productsPage = {
      reviews: {
        enabled: true,
        showOnProductDetail: true,
        defaultSort: "highest",
        itemsPerPage: 24,
        showSummary: false
      }
    };
    runtime.experienceContent.cartPage = {
      copy: {
        cart: {
          title: "Your apothecary bag",
          checkout: "Continue to secure checkout"
        }
      }
    };
    runtime.experienceContent.orderSummaryPage = {
      copy: {
        checkout: {
          title: "Order status",
          orderPlacedTemplate: "We received order {orderId}."
        }
      }
    };
    runtime.experienceContent.emails = {
      newsletterCapture: {
        enabled: false
      },
      copy: {
        footer: {
          newsletterHeading: "Join the ritual",
          newsletterDescription: "Monthly notes and new product drops."
        }
      }
    };

    const presentation = resolveStorefrontPresentation(runtime);

    expect(presentation.themeConfig.reviewsEnabled).toBe(true);
    expect(presentation.themeConfig.reviewsShowOnProductDetail).toBe(true);
    expect(presentation.themeConfig.reviewsDefaultSort).toBe("highest");
    expect(presentation.themeConfig.reviewsItemsPerPage).toBe(24);
    expect(presentation.themeConfig.reviewsShowSummary).toBe(false);
    expect(presentation.settings?.email_capture_enabled).toBe(true);
    expect(presentation.settings?.email_capture_heading).toBe("Stay in the loop");
    expect(presentation.settings?.email_capture_description).toBe("Get the latest restocks and seasonal drops.");
    expect(presentation.settings?.email_capture_success_message).toBe("Thanks for subscribing.");
    expect(presentation.copy.cart.title).toBe("Your apothecary bag");
    expect(presentation.copy.cart.checkout).toBe("Continue to secure checkout");
    expect(presentation.copy.checkout.title).toBe("Order status");
    expect(presentation.copy.checkout.orderPlacedTemplate).toBe("We received order {orderId}.");
  });
});
