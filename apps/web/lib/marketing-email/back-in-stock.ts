import { getExternalAppUrl } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email-provider";
import { resolveEffectiveReplyTo } from "@/lib/notifications/order-emails";
import { resolvePlatformNotificationFromAddress } from "@/lib/notifications/sender";
import { buildStorefrontProductPath } from "@/lib/storefront/paths";

type BackInStockEmailInput = {
  store: {
    name: string;
    slug: string;
    supportEmail: string | null;
  };
  product: {
    title: string;
    slug: string;
  };
  variant: {
    title: string | null;
  };
  recipientEmail: string;
};

export async function sendBackInStockEmail(input: BackInStockEmailInput) {
  const storefrontUrl = `${getExternalAppUrl()}${buildStorefrontProductPath(input.store.slug, input.product.slug)}`;
  const variantLabel = input.variant.title?.trim() ? `Variant: ${input.variant.title.trim()}\n` : "";
  const subject = `${input.product.title} is back in stock at ${input.store.name}`;
  const text = [
    `Good news. ${input.product.title} is back in stock at ${input.store.name}.`,
    variantLabel.trim(),
    `Shop now: ${storefrontUrl}`,
    input.store.supportEmail ? `Questions? Reply to ${input.store.supportEmail}.` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <p>Good news. <strong>${input.product.title}</strong> is back in stock at <strong>${input.store.name}</strong>.</p>
      ${input.variant.title?.trim() ? `<p><strong>Variant:</strong> ${input.variant.title.trim()}</p>` : ""}
      <p><a href="${storefrontUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;">Shop now</a></p>
      <p style="font-size:14px;color:#4b5563;">${input.store.supportEmail ? `Questions? Reply to ${input.store.supportEmail}.` : ""}</p>
    </div>
  `;

  return sendTransactionalEmail({
    from: resolvePlatformNotificationFromAddress(),
    to: [input.recipientEmail],
    subject,
    text,
    html,
    replyTo: resolveEffectiveReplyTo(null, input.store.supportEmail, null)
  });
}
