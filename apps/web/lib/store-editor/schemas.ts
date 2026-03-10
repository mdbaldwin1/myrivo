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

export type CheckoutExperienceEditorSnapshot = z.infer<typeof checkoutExperienceEditorSchema>;
export type ShippingRulesEditorSnapshot = z.infer<typeof shippingRulesEditorSchema>;
