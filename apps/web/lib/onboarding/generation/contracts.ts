import { z } from "zod";
import type { OnboardingAnswers } from "@/lib/onboarding/workflow";

const hexColorSchema = z.string().regex(/^#([0-9A-Fa-f]{6})$/, "Expected a six-digit hex color.");
const pageWidthSchema = z.enum(["narrow", "standard", "wide"]);
const heroLayoutSchema = z.enum(["split", "centered"]);
const heroBrandDisplaySchema = z.enum(["title", "logo", "logo_and_title"]);
const heroImageSizeSchema = z.enum(["small", "medium", "large"]);
const productGridColumnsSchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);
const radiusScaleSchema = z.enum(["soft", "rounded", "sharp"]);
const cardStyleSchema = z.enum(["solid", "outline", "elevated", "integrated"]);
const spacingScaleSchema = z.enum(["compact", "comfortable", "airy"]);
const fontFamilySchema = z.enum(["fraunces-manrope", "avenir-next", "georgia", "palatino", "helvetica-neue", "trebuchet"]);
const filterLayoutSchema = z.enum(["sidebar", "topbar"]);
const ctaStyleSchema = z.enum(["primary", "accent", "outline"]);
const imageFitSchema = z.enum(["cover", "contain"]);
const reviewSortSchema = z.enum(["newest", "highest", "lowest"]);
const headerLogoSizeSchema = z.enum(["small", "medium", "large"]);
const headerTitleSizeSchema = z.enum(["small", "medium", "large"]);
const emailThemeRadiusSchema = z.enum(["sharp", "rounded", "pill"]);

const contentBlockSchema = z.object({
  eyebrow: z.string().trim().max(80),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(320),
  ctaLabel: z.string().trim().max(80).default(""),
  ctaUrl: z.string().trim().max(240).default("")
});

const aboutSectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1200),
  layout: z.enum(["image_left", "image_right", "full"])
});

const policyFaqSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1200)
});

const emailTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  preheader: z.string().trim().min(1).max(180),
  headline: z.string().trim().min(1).max(160),
  bodyParagraphs: z.array(z.string().trim().min(1).max(280)).min(2).max(6),
  ctaLabel: z.string().trim().min(1).max(80),
  footerNote: z.string().trim().min(1).max(200)
});

export const onboardingGenerationInputSchema = z.object({
  sessionId: z.string().uuid(),
  storeId: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  ownerEmail: z.string().email().nullable(),
  store: z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(160)
  }),
  answers: z.custom<OnboardingAnswers>(),
  firstProduct: z
    .object({
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().max(5000).default(""),
      priceCents: z.number().int().min(0),
      seoTitle: z.string().trim().nullable().optional(),
      seoDescription: z.string().trim().nullable().optional(),
      imageAltText: z.string().trim().nullable().optional()
    })
    .nullable()
});

