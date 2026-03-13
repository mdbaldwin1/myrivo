import { z } from "zod";

export const checkoutExperienceEditorSchema = z.object({
  checkout_allow_order_note: z.boolean(),
  checkout_order_note_prompt: z.string().trim().max(300)
});

export const shippingRulesEditorSchema = z.object({
  checkout_enable_flat_rate_shipping: z.boolean(),
  checkout_flat_rate_shipping_label: z.string().trim().max(120),
  checkout_flat_rate_shipping_fee_cents: z.number().int().min(0).max(250000)
});

const storeLegalDocumentEditorEntrySchema = z.object({
  source_mode: z.enum(["template", "custom"]),
  title_override: z.string().trim().max(120),
  body_markdown: z.string().trim().max(40000),
  variables_json: z.record(z.string(), z.string()),
  published_source_mode: z.enum(["template", "custom"]),
  published_template_version: z.string().trim().max(32),
  published_title: z.string().trim().max(120),
  published_body_markdown: z.string().trim().max(40000),
  published_variables_json: z.record(z.string(), z.string()),
  published_version: z.number().int().min(1),
  published_change_summary: z.string().trim().max(500).nullable(),
  effective_at: z.string().datetime().nullable(),
  published_at: z.string().datetime().nullable()
});

export const storePrivacyComplianceEditorSchema = z.object({
  notice_at_collection_enabled: z.boolean(),
  checkout_notice_enabled: z.boolean(),
  newsletter_notice_enabled: z.boolean(),
  review_notice_enabled: z.boolean(),
  show_california_notice: z.boolean(),
  show_do_not_sell_link: z.boolean(),
  privacy_contact_email: z.string().trim().email().or(z.literal("")),
  privacy_rights_email: z.string().trim().email().or(z.literal("")),
  privacy_contact_name: z.string().trim().max(120),
  collection_notice_addendum_markdown: z.string().trim().max(10000),
  california_notice_markdown: z.string().trim().max(15000),
  do_not_sell_markdown: z.string().trim().max(10000),
  request_page_intro_markdown: z.string().trim().max(10000)
});

export const storeLegalDocumentsEditorSchema = z.object({
  privacyCompliance: storePrivacyComplianceEditorSchema,
  privacy: storeLegalDocumentEditorEntrySchema,
  terms: storeLegalDocumentEditorEntrySchema
});

export type CheckoutExperienceEditorSnapshot = z.infer<typeof checkoutExperienceEditorSchema>;
export type ShippingRulesEditorSnapshot = z.infer<typeof shippingRulesEditorSchema>;
export type StorePrivacyComplianceEditorSnapshot = z.infer<typeof storePrivacyComplianceEditorSchema>;
export type StoreLegalDocumentsEditorSnapshot = z.infer<typeof storeLegalDocumentsEditorSchema>;
