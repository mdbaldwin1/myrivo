import type { StoreExperienceContentSection } from "@/lib/store-experience/content";
import { resolveStorefrontPresentation } from "@/lib/storefront/presentation";
import type { StorefrontRuntime } from "@/lib/storefront/runtime";

export type StorefrontStudioValidationIssue = {
  id: string;
  section: StoreExperienceContentSection | "settings";
  severity: "warning";
  message: string;
};

export function validateStorefrontStudio(runtime: StorefrontRuntime): StorefrontStudioValidationIssue[] {
  const presentation = resolveStorefrontPresentation(runtime);
  const issues: StorefrontStudioValidationIssue[] = [];

  if (!presentation.themeConfig.heroHeadline.trim()) {
    issues.push({
      id: "home-hero-headline",
      section: "home",
      severity: "warning",
      message: "Home hero headline is empty."
    });
  }

  if (presentation.themeConfig.homeShowContentBlocks && presentation.contentBlocks.filter((block) => block.is_active).length === 0) {
    issues.push({
      id: "home-content-blocks",
      section: "home",
      severity: "warning",
      message: "Home page is set to show content blocks, but no active content blocks are configured."
    });
  }

  if (!presentation.settings?.support_email?.trim()) {
    issues.push({
      id: "policies-support-email",
      section: "policiesPage",
      severity: "warning",
      message: "Policies page is missing a support email."
    });
  }

  if (!presentation.settings?.shipping_policy?.trim()) {
    issues.push({
      id: "policies-shipping-policy",
      section: "policiesPage",
      severity: "warning",
      message: "Shipping policy content is missing."
    });
  }

  if (!presentation.settings?.return_policy?.trim()) {
    issues.push({
      id: "policies-return-policy",
      section: "policiesPage",
      severity: "warning",
      message: "Return policy content is missing."
    });
  }

  if (presentation.settings?.email_capture_enabled && !presentation.settings.email_capture_heading?.trim()) {
    issues.push({
      id: "emails-capture-heading",
      section: "emails",
      severity: "warning",
      message: "Email capture is enabled without a heading."
    });
  }

  if ((presentation.settings?.checkout_enable_flat_rate_shipping ?? true) && !presentation.settings?.checkout_flat_rate_shipping_label?.trim()) {
    issues.push({
      id: "settings-shipping-label",
      section: "settings",
      severity: "warning",
      message: "Shipping is enabled without a storefront-facing label."
    });
  }

  if (presentation.settings?.checkout_enable_local_pickup && !presentation.settings?.checkout_local_pickup_label?.trim()) {
    issues.push({
      id: "settings-pickup-label",
      section: "settings",
      severity: "warning",
      message: "Pickup is enabled without a storefront-facing label."
    });
  }

  if (presentation.settings?.checkout_allow_order_note && !presentation.settings?.checkout_order_note_prompt?.trim()) {
    issues.push({
      id: "settings-order-note-prompt",
      section: "settings",
      severity: "warning",
      message: "Checkout order note is enabled without prompt copy."
    });
  }

  if (!presentation.settings?.seo_title?.trim()) {
    issues.push({
      id: "settings-seo-title",
      section: "settings",
      severity: "warning",
      message: "Storefront SEO title is missing."
    });
  }

  return issues;
}
