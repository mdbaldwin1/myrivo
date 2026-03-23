import { buildDefaultEmailStudioDocument } from "@/lib/email-studio/model";
import type { OnboardingGenerationInput, OnboardingGenerationProviderResult, OnboardingStarterPackage } from "@/lib/onboarding/generation/contracts";

const visualDirectionThemeMap: Record<
  NonNullable<OnboardingGenerationInput["answers"]["branding"]["visualDirection"]>,
  Pick<
    OnboardingStarterPackage["branding"]["theme"],
    | "pageWidth"
    | "heroLayout"
    | "radiusScale"
    | "cardStyle"
    | "spacingScale"
    | "fontFamily"
    | "productGridColumns"
    | "productsFilterLayout"
    | "backgroundColor"
    | "surfaceColor"
    | "textColor"
    | "headerBackgroundColor"
    | "headerForegroundColor"
    | "primaryCtaStyle"
  > & {
    primaryColor: string;
    accentColor: string;
  }
> = {
  minimal: {
    primaryColor: "#1F2937",
    accentColor: "#475569",
    pageWidth: "narrow",
    heroLayout: "centered",
    radiusScale: "sharp",
    cardStyle: "outline",
    spacingScale: "comfortable",
    fontFamily: "helvetica-neue",
    productGridColumns: 3,
    productsFilterLayout: "topbar",
    backgroundColor: "#FAFAF9",
    surfaceColor: "#FFFFFF",
    textColor: "#111827",
    headerBackgroundColor: "#FFFFFF",
    headerForegroundColor: "#111827",
    primaryCtaStyle: "outline"
  },
  warm_handmade: {
    primaryColor: "#8A5A3B",
    accentColor: "#C07A4C",
    pageWidth: "standard",
    heroLayout: "split",
    radiusScale: "rounded",
    cardStyle: "elevated",
    spacingScale: "comfortable",
    fontFamily: "fraunces-manrope",
    productGridColumns: 2,
    productsFilterLayout: "sidebar",
    backgroundColor: "#F8F2EC",
    surfaceColor: "#FFFDFC",
    textColor: "#3E2A1F",
    headerBackgroundColor: "#FFF7F0",
    headerForegroundColor: "#3E2A1F",
    primaryCtaStyle: "primary"
  },
  natural_wellness: {
    primaryColor: "#3F6A52",
    accentColor: "#87A878",
    pageWidth: "standard",
    heroLayout: "split",
    radiusScale: "soft",
    cardStyle: "solid",
    spacingScale: "airy",
    fontFamily: "fraunces-manrope",
    productGridColumns: 2,
    productsFilterLayout: "sidebar",
    backgroundColor: "#F3F8F1",
    surfaceColor: "#FFFFFF",
    textColor: "#204032",
    headerBackgroundColor: "#F9FCF8",
    headerForegroundColor: "#204032",
    primaryCtaStyle: "primary"
  },
  bold_modern: {
    primaryColor: "#111827",
    accentColor: "#F97316",
    pageWidth: "wide",
    heroLayout: "centered",
    radiusScale: "rounded",
    cardStyle: "integrated",
    spacingScale: "compact",
    fontFamily: "avenir-next",
    productGridColumns: 4,
    productsFilterLayout: "topbar",
    backgroundColor: "#F7F7F8",
    surfaceColor: "#FFFFFF",
    textColor: "#111827",
    headerBackgroundColor: "#FFFFFF",
    headerForegroundColor: "#111827",
    primaryCtaStyle: "accent"
  },
  premium: {
    primaryColor: "#3B2A1E",
    accentColor: "#B88C4A",
    pageWidth: "narrow",
    heroLayout: "split",
    radiusScale: "soft",
    cardStyle: "elevated",
    spacingScale: "airy",
    fontFamily: "palatino",
    productGridColumns: 2,
    productsFilterLayout: "sidebar",
    backgroundColor: "#F7F3EE",
    surfaceColor: "#FFFCF8",
    textColor: "#24190F",
    headerBackgroundColor: "#FFF8EF",
    headerForegroundColor: "#24190F",
    primaryCtaStyle: "primary"
  },
  ai_choice: {
    primaryColor: "#0F766E",
    accentColor: "#14B8A6",
    pageWidth: "standard",
    heroLayout: "split",
    radiusScale: "rounded",
    cardStyle: "integrated",
    spacingScale: "comfortable",
    fontFamily: "fraunces-manrope",
    productGridColumns: 3,
    productsFilterLayout: "sidebar",
    backgroundColor: "#F3FBFA",
    surfaceColor: "#FFFFFF",
    textColor: "#123C3B",
    headerBackgroundColor: "#FFFFFF",
    headerForegroundColor: "#123C3B",
    primaryCtaStyle: "primary"
  }
};

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function firstSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? trimmed).trim();
}

