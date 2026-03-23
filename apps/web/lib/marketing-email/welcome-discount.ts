import { getAppUrl, getServerEnv } from "@/lib/env";
import { createEmailStudioDocumentFromSection } from "@/lib/email-studio/model";
import { renderEmailStudioTemplate } from "@/lib/email-studio/render";
import { resolveMarketingEmailComplianceDefaults } from "@/lib/marketing-email/compliance";
import { sendTransactionalEmail } from "@/lib/notifications/email-provider";
import { resolveEffectiveReplyTo } from "@/lib/notifications/order-emails";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PromotionRecord, StoreSettingsRecord } from "@/types/database";

type WelcomeDiscountStore = {
  id: string;
  name: string;
  slug: string;
};

type WelcomeDiscountSettings = Pick<
  StoreSettingsRecord,
  | "support_email"
  | "seo_location_city"
  | "seo_location_region"
  | "seo_location_state"
  | "seo_location_postal_code"
  | "seo_location_country_code"
  | "seo_location_address_line1"
  | "seo_location_address_line2"
  | "seo_location_show_full_address"
> | {
  support_email: string | null;
  seo_location_city: string | null;
  seo_location_region: string | null;
  seo_location_state: string | null;
  seo_location_postal_code: string | null;
  seo_location_country_code: string | null;
  seo_location_address_line1: string | null;
  seo_location_address_line2: string | null;
  seo_location_show_full_address: boolean | null;
} | null;

type WelcomeDiscountPromotion = Pick<
  PromotionRecord,
  "code" | "discount_type" | "discount_value" | "min_subtotal_cents" | "ends_at"
>;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatPromotionLabel(promotion: WelcomeDiscountPromotion) {
  if (promotion.discount_type === "percent") {
    return `${promotion.discount_value}% off`;
  }
  return `${formatCurrency(promotion.discount_value)} off`;
}

function formatExpiryText(endsAt: string | null) {
  if (!endsAt) {
    return "";
  }

  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

async function loadEmailStudioDocument(storeId: string, storeName: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("store_experience_content")
    .select("emails_json")
    .eq("store_id", storeId)
    .maybeSingle<{ emails_json: Record<string, unknown> | null }>();

  if (error) {
    console.error("welcome discount email template load failed", error);
    return createEmailStudioDocumentFromSection({}, storeName);
  }

  return createEmailStudioDocumentFromSection(data?.emails_json ?? {}, storeName);
}

export async function sendWelcomeDiscountEmail(input: {
  store: WelcomeDiscountStore;
  settings: WelcomeDiscountSettings;
  promotion: WelcomeDiscountPromotion;
  recipientEmail: string;
}) {
  const compliance = resolveMarketingEmailComplianceDefaults(
    input.store,
    input.settings
      ? {
          ...input.settings,
          seo_location_show_full_address: Boolean(input.settings.seo_location_show_full_address)
        }
      : null
  );
  const emailDocument = await loadEmailStudioDocument(input.store.id, input.store.name);
  const template = emailDocument.templates.welcomeDiscount;
  const discountLabel = formatPromotionLabel(input.promotion);
  const expiryText = formatExpiryText(input.promotion.ends_at);
  const minimumSpendText = input.promotion.min_subtotal_cents > 0 ? formatCurrency(input.promotion.min_subtotal_cents) : "";
  const footerAddress = compliance.footerAddress ? `Mailing address: ${compliance.footerAddress}` : "";
  const appUrl = getAppUrl();
  const unsubscribeUrl = `${appUrl}${compliance.unsubscribeHref}`;
  const privacyUrl = `${appUrl}${compliance.privacyPolicyHref}`;
  const storeUrl = `${appUrl}/s/${input.store.slug}`;
  const replyTo = resolveEffectiveReplyTo(
    emailDocument.replyToEmail,
    input.settings?.support_email ?? null,
    getServerEnv().MYRIVO_EMAIL_REPLY_TO
  );
  const rendered = renderEmailStudioTemplate(
    template,
    {
      storeName: input.store.name,
      customerEmail: input.recipientEmail,
      supportEmail: input.settings?.support_email ?? "",
      replyToEmail: replyTo ?? "",
      storeUrl,
      discountCode: input.promotion.code,
      discountLabel,
      minimumSpend: minimumSpendText,
      offerExpiresOn: expiryText,
      unsubscribeUrl,
      privacyUrl,
      footerAddress
    },
    emailDocument.theme,
    input.store.name
  );

  return sendTransactionalEmail({
    from: `${(emailDocument.senderName.trim() || input.store.name).trim()} <${compliance.fromAddress}>`,
    to: [input.recipientEmail],
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    replyTo
  });
}
