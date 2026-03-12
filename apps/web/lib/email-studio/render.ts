import { richTextToPlainText, sanitizeRichTextHtml } from "@/lib/rich-text";
import type { EmailStudioTemplateDocument, EmailStudioThemeDocument } from "@/lib/email-studio/model";

type RenderedEmailStudioTemplate = {
  subject: string;
  preheader: string;
  headline: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyTemplateString(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((resolved, [key, value]) => resolved.replaceAll(`{${key}}`, value), template);
}

function applyTemplateHtml(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((resolved, [key, value]) => {
    const safeValue = escapeHtml(value).replaceAll("\n", "<br />");
    return resolved.replaceAll(`{${key}}`, safeValue);
  }, template);
}

function isSafeHref(href: string) {
  const normalized = href.trim().toLowerCase();
  return normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("mailto:") || normalized.startsWith("tel:");
}

function resolveRadiusValue(radius: EmailStudioThemeDocument["borderRadius"]) {
  switch (radius) {
    case "sharp":
      return "0px";
    case "pill":
      return "28px";
    default:
      return "18px";
  }
}

export function renderEmailStudioTemplate(
  template: EmailStudioTemplateDocument,
  values: Record<string, string>,
  theme: EmailStudioThemeDocument,
  storeName: string
): RenderedEmailStudioTemplate {
  const subject = applyTemplateString(template.subject, values).trim();
  const preheader = applyTemplateString(template.preheader, values).trim();
  const headline = applyTemplateString(template.headline, values).trim();
  const bodyHtml = sanitizeRichTextHtml(applyTemplateHtml(template.bodyHtml, values));
  const ctaLabel = applyTemplateString(template.ctaLabel, values).trim();
  const ctaUrl = applyTemplateString(template.ctaUrl, values).trim();
  const footerNote = applyTemplateString(template.footerNote, values).trim();
  const radius = resolveRadiusValue(theme.borderRadius);
  const safeCtaUrl = isSafeHref(ctaUrl) ? ctaUrl : "";

  const html = [
    "<!doctype html>",
    `<html><body style="margin:0;padding:0;background:${theme.canvasColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${theme.textColor};">`,
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.canvasColor};padding:24px 12px;">`,
    "<tr><td align=\"center\">",
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:${theme.cardColor};border-radius:${radius};overflow:hidden;border:1px solid rgba(15,23,42,0.08);">`,
    `<tr><td style="background:${theme.accentColor};padding:18px 24px;color:${theme.buttonTextColor};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(storeName)}</td></tr>`,
    "<tr><td style=\"padding:28px 24px 16px;\">",
    preheader ? `<p style="margin:0 0 12px;color:${theme.mutedColor};font-size:13px;line-height:20px;">${escapeHtml(preheader)}</p>` : "",
    headline ? `<h1 style="margin:0 0 16px;font-size:28px;line-height:34px;color:${theme.textColor};font-weight:700;">${escapeHtml(headline)}</h1>` : "",
    `<div style="font-size:15px;line-height:24px;color:${theme.textColor};">${bodyHtml}</div>`,
    safeCtaUrl && ctaLabel
      ? `<div style="padding-top:24px;"><a href="${escapeHtml(
          safeCtaUrl
        )}" style="display:inline-block;background:${theme.accentColor};color:${theme.buttonTextColor};text-decoration:none;padding:12px 18px;border-radius:${radius};font-size:14px;font-weight:600;">${escapeHtml(
          ctaLabel
        )}</a></div>`
      : "",
    footerNote ? `<p style="margin:24px 0 0;color:${theme.mutedColor};font-size:13px;line-height:20px;">${escapeHtml(footerNote)}</p>` : "",
    "</td></tr></table>",
    "</td></tr></table></body></html>"
  ]
    .filter(Boolean)
    .join("");

  const textParts = [
    preheader,
    headline,
    richTextToPlainText(bodyHtml),
    safeCtaUrl && ctaLabel ? `${ctaLabel}: ${safeCtaUrl}` : "",
    footerNote
  ].filter(Boolean);

  return {
    subject,
    preheader,
    headline,
    bodyHtml,
    ctaLabel,
    ctaUrl: safeCtaUrl,
    footerNote,
    html,
    text: textParts.join("\n\n")
  };
}
