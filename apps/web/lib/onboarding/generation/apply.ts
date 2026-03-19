import { serializeEmailStudioDocument, buildDefaultEmailStudioDocument } from "@/lib/email-studio/model";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { createDefaultStoreExperienceContent, mapStoreExperienceContentRow } from "@/lib/store-experience/content";
import type { OnboardingGenerationInput, OnboardingStarterPackage } from "@/lib/onboarding/generation/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function escapeHtmlText(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function paragraphListToHtml(paragraphs: string[]) {
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtmlText(paragraph)}</p>`)
    .join("");
}

function buildEmailHtml(paragraphs: string[]) {
  return sanitizeRichTextHtml(
    paragraphs
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join("")
  );
}

function buildSectionIds(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

export async function applyOnboardingStarterPackage(input: {
  generationInput: OnboardingGenerationInput;
  starterPackage: OnboardingStarterPackage;
}) {
  const admin = createSupabaseAdminClient();
  const { generationInput, starterPackage } = input;

  const [brandingResult, settingsResult, experienceResult, productResult] = await Promise.all([
    admin.from("store_branding").upsert(
      {
        store_id: generationInput.storeId,
        primary_color: starterPackage.branding.primaryColor,
        accent_color: starterPackage.branding.accentColor,
        theme_json: starterPackage.branding.theme
      },
      { onConflict: "store_id" }
    ),
    admin.from("store_settings").upsert(
      {
        store_id: generationInput.storeId,
        support_email: generationInput.ownerEmail,
        fulfillment_message: starterPackage.settings.fulfillmentMessage,
        shipping_policy: starterPackage.settings.shippingPolicy,
        return_policy: starterPackage.settings.returnPolicy,
        announcement: starterPackage.settings.announcement,
        footer_tagline: starterPackage.settings.footerTagline,
        footer_note: starterPackage.settings.footerNote,
        seo_title: starterPackage.settings.seoTitle,
        seo_description: starterPackage.settings.seoDescription,
        about_article_html: paragraphListToHtml(starterPackage.about.articleParagraphs),
        about_sections: starterPackage.about.sections.map((section, index) => ({
          id: `about-${index + 1}`,
          title: section.title,
          body: section.body,
          imageUrl: null,
          layout: section.layout
        })),
        policy_faqs: starterPackage.policies.faqs.map((faq, index) => ({
          id: `policy-faq-${index + 1}`,
          question: faq.question,
          answer: faq.answer,
          sort_order: index,
          is_active: true
        })),
        email_capture_enabled: true,
        email_capture_heading: starterPackage.settings.emailCaptureHeading,
        email_capture_description: starterPackage.settings.emailCaptureDescription,
        email_capture_success_message: starterPackage.settings.emailCaptureSuccessMessage,
        welcome_popup_enabled: true,
        welcome_popup_eyebrow: starterPackage.settings.welcomePopupEyebrow,
        welcome_popup_headline: starterPackage.settings.welcomePopupHeadline,
        welcome_popup_body: starterPackage.settings.welcomePopupBody,
        welcome_popup_email_placeholder: starterPackage.settings.welcomePopupEmailPlaceholder,
        welcome_popup_cta_label: starterPackage.settings.welcomePopupCtaLabel,
        welcome_popup_decline_label: starterPackage.settings.welcomePopupDeclineLabel,
        welcome_popup_image_layout: "left",
        welcome_popup_delay_seconds: 6,
        welcome_popup_dismiss_days: 14,
        checkout_enable_local_pickup: true,
        checkout_local_pickup_label: starterPackage.settings.checkoutLocalPickupLabel,
        checkout_local_pickup_fee_cents: 0,
        checkout_enable_flat_rate_shipping: true,
        checkout_flat_rate_shipping_label: starterPackage.settings.checkoutFlatRateShippingLabel,
        checkout_flat_rate_shipping_fee_cents: 0,
        checkout_allow_order_note: true,
        checkout_order_note_prompt: starterPackage.settings.checkoutOrderNotePrompt
      },
      { onConflict: "store_id" }
    ),
    admin
      .from("store_experience_content")
      .select("store_id,home_json,products_page_json,about_page_json,policies_page_json,cart_page_json,order_summary_page_json,emails_json")
      .eq("store_id", generationInput.storeId)
      .maybeSingle(),
    generationInput.firstProduct
      ? admin
          .from("products")
          .update({
            description: starterPackage.product.description,
            seo_title: starterPackage.product.seoTitle,
            seo_description: starterPackage.product.seoDescription,
            image_alt_text: starterPackage.product.imageAltText
          })
          .eq("id", generationInput.firstProduct.id)
          .eq("store_id", generationInput.storeId)
      : Promise.resolve({ error: null } as { error: null })
  ]);

  if (brandingResult.error) {
    throw new Error(brandingResult.error.message);
  }
  if (settingsResult.error) {
    throw new Error(settingsResult.error.message);
  }
  if (experienceResult.error) {
    throw new Error(experienceResult.error.message);
  }
  if (productResult.error) {
    throw new Error(productResult.error.message);
  }

  const currentExperience = mapStoreExperienceContentRow(experienceResult.data);
  const emailDocument = buildDefaultEmailStudioDocument(generationInput.store.name);
  emailDocument.senderName = starterPackage.emails.senderName;
  emailDocument.replyToEmail = starterPackage.emails.replyToEmail;
  emailDocument.theme = starterPackage.emails.theme;
  emailDocument.templates.welcomeDiscount.subject = starterPackage.emails.welcomeDiscount.subject;
  emailDocument.templates.welcomeDiscount.preheader = starterPackage.emails.welcomeDiscount.preheader;
  emailDocument.templates.welcomeDiscount.headline = starterPackage.emails.welcomeDiscount.headline;
  emailDocument.templates.welcomeDiscount.bodyHtml = buildEmailHtml(starterPackage.emails.welcomeDiscount.bodyParagraphs);
  emailDocument.templates.welcomeDiscount.ctaLabel = starterPackage.emails.welcomeDiscount.ctaLabel;
  emailDocument.templates.welcomeDiscount.footerNote = starterPackage.emails.welcomeDiscount.footerNote;
  emailDocument.templates.customerConfirmation.subject = starterPackage.emails.customerConfirmation.subject;
  emailDocument.templates.customerConfirmation.preheader = starterPackage.emails.customerConfirmation.preheader;
  emailDocument.templates.customerConfirmation.headline = starterPackage.emails.customerConfirmation.headline;
  emailDocument.templates.customerConfirmation.bodyHtml = buildEmailHtml(starterPackage.emails.customerConfirmation.bodyParagraphs);
  emailDocument.templates.customerConfirmation.ctaLabel = starterPackage.emails.customerConfirmation.ctaLabel;
  emailDocument.templates.customerConfirmation.footerNote = starterPackage.emails.customerConfirmation.footerNote;
  emailDocument.templates.ownerNewOrder.subject = starterPackage.emails.ownerNewOrder.subject;
  emailDocument.templates.ownerNewOrder.preheader = starterPackage.emails.ownerNewOrder.preheader;
  emailDocument.templates.ownerNewOrder.headline = starterPackage.emails.ownerNewOrder.headline;
  emailDocument.templates.ownerNewOrder.bodyHtml = buildEmailHtml(starterPackage.emails.ownerNewOrder.bodyParagraphs);
  emailDocument.templates.ownerNewOrder.ctaLabel = starterPackage.emails.ownerNewOrder.ctaLabel;
  emailDocument.templates.ownerNewOrder.footerNote = starterPackage.emails.ownerNewOrder.footerNote;

  const nextExperience = {
    ...createDefaultStoreExperienceContent(),
    ...currentExperience,
    home: {
      ...currentExperience.home,
      announcement: starterPackage.settings.announcement,
      fulfillmentMessage: starterPackage.settings.fulfillmentMessage,
      hero: starterPackage.home.hero,
      contentBlocks: starterPackage.home.contentBlocks.map((block, index) => ({
        id: buildSectionIds("block", starterPackage.home.contentBlocks.length)[index],
        sortOrder: index,
        eyebrow: block.eyebrow,
        title: block.title,
        body: block.body,
        ctaLabel: block.ctaLabel || null,
        ctaUrl: block.ctaUrl || null,
        isActive: true
      }))
    },
    productsPage: {
      ...currentExperience.productsPage,
      layout: {
        filterLayout: starterPackage.branding.theme.productsFilterLayout,
        filtersDefaultOpen: starterPackage.branding.theme.productsFiltersDefaultOpen,
        gridColumns: starterPackage.branding.theme.productGridColumns
      },
      productCards: {
        showDescription: starterPackage.branding.theme.productCardShowDescription,
        descriptionLines: starterPackage.branding.theme.productCardDescriptionLines,
        showFeaturedBadge: starterPackage.branding.theme.productCardShowFeaturedBadge,
        showAvailability: starterPackage.branding.theme.productCardShowAvailability,
        showQuickAdd: starterPackage.branding.theme.productCardShowQuickAdd,
        imageHoverZoom: starterPackage.branding.theme.productCardImageHoverZoom,
        showCarouselArrows: starterPackage.branding.theme.productCardShowCarouselArrows,
        showCarouselDots: starterPackage.branding.theme.productCardShowCarouselDots,
        imageFit: starterPackage.branding.theme.productCardImageFit
      },
      reviews: {
        enabled: starterPackage.branding.theme.reviewsEnabled,
        showOnHome: starterPackage.branding.theme.reviewsShowOnHome,
        showOnProductDetail: starterPackage.branding.theme.reviewsShowOnProductDetail,
        formEnabled: starterPackage.branding.theme.reviewsFormEnabled,
        defaultSort: starterPackage.branding.theme.reviewsDefaultSort,
        itemsPerPage: starterPackage.branding.theme.reviewsItemsPerPage,
        showVerifiedBadge: starterPackage.branding.theme.reviewsShowVerifiedBadge,
        showMediaGallery: starterPackage.branding.theme.reviewsShowMediaGallery,
        showSummary: starterPackage.branding.theme.reviewsShowSummary
      },
      visibility: {
        showSearch: starterPackage.branding.theme.productsShowSearch,
        showSort: starterPackage.branding.theme.productsShowSort,
        showAvailability: starterPackage.branding.theme.productsShowAvailability,
        showOptionFilters: starterPackage.branding.theme.productsShowOptionFilters
      }
    },
    aboutPage: {
      ...currentExperience.aboutPage,
      aboutArticleHtml: paragraphListToHtml(starterPackage.about.articleParagraphs),
      aboutSections: starterPackage.about.sections.map((section, index) => ({
        id: `about-${index + 1}`,
        title: section.title,
        body: section.body,
        imageUrl: null,
        layout: section.layout
      }))
    },
    policiesPage: {
      ...currentExperience.policiesPage,
      supportEmail: generationInput.ownerEmail ?? "",
      supportLead: starterPackage.policies.supportLead,
      shippingPolicy: starterPackage.settings.shippingPolicy,
      returnPolicy: starterPackage.settings.returnPolicy,
      policyFaqs: starterPackage.policies.faqs.map((faq, index) => ({
        id: `policy-faq-${index + 1}`,
        question: faq.question,
        answer: faq.answer,
        sortOrder: index,
        isActive: true
      }))
    },
    cartPage: {
      ...currentExperience.cartPage
    },
    orderSummaryPage: {
      ...currentExperience.orderSummaryPage
    },
    emails: {
      ...currentExperience.emails,
      ...serializeEmailStudioDocument(emailDocument)
    }
  };

  const experienceUpsert = await admin.from("store_experience_content").upsert(
    {
      store_id: generationInput.storeId,
      home_json: nextExperience.home,
      products_page_json: nextExperience.productsPage,
      about_page_json: nextExperience.aboutPage,
      policies_page_json: nextExperience.policiesPage,
      cart_page_json: nextExperience.cartPage,
      order_summary_page_json: nextExperience.orderSummaryPage,
      emails_json: nextExperience.emails
    },
    { onConflict: "store_id" }
  );

  if (experienceUpsert.error) {
    throw new Error(experienceUpsert.error.message);
  }

  return {
    branding: {
      primaryColor: starterPackage.branding.primaryColor,
      accentColor: starterPackage.branding.accentColor
    },
    settings: {
      supportEmail: generationInput.ownerEmail,
      footerTagline: starterPackage.settings.footerTagline,
      seoTitle: starterPackage.settings.seoTitle
    },
    experienceSections: Object.keys(nextExperience),
    product: generationInput.firstProduct
      ? {
          id: generationInput.firstProduct.id,
          title: generationInput.firstProduct.title,
          seoTitle: starterPackage.product.seoTitle
        }
      : null
  };
}