export const onboardingStarterPackageSchema = z.object({
  branding: z.object({
    primaryColor: hexColorSchema,
    accentColor: hexColorSchema,
    theme: z.object({
      pageWidth: pageWidthSchema,
      heroLayout: heroLayoutSchema,
      heroBrandDisplay: heroBrandDisplaySchema,
      heroShowLogo: z.boolean(),
      heroShowTitle: z.boolean(),
      heroImageSize: heroImageSizeSchema,
      productGridColumns: productGridColumnsSchema,
      radiusScale: radiusScaleSchema,
      cardStyle: cardStyleSchema,
      spacingScale: spacingScaleSchema,
      fontFamily: fontFamilySchema,
      showContentBlocks: z.boolean(),
      showPolicyStrip: z.boolean(),
      heroEyebrow: z.string().trim().max(80),
      heroHeadline: z.string().trim().min(1).max(180),
      heroSubcopy: z.string().trim().min(1).max(320),
      heroBadgeOne: z.string().trim().max(80),
      heroBadgeTwo: z.string().trim().max(80),
      heroBadgeThree: z.string().trim().max(80),
      backgroundColor: hexColorSchema,
      surfaceColor: hexColorSchema,
      textColor: hexColorSchema,
      headerBackgroundColor: hexColorSchema,
      headerForegroundColor: hexColorSchema,
      headerShowLogo: z.boolean(),
      headerShowTitle: z.boolean(),
      headerLogoSize: headerLogoSizeSchema,
      headerTitleSize: headerTitleSizeSchema,
      primaryForegroundColor: hexColorSchema.nullable(),
      accentForegroundColor: hexColorSchema.nullable(),
      homeShowHero: z.boolean(),
      homeShowContentBlocks: z.boolean(),
      homeShowFeaturedProducts: z.boolean(),
      homeFeaturedProductsLimit: z.number().int().min(3).max(12),
      productsFilterLayout: filterLayoutSchema,
      productsFiltersDefaultOpen: z.boolean(),
      productsShowSearch: z.boolean(),
      productsShowSort: z.boolean(),
      productsShowAvailability: z.boolean(),
      productsShowOptionFilters: z.boolean(),
      productCardShowDescription: z.boolean(),
      productCardDescriptionLines: z.number().int().min(1).max(4),
      productCardShowFeaturedBadge: z.boolean(),
      productCardShowAvailability: z.boolean(),
      productCardShowQuickAdd: z.boolean(),
      productCardImageHoverZoom: z.boolean(),
      productCardShowCarouselArrows: z.boolean(),
      productCardShowCarouselDots: z.boolean(),
      productCardImageFit: imageFitSchema,
      primaryCtaStyle: ctaStyleSchema,
      reviewsEnabled: z.boolean(),
      reviewsShowOnHome: z.boolean(),
      reviewsShowOnProductDetail: z.boolean(),
      reviewsFormEnabled: z.boolean(),
      reviewsDefaultSort: reviewSortSchema,
      reviewsItemsPerPage: z.number().int().min(5).max(20),
      reviewsShowVerifiedBadge: z.boolean(),
      reviewsShowMediaGallery: z.boolean(),
      reviewsShowSummary: z.boolean()
    })
  }),
  settings: z.object({
    announcement: z.string().trim().max(300),
    fulfillmentMessage: z.string().trim().max(240),
    shippingPolicy: z.string().trim().max(2000),
    returnPolicy: z.string().trim().max(2000),
    footerTagline: z.string().trim().max(120),
    footerNote: z.string().trim().max(240),
    seoTitle: z.string().trim().max(120),
    seoDescription: z.string().trim().max(200),
    emailCaptureHeading: z.string().trim().max(120),
    emailCaptureDescription: z.string().trim().max(280),
    emailCaptureSuccessMessage: z.string().trim().max(180),
    welcomePopupEyebrow: z.string().trim().max(80),
    welcomePopupHeadline: z.string().trim().max(200),
    welcomePopupBody: z.string().trim().max(500),
    welcomePopupEmailPlaceholder: z.string().trim().max(120),
    welcomePopupCtaLabel: z.string().trim().max(120),
    welcomePopupDeclineLabel: z.string().trim().max(120),
    checkoutLocalPickupLabel: z.string().trim().max(120),
    checkoutFlatRateShippingLabel: z.string().trim().max(120),
    checkoutOrderNotePrompt: z.string().trim().max(300)
  }),
  home: z.object({
    hero: z.object({
      layout: heroLayoutSchema,
      brandDisplay: heroBrandDisplaySchema,
      eyebrow: z.string().trim().max(80),
      headline: z.string().trim().min(1).max(180),
      subcopy: z.string().trim().min(1).max(320),
      badgeOne: z.string().trim().max(80),
      badgeTwo: z.string().trim().max(80),
      badgeThree: z.string().trim().max(80),
      imageSize: heroImageSizeSchema,
      showLogo: z.boolean(),
      showTitle: z.boolean()
    }),
    contentBlocks: z.array(contentBlockSchema).min(2).max(4)
  }),
  about: z.object({
    articleParagraphs: z.array(z.string().trim().min(1).max(600)).min(2).max(5),
    sections: z.array(aboutSectionSchema).min(2).max(4)
  }),
  policies: z.object({
    supportLead: z.string().trim().min(1).max(240),
    faqs: z.array(policyFaqSchema).min(2).max(4)
  }),
  emails: z.object({
    senderName: z.string().trim().max(120),
    replyToEmail: z.string().trim().email().or(z.literal("")),
    theme: z.object({
      canvasColor: hexColorSchema,
      cardColor: hexColorSchema,
      textColor: hexColorSchema,
      mutedColor: hexColorSchema,
      accentColor: hexColorSchema,
      buttonTextColor: hexColorSchema,
      borderRadius: emailThemeRadiusSchema
    }),
    welcomeDiscount: emailTemplateSchema,
    customerConfirmation: emailTemplateSchema,
    ownerNewOrder: emailTemplateSchema
  }),
  product: z.object({
    description: z.string().trim().min(1).max(5000),
    seoTitle: z.string().trim().max(120),
    seoDescription: z.string().trim().max(200),
    imageAltText: z.string().trim().max(160)
  })
});

export type OnboardingGenerationInput = z.infer<typeof onboardingGenerationInputSchema>;
export type OnboardingStarterPackage = z.infer<typeof onboardingStarterPackageSchema>;

export type OnboardingGenerationProviderResult = {
  provider: string;
  model: string;
  output: OnboardingStarterPackage;
};
