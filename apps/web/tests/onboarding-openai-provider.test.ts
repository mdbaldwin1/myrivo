import { describe, expect, test } from "vitest";
import { buildSystemPrompt, buildUserPrompt, sanitizeOpenAiStarterPackage } from "@/lib/onboarding/generation/openai-provider";

describe("onboarding OpenAI prompt construction", () => {
  test("system prompt forbids internal setup language from leaking into storefront copy", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("Do not mention onboarding, preview, reveal, generation, starter package, launch prep, drafts, templates, the system, Myrivo, Studio, or Catalog.");
    expect(prompt).toContain("Transactional emails must stay concise and operational.");
    expect(prompt).toContain("Content blocks should help a shopper understand the store and products, not the software or setup process.");
  });

  test("user prompt frames rough inputs as source material rather than final copy", () => {
    const prompt = buildUserPrompt({
      sessionId: "11111111-1111-4111-8111-111111111111",
      storeId: "22222222-2222-4222-8222-222222222222",
      ownerUserId: "33333333-3333-4333-8333-333333333333",
      ownerEmail: "owner@example.com",
      store: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Billy's Bait Shop",
        slug: "billys-bait-shop"
      },
      answers: {
        storeIdentity: {
          storeName: "Billy's Bait Shop"
        },
        branding: {
          logoAssetPath: null,
          visualDirection: "ai_choice",
          visualDirectionSource: "ai"
        },
        storeProfile: {
          description: "A bait and tackle shop with worms, lures, and fishing gear."
        },
        firstProduct: {
          title: "Nightcrawlers",
          description: "Fresh worms packed for the weekend bite.",
          priceDollars: "10",
          optionMode: "none",
          inventoryMode: "in_stock"
        },
        payments: {
          connectDeferred: true
        }
      },
      firstProduct: {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Nightcrawlers",
        description: "Fresh worms packed for the weekend bite.",
        priceCents: 1000,
        seoTitle: null,
        seoDescription: null,
        imageAltText: null
      }
    });

    expect(prompt).toContain("rough onboarding notes");
    expect(prompt).toContain("Do not echo awkward source text verbatim");
    expect(prompt).toContain("owner new order email: operational only; never include long marketing paragraphs");
    expect(prompt).toContain("\"name\": \"Billy's Bait Shop\"");
  });

  test("sanitizer replaces internal platform language with shopper-facing fallback copy", () => {
    const input = {
      sessionId: "11111111-1111-4111-8111-111111111111",
      storeId: "22222222-2222-4222-8222-222222222222",
      ownerUserId: "33333333-3333-4333-8333-333333333333",
      ownerEmail: "owner@example.com",
      store: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Billy's Bait Shop",
        slug: "billys-bait-shop"
      },
      answers: {
        storeIdentity: {
          storeName: "Billy's Bait Shop"
        },
        branding: {
          logoAssetPath: null,
          visualDirection: "ai_choice" as const,
          visualDirectionSource: "ai" as const
        },
        storeProfile: {
          description: "A bait and tackle shop with worms, lures, and fishing gear."
        },
        firstProduct: {
          title: "Worms",
          description: "Fresh worms packed for the weekend bite.",
          priceDollars: "10",
          optionMode: "none" as const,
          inventoryMode: "in_stock" as const
        },
        payments: {
          connectDeferred: true
        }
      },
      firstProduct: {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Worms",
        description: "Fresh worms packed for the weekend bite.",
        priceCents: 1000,
        seoTitle: null,
        seoDescription: null,
        imageAltText: null
      }
    };

    const sanitized = sanitizeOpenAiStarterPackage(input, {
      branding: {
        primaryColor: "#0F766E",
        accentColor: "#14B8A6",
        theme: {
          pageWidth: "standard",
          heroLayout: "split",
          heroBrandDisplay: "title",
          heroShowLogo: false,
          heroShowTitle: true,
          heroImageSize: "medium",
          productGridColumns: 3,
          radiusScale: "rounded",
          cardStyle: "integrated",
          spacingScale: "comfortable",
          fontFamily: "fraunces-manrope",
          showContentBlocks: true,
          showPolicyStrip: true,
          heroEyebrow: "Now taking shape",
          heroHeadline: "Billy's Bait Shop is shaping a bait shop experience.",
          heroSubcopy: "Room to keep shaping the storefront in Studio and Catalog.",
          heroBadgeOne: "Preview-ready",
          heroBadgeTwo: "signature direction",
          heroBadgeThree: "First product included",
          backgroundColor: "#F3FBFA",
          surfaceColor: "#FFFFFF",
          textColor: "#123C3B",
          headerBackgroundColor: "#FFFFFF",
          headerForegroundColor: "#123C3B",
          headerShowLogo: false,
          headerShowTitle: true,
          headerLogoSize: "medium",
          headerTitleSize: "medium",
          primaryForegroundColor: null,
          accentForegroundColor: null,
          homeShowHero: true,
          homeShowContentBlocks: true,
          homeShowFeaturedProducts: true,
          homeFeaturedProductsLimit: 6,
          productsFilterLayout: "sidebar",
          productsFiltersDefaultOpen: false,
          productsShowSearch: true,
          productsShowSort: true,
          productsShowAvailability: true,
          productsShowOptionFilters: true,
          productCardShowDescription: true,
          productCardDescriptionLines: 2,
          productCardShowFeaturedBadge: true,
          productCardShowAvailability: true,
          productCardShowQuickAdd: true,
          productCardImageHoverZoom: true,
          productCardShowCarouselArrows: true,
          productCardShowCarouselDots: true,
          productCardImageFit: "cover",
          primaryCtaStyle: "primary",
          reviewsEnabled: true,
          reviewsShowOnHome: true,
          reviewsShowOnProductDetail: true,
          reviewsFormEnabled: true,
          reviewsDefaultSort: "newest",
          reviewsItemsPerPage: 10,
          reviewsShowVerifiedBadge: true,
          reviewsShowMediaGallery: true,
          reviewsShowSummary: true
        }
      },
      settings: {
        announcement: "Billy's Bait Shop is getting ready behind the scenes.",
        fulfillmentMessage: "Packed carefully.",
        shippingPolicy: "Ships soon.",
        returnPolicy: "Returns within 14 days.",
        footerTagline: "Fishing gear and worms.",
        footerNote: "This is the first polished storefront draft for Billy's Bait Shop.",
        seoTitle: "Billy's Bait Shop | Worms",
        seoDescription: "Fishing gear and worms.",
        emailCaptureHeading: "Stay in the loop",
        emailCaptureDescription: "Get first access to launches and updates.",
        emailCaptureSuccessMessage: "You're on the list.",
        welcomePopupEyebrow: "Welcome offer",
        welcomePopupHeadline: "Start with a warm hello",
        welcomePopupBody: "Join the list for launch updates.",
        welcomePopupEmailPlaceholder: "Email address",
        welcomePopupCtaLabel: "Send my welcome offer",
        welcomePopupDeclineLabel: "Maybe later",
        checkoutLocalPickupLabel: "Local pickup",
        checkoutFlatRateShippingLabel: "Standard shipping",
        checkoutOrderNotePrompt: "Anything we should know?"
      },
      home: {
        hero: {
          layout: "split",
          brandDisplay: "title",
          eyebrow: "Storefront preview",
          headline: "Billy's Bait Shop is shaping a bait shop experience.",
          subcopy: "Room to keep shaping the storefront in Studio and Catalog.",
          badgeOne: "Preview-ready",
          badgeTwo: "signature direction",
          badgeThree: "First product included",
          imageSize: "medium",
          showLogo: false,
          showTitle: true
        },
        contentBlocks: [
          { eyebrow: "Built to keep improving", title: "Easy to refine in Studio and Catalog", body: "Draft copy for reveal.", ctaLabel: "Browse products", ctaUrl: "/products" },
          { eyebrow: "Customer confidence", title: "Policies are already drafted", body: "Launch prep starts here.", ctaLabel: "Learn more", ctaUrl: "/about" }
        ]
      },
      about: {
        articleParagraphs: [
          "This first storefront draft is designed to feel polished now and easy to refine as the catalog grows.",
          "Another paragraph"
        ],
        sections: [
          { title: "What the store is building", body: "Momentum for the first version matters.", layout: "full" },
          { title: "Why this first version matters", body: "Easy to refine in Studio and Catalog.", layout: "image_left" }
        ]
      },
      policies: {
        supportLead: "Reach out anytime.",
        faqs: [
          { question: "When will my order ship?", answer: "Ships soon." },
          { question: "Can I ask a question?", answer: "Yes." }
        ]
      },
      emails: {
        senderName: "Billy's Bait Shop",
        replyToEmail: "owner@example.com",
        theme: {
          canvasColor: "#F6F4EF",
          cardColor: "#FFFFFF",
          textColor: "#1F2937",
          mutedColor: "#6B7280",
          accentColor: "#14B8A6",
          buttonTextColor: "#FFFFFF",
          borderRadius: "rounded"
        },
        welcomeDiscount: {
          subject: "Welcome",
          preheader: "Offer waiting",
          headline: "Welcome",
          bodyParagraphs: ["Thanks", "Join for launch updates", "Preview-ready copy"],
          ctaLabel: "Shop now",
          footerNote: "Footer"
        },
        customerConfirmation: {
          subject: "Order confirmed",
          preheader: "We got it",
          headline: "Thanks",
          bodyParagraphs: ["We got it", "Ships soon"],
          ctaLabel: "View order",
          footerNote: "Footer"
        },
        ownerNewOrder: {
          subject: "New order",
          preheader: "A new order just came in",
          headline: "New order",
          bodyParagraphs: ["A new order came in", "Review it", "Preview-ready bait copy"],
          ctaLabel: "Open dashboard",
          footerNote: "Footer"
        }
      },
      product: {
        description: "Fresh worms packed for the weekend bite.",
        seoTitle: "Worms | Billy's Bait Shop",
        seoDescription: "Fresh worms packed for the weekend bite.",
        imageAltText: "Worms from Billy's Bait Shop"
      }
    });

    expect(sanitized.home.hero.eyebrow.toLowerCase()).not.toContain("preview");
    expect(sanitized.home.hero.headline.toLowerCase()).not.toContain("is shaping");
    expect(sanitized.home.contentBlocks.some((block) => /studio|catalog|draft/i.test(`${block.title} ${block.body}`))).toBe(false);
    expect(sanitized.settings.footerNote.toLowerCase()).not.toContain("draft");
    expect(sanitized.settings.announcement.toLowerCase()).not.toContain("behind the scenes");
  });
});