function inferStoreCategory(input: OnboardingGenerationInput) {
  const haystack = [
    input.store.name,
    input.answers.storeProfile.description,
    input.firstProduct?.title ?? "",
    input.firstProduct?.description ?? ""
  ]
    .join(" ")
    .toLowerCase();

  if (/(bait|tackle|fishing|angler|anglers|worm|worms|lure|lures|hook|hooks|bobber|bobbers|line|reel|reels)/.test(haystack)) {
    return {
      heroEyebrow: "Bait, tackle, and fishing essentials",
      heroHeadline: `Get ready for the next cast with ${input.store.name}`,
      heroSubcopyTail: "Shop dependable bait, tackle, and gear for early mornings, weekend trips, and days at the water.",
      badgeTwo: "Tackle box staples",
      badgeThree: "Weekend-ready picks",
      browseBlockTitle: "Bait and tackle that earn a spot in the box",
      browseBlockBody: "From lively bait to dependable tackle, the lineup is built for anglers who want straightforward gear that works.",
      qualityBlockTitle: "Built for early mornings and better bites",
      qualityBlockBody: "The assortment focuses on practical favorites, useful staples, and the kind of gear you reach for before a long day on the water.",
      trustBlockTitle: "Easy ordering, clear updates, and real help",
      trustBlockBody: "Shipping, pickup, and support details stay clear so customers know what to expect before they place an order.",
      aboutLead: `${input.store.name} is here for anglers who want reliable bait, practical tackle, and gear that is easy to grab before heading to the water.`,
      aboutExpect: "Expect a focused lineup of dependable bait, useful tackle, and straightforward store help when you need it.",
      announcement: `Fresh bait, tackle, and fishing essentials from ${input.store.name}.`,
      footerNote: "Questions about an order or a product? Reach out and we’ll help.",
      emailCaptureDescription: `Be first to hear about fresh bait, new tackle picks, and shop updates from ${input.store.name}.`,
      welcomePopupBody: "Join the list for fresh bait updates, new tackle arrivals, and occasional offers from the shop.",
      productSeoLead: "Fresh bait and fishing essentials"
    } as const;
  }

  if (/(flower|flowers|floral|bouquet|bouquets|rose|roses|wedding|weddings|funeral|funerals|valentine|valentines|mother'?s day|arrangement|arrangements)/.test(haystack)) {
    return {
      heroEyebrow: "Flowers for everyday moments and big occasions",
      heroHeadline: `Fresh flowers from ${input.store.name}`,
      heroSubcopyTail: "Shop bouquets, stems, and arrangements designed to feel bright, generous, and full of life.",
      badgeTwo: "Seasonal bouquets",
      badgeThree: "Made for gifting",
      browseBlockTitle: "Flowers for celebrations, comforts, and everyday tables",
      browseBlockBody: "The shop focuses on bouquets, stems, and arrangements that feel thoughtful, colorful, and easy to order.",
      qualityBlockTitle: "Color, care, and a personal touch",
      qualityBlockBody: "Every arrangement is meant to feel fresh, expressive, and right for the moment, whether it is a gift, an event, or something for home.",
      trustBlockTitle: "Simple ordering and clear pickup details",
      trustBlockBody: "Store details stay straightforward so customers can order with confidence for events, gifts, and everyday deliveries.",
      aboutLead: `${input.store.name} creates flowers for celebrations, sympathy, everyday beauty, and the people who want something thoughtful delivered with care.`,
      aboutExpect: "Expect colorful arrangements, flexible ordering, and flowers suited for homes, events, businesses, churches, and milestone moments.",
      announcement: `Fresh flowers and arrangements from ${input.store.name}.`,
      footerNote: "Questions about flowers, custom orders, or delivery? Reach out and we’ll help.",
      emailCaptureDescription: `Get seasonal bouquet updates, holiday ordering reminders, and fresh arrivals from ${input.store.name}.`,
      welcomePopupBody: "Join the list for seasonal bouquet updates, holiday reminders, and occasional flower-shop offers.",
      productSeoLead: "Fresh flowers and arrangements"
    } as const;
  }

  return {
    heroEyebrow: "Thoughtful picks for everyday shopping",
    heroHeadline: `Shop the first collection from ${input.store.name}`,
    heroSubcopyTail: "Explore a focused assortment built to feel helpful, easy to shop, and ready for repeat visits.",
    badgeTwo: "Customer favorites",
    badgeThree: "Easy to shop",
    browseBlockTitle: "A focused assortment from the start",
    browseBlockBody: "The first collection is meant to feel approachable, useful, and easy to browse from the moment customers arrive.",
    qualityBlockTitle: "A clear point of view behind the assortment",
    qualityBlockBody: "Every featured product helps set the tone for a store that feels considered, consistent, and easy to trust.",
    trustBlockTitle: "Clear support and straightforward ordering",
    trustBlockBody: "Store policies, support details, and checkout messaging are designed to keep the shopping experience simple and reassuring.",
    aboutLead: `${input.store.name} is built around a focused assortment and a straightforward approach to helping customers find what they need.`,
    aboutExpect: "Expect a growing assortment, clear communication, and a store experience that stays easy to shop.",
    announcement: `Shop the latest from ${input.store.name}.`,
    footerNote: "Need help with a product or order? Reach out and we’ll help.",
    emailCaptureDescription: `Get product updates, new arrivals, and occasional offers from ${input.store.name}.`,
    welcomePopupBody: "Join the list for product updates, new arrivals, and occasional offers from the store.",
    productSeoLead: "Featured products"
  } as const;
}

function resolveDirectionTheme(
  direction: NonNullable<OnboardingGenerationInput["answers"]["branding"]["visualDirection"]>,
  input: OnboardingGenerationInput
) {
  const baseTheme = visualDirectionThemeMap[direction];

  if (direction !== "ai_choice") {
    return baseTheme;
  }

  const haystack = [
    input.store.name,
    input.answers.storeProfile.description,
    input.firstProduct?.title ?? "",
    input.firstProduct?.description ?? ""
  ]
    .join(" ")
    .toLowerCase();

  if (/(bait|tackle|fishing|angler|anglers|worm|worms|lure|lures|hook|hooks|bobber|bobbers|line|reel|reels)/.test(haystack)) {
    return {
      ...baseTheme,
      primaryColor: "#355848",
      accentColor: "#C98B2E",
      backgroundColor: "#F6F3EA",
      surfaceColor: "#FFFDF8",
      textColor: "#21362C",
      headerBackgroundColor: "#FFFDF8",
      headerForegroundColor: "#21362C"
    };
  }

  if (/(flower|flowers|floral|bouquet|bouquets|rose|roses|wedding|weddings|funeral|funerals|valentine|valentines|mother'?s day|arrangement|arrangements)/.test(haystack)) {
    return {
      ...baseTheme,
      primaryColor: "#A14D70",
      accentColor: "#E6A8B7",
      backgroundColor: "#FFF5F8",
      surfaceColor: "#FFFDFE",
      textColor: "#4F2A39",
      headerBackgroundColor: "#FFFDFE",
      headerForegroundColor: "#4F2A39"
    };
  }

  return baseTheme;
}

function describeFirstProduct(input: OnboardingGenerationInput) {
  const title = input.firstProduct?.title.trim() || "the first collection";
  const detail = firstSentence(input.firstProduct?.description.trim() ?? "");
  return detail ? `${title} leads the assortment. ${detail}` : `${title} leads the first assortment.`;
}

function buildEmailDocument(input: OnboardingGenerationInput, primaryColor: string, accentColor: string) {
  const document = buildDefaultEmailStudioDocument(input.store.name);
  document.senderName = input.store.name;
  document.replyToEmail = input.ownerEmail ?? "";
  document.theme = {
    canvasColor: "#F6F4EF",
    cardColor: "#FFFFFF",
    textColor: "#1F2937",
    mutedColor: "#6B7280",
    accentColor,
    buttonTextColor: "#FFFFFF",
    borderRadius: "rounded"
  };

  document.templates.welcomeDiscount.subject = `A warm welcome from ${input.store.name}`;
  document.templates.welcomeDiscount.preheader = "Your welcome offer is waiting.";
  document.templates.welcomeDiscount.headline = "Your welcome offer is ready";
  document.templates.welcomeDiscount.bodyHtml = [
    `<p>Thanks for joining ${input.store.name}.</p>`,
    "<p>Your welcome offer is ready to use the next time you check out.</p>",
    `<p>${describeFirstProduct(input)}</p>`
  ].join("");
  document.templates.welcomeDiscount.ctaLabel = "Visit the storefront";
  document.templates.welcomeDiscount.footerNote = "You can unsubscribe any time using the link in this email.";

  document.templates.customerConfirmation.subject = `Your order with ${input.store.name} is confirmed`;
  document.templates.customerConfirmation.preheader = "We’ve got it and we’ll keep you posted.";
  document.templates.customerConfirmation.headline = "Thanks for shopping with us";
  document.templates.customerConfirmation.bodyHtml = [
    `<p>We’ve received your order at ${input.store.name}.</p>`,
    "<p>We’ll send the next update as soon as your order moves forward.</p>",
    "<p>If you need anything, just reply and we’ll help.</p>"
  ].join("");
  document.templates.customerConfirmation.ctaLabel = "View your order";
  document.templates.customerConfirmation.footerNote = input.ownerEmail
    ? `Need anything? Reply to ${input.ownerEmail}.`
    : "Need anything? Reply to this email and we’ll help.";

  document.templates.ownerNewOrder.subject = `New order for ${input.store.name}`;
  document.templates.ownerNewOrder.preheader = "A new order just came in.";
  document.templates.ownerNewOrder.headline = "A new order is ready for review";
  document.templates.ownerNewOrder.bodyHtml = [
    `<p>A new order came in for ${input.store.name}.</p>`,
    "<p>Review the order details, confirm fulfillment, and keep the customer updated.</p>",
    `<p>${describeFirstProduct(input)}</p>`
  ].join("");
  document.templates.ownerNewOrder.ctaLabel = "Open the dashboard";
  document.templates.ownerNewOrder.footerNote = "You can review everything from the store dashboard.";

  return {
    senderName: document.senderName,
    replyToEmail: document.replyToEmail,
    theme: document.theme,
    welcomeDiscount: {
      subject: document.templates.welcomeDiscount.subject,
      preheader: document.templates.welcomeDiscount.preheader,
      headline: document.templates.welcomeDiscount.headline,
      bodyParagraphs: [
        `Thanks for joining ${input.store.name}.`,
        "Your welcome offer is ready to use the next time you check out.",
        describeFirstProduct(input)
      ],
      ctaLabel: document.templates.welcomeDiscount.ctaLabel,
      footerNote: document.templates.welcomeDiscount.footerNote
    },
    customerConfirmation: {
      subject: document.templates.customerConfirmation.subject,
      preheader: document.templates.customerConfirmation.preheader,
      headline: document.templates.customerConfirmation.headline,
      bodyParagraphs: [
        `We’ve received your order at ${input.store.name}.`,
        "We’ll send the next update as soon as your order moves forward.",
        "If you need anything, just reply and we’ll help."
      ],
      ctaLabel: document.templates.customerConfirmation.ctaLabel,
      footerNote: document.templates.customerConfirmation.footerNote
    },
    ownerNewOrder: {
      subject: document.templates.ownerNewOrder.subject,
      preheader: document.templates.ownerNewOrder.preheader,
      headline: document.templates.ownerNewOrder.headline,
      bodyParagraphs: [
        `A new order came in for ${input.store.name}.`,
        "Review the order details, confirm fulfillment, and keep the customer updated.",
        describeFirstProduct(input)
      ],
      ctaLabel: document.templates.ownerNewOrder.ctaLabel,
      footerNote: document.templates.ownerNewOrder.footerNote
    }
  };
}

export function generateDeterministicOnboardingStarterPackage(
  input: OnboardingGenerationInput
): OnboardingGenerationProviderResult {
  const visualDirection = input.answers.branding.visualDirection ?? "ai_choice";
  const directionTheme = resolveDirectionTheme(visualDirection, input);
  const category = inferStoreCategory(input);
  const storeName = input.store.name;
  const directionLabel = visualDirection === "ai_choice" ? "signature" : toTitleCase(visualDirection);
  const firstProductTitle = input.firstProduct?.title.trim() || "the first collection";
  const firstProductDescription = firstSentence(input.firstProduct?.description.trim() ?? "");
  const storeDescription = firstSentence(input.answers.storeProfile.description.trim());
  const supportLead = input.ownerEmail
    ? `Questions about shipping, returns, or your order? Reach us at ${input.ownerEmail}.`
    : `Questions about shipping, returns, or your order? Reach out and we’ll help.`;
  const aboutParagraphs = [
    storeDescription || category.aboutLead,
    `${storeName} is built around ${firstProductTitle.toLowerCase()} and a clear point of view that keeps the assortment focused.`,
    category.aboutExpect
  ];
  const emailDocument = buildEmailDocument(input, directionTheme.primaryColor, directionTheme.accentColor);

  return {
    provider: "deterministic",
    model: "deterministic-v1",
    output: {
      branding: {
        primaryColor: directionTheme.primaryColor,
        accentColor: directionTheme.accentColor,
        theme: {
          ...directionTheme,
          heroBrandDisplay: input.answers.branding.logoAssetPath ? "logo_and_title" : "title",
          heroShowLogo: Boolean(input.answers.branding.logoAssetPath),
          heroShowTitle: true,
          heroImageSize: "medium",
          showContentBlocks: true,
          showPolicyStrip: true,
          heroEyebrow: category.heroEyebrow,
          heroHeadline: storeDescription
            ? `${storeName} brings ${storeDescription.toLowerCase()} to life.`
            : `${storeName} is ready for a polished first reveal.`,
          heroSubcopy: firstProductDescription ? `${firstProductDescription} ${category.heroSubcopyTail}` : category.heroSubcopyTail,
          heroBadgeOne: firstProductTitle,
          heroBadgeTwo: input.answers.branding.visualDirection ? `${directionLabel} direction` : "AI-led direction",
          heroBadgeThree: input.firstProduct ? "First product included" : "Ready for products",
          headerShowLogo: Boolean(input.answers.branding.logoAssetPath),
          headerShowTitle: true,
          headerLogoSize: "medium",
          headerTitleSize: "medium",
          primaryForegroundColor: null,
          accentForegroundColor: null,
          homeShowHero: true,
          homeShowContentBlocks: true,
          homeShowFeaturedProducts: true,
          homeFeaturedProductsLimit: 6,
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
        announcement: category.announcement,
        fulfillmentMessage: "Packed carefully and updated promptly once each order is confirmed.",
        shippingPolicy: "Orders are reviewed quickly, packed with care, and sent with confirmation updates once they move into fulfillment.",
        returnPolicy: "If something arrives off or unexpected, reach out within 14 days so we can make it right.",
        footerTagline: storeDescription || `${directionLabel} essentials, chosen with care.`,
        footerNote: category.footerNote,
        seoTitle: `${storeName} | ${firstProductTitle}`,
        seoDescription: (storeDescription || `${category.productSeoLead} from ${storeName}.`).slice(0, 200),
        emailCaptureHeading: "Stay in the loop",
        emailCaptureDescription: category.emailCaptureDescription,
        emailCaptureSuccessMessage: `You're on the list for ${storeName}.`,
        welcomePopupEyebrow: "Welcome offer",
        welcomePopupHeadline: `Start with a warm hello from ${storeName}`,
        welcomePopupBody: category.welcomePopupBody,
        welcomePopupEmailPlaceholder: "Email address",
        welcomePopupCtaLabel: "Send my welcome offer",
        welcomePopupDeclineLabel: "Maybe later",
        checkoutLocalPickupLabel: "Local pickup",
        checkoutFlatRateShippingLabel: "Standard shipping",
        checkoutOrderNotePrompt: "Anything we should know before we prepare your order?"
      },
      home: {
        hero: {
          layout: directionTheme.heroLayout,
          brandDisplay: input.answers.branding.logoAssetPath ? "logo_and_title" : "title",
          eyebrow: category.heroEyebrow,
          headline: category.heroHeadline,
          subcopy: firstProductDescription ? `${firstProductDescription} ${category.heroSubcopyTail}` : category.heroSubcopyTail,
          badgeOne: firstProductTitle,
          badgeTwo: category.badgeTwo,
          badgeThree: category.badgeThree,
          imageSize: "medium",
          showLogo: Boolean(input.answers.branding.logoAssetPath),
          showTitle: true
        },
        contentBlocks: [
          {
            eyebrow: "Shop the lineup",
            title: category.browseBlockTitle,
            body: category.browseBlockBody,
            ctaLabel: "Browse products",
            ctaUrl: "/products"
          },
          {
            eyebrow: "Why customers come back",
            title: category.qualityBlockTitle,
            body: category.qualityBlockBody,
            ctaLabel: "About the shop",
            ctaUrl: "/about"
          },
          {
            eyebrow: "Order with confidence",
            title: category.trustBlockTitle,
            body: category.trustBlockBody,
            ctaLabel: "Read policies",
            ctaUrl: "/policies"
          }
        ]
      },
      about: {
        articleParagraphs: aboutParagraphs,
        sections: [
          {
            title: "Who we are",
            body: storeDescription || category.aboutLead,
            layout: "full"
          },
          {
            title: "What shoppers can expect",
            body: category.aboutExpect,
            layout: "image_right"
          },
          {
            title: "What you'll find here",
            body: `${firstProductTitle} is one of the featured items in a lineup built to stay practical, useful, and easy to shop.`,
            layout: "image_left"
          }
        ]
      },
      policies: {
        supportLead,
        faqs: [
          {
            question: "When will my order ship?",
            answer: "Orders are reviewed quickly and follow the current fulfillment timeline shown on the storefront."
          },
          {
            question: "Can I ask a question before ordering?",
            answer: input.ownerEmail
              ? `Yes. Reach out at ${input.ownerEmail} and we’ll help with product, shipping, or order questions.`
              : "Yes. Reach out through the store contact channel and we’ll help with product, shipping, or order questions."
          },
          {
            question: "What happens if something arrives wrong?",
            answer: "If there’s a problem with your order, reach out within 14 days so the store can help make it right."
          }
        ]
      },
      emails: emailDocument,
      product: {
        description:
          firstProductDescription ||
          `${firstProductTitle} is one of the featured products at ${storeName}.`,
        seoTitle: `${firstProductTitle} | ${storeName}`,
        seoDescription: `${firstProductTitle} from ${storeName}. ${(
          firstProductDescription || `${category.productSeoLead} from ${storeName}.`
        ).slice(0, 130)}`,
        imageAltText: `${firstProductTitle} from ${storeName}`
      }
    }
  };
}
