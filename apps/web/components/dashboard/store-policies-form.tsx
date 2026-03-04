"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Flyout } from "@/components/ui/flyout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StoreSettingsRecord } from "@/types/database";

type AboutSectionDraft = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  layout: "image_left" | "image_right" | "full";
};

type PolicyFaqDraft = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

function createAboutSectionDraft(): AboutSectionDraft {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    body: "",
    imageUrl: "",
    layout: "image_right"
  };
}

function createPolicyFaqDraft(sortOrder: number): PolicyFaqDraft {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: "",
    answer: "",
    sortOrder,
    isActive: true
  };
}

function normalizeAboutSections(input: StoreSettingsRecord["about_sections"] | null | undefined): AboutSectionDraft[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((section): AboutSectionDraft | null => {
      if (!section || typeof section !== "object") {
        return null;
      }
      const record = section as Record<string, unknown>;
      const id = typeof record.id === "string" && record.id.trim().length > 0 ? record.id : createAboutSectionDraft().id;
      const title = typeof record.title === "string" ? record.title : "";
      const body = typeof record.body === "string" ? record.body : "";
      const imageUrl = typeof record.imageUrl === "string" ? record.imageUrl : "";
      const layout = record.layout === "image_left" || record.layout === "image_right" || record.layout === "full" ? record.layout : "image_right";
      return { id, title, body, imageUrl, layout };
    })
    .filter((section): section is AboutSectionDraft => section !== null);
}

function normalizePolicyFaqs(input: StoreSettingsRecord["policy_faqs"] | null | undefined): PolicyFaqDraft[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((faq, index): PolicyFaqDraft | null => {
      if (!faq || typeof faq !== "object") {
        return null;
      }
      const record = faq as Record<string, unknown>;
      const id = typeof record.id === "string" && record.id.trim().length > 0 ? record.id : createPolicyFaqDraft(index).id;
      const question = typeof record.question === "string" ? record.question : "";
      const answer = typeof record.answer === "string" ? record.answer : "";
      const sortOrder = typeof record.sort_order === "number" ? record.sort_order : index;
      const isActive = typeof record.is_active === "boolean" ? record.is_active : true;
      return { id, question, answer, sortOrder, isActive };
    })
    .filter((faq): faq is PolicyFaqDraft => faq !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

type StorePoliciesFormProps = {
  initialSettings: Pick<
    StoreSettingsRecord,
    | "support_email"
    | "fulfillment_message"
    | "shipping_policy"
    | "return_policy"
    | "announcement"
    | "footer_tagline"
    | "footer_note"
    | "instagram_url"
    | "facebook_url"
    | "tiktok_url"
    | "policy_faqs"
    | "about_article_html"
    | "about_sections"
    | "storefront_copy_json"
    | "email_capture_enabled"
    | "email_capture_heading"
    | "email_capture_description"
    | "email_capture_success_message"
    | "checkout_enable_local_pickup"
    | "checkout_local_pickup_label"
    | "checkout_local_pickup_fee_cents"
    | "checkout_enable_flat_rate_shipping"
    | "checkout_flat_rate_shipping_label"
    | "checkout_flat_rate_shipping_fee_cents"
    | "checkout_allow_order_note"
    | "checkout_order_note_prompt"
  > | null;
  inlineEditor?: boolean;
  mode?: "all" | "policies" | "checkout" | "content";
  title?: string;
};

type StoreSettingsResponse = {
  settings?: Pick<
    StoreSettingsRecord,
    | "support_email"
    | "fulfillment_message"
    | "shipping_policy"
    | "return_policy"
    | "announcement"
    | "footer_tagline"
    | "footer_note"
    | "instagram_url"
    | "facebook_url"
    | "tiktok_url"
    | "policy_faqs"
    | "about_article_html"
    | "about_sections"
    | "storefront_copy_json"
    | "email_capture_enabled"
    | "email_capture_heading"
    | "email_capture_description"
    | "email_capture_success_message"
    | "checkout_enable_local_pickup"
    | "checkout_local_pickup_label"
    | "checkout_local_pickup_fee_cents"
    | "checkout_enable_flat_rate_shipping"
    | "checkout_flat_rate_shipping_label"
    | "checkout_flat_rate_shipping_fee_cents"
    | "checkout_allow_order_note"
    | "checkout_order_note_prompt"
  >;
  error?: string;
};

export function StorePoliciesForm({
  initialSettings,
  inlineEditor = true,
  mode = "all",
  title
}: StorePoliciesFormProps) {
  const [supportEmail, setSupportEmail] = useState(initialSettings?.support_email ?? "");
  const [announcement, setAnnouncement] = useState(initialSettings?.announcement ?? "");
  const [fulfillmentMessage, setFulfillmentMessage] = useState(initialSettings?.fulfillment_message ?? "");
  const [shippingPolicy, setShippingPolicy] = useState(initialSettings?.shipping_policy ?? "");
  const [returnPolicy, setReturnPolicy] = useState(initialSettings?.return_policy ?? "");
  const [footerTagline, setFooterTagline] = useState(initialSettings?.footer_tagline ?? "");
  const [footerNote, setFooterNote] = useState(initialSettings?.footer_note ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initialSettings?.instagram_url ?? "");
  const [facebookUrl, setFacebookUrl] = useState(initialSettings?.facebook_url ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(initialSettings?.tiktok_url ?? "");
  const [policyFaqs, setPolicyFaqs] = useState<PolicyFaqDraft[]>(normalizePolicyFaqs(initialSettings?.policy_faqs));
  const [aboutArticleHtml, setAboutArticleHtml] = useState(initialSettings?.about_article_html ?? "");
  const [aboutSections, setAboutSections] = useState<AboutSectionDraft[]>(normalizeAboutSections(initialSettings?.about_sections));
  const [storefrontCopyJson, setStorefrontCopyJson] = useState(() =>
    JSON.stringify(initialSettings?.storefront_copy_json ?? {}, null, 2)
  );
  const [emailCaptureEnabled, setEmailCaptureEnabled] = useState(initialSettings?.email_capture_enabled ?? false);
  const [emailCaptureHeading, setEmailCaptureHeading] = useState(initialSettings?.email_capture_heading ?? "");
  const [emailCaptureDescription, setEmailCaptureDescription] = useState(initialSettings?.email_capture_description ?? "");
  const [emailCaptureSuccessMessage, setEmailCaptureSuccessMessage] = useState(initialSettings?.email_capture_success_message ?? "");
  const [checkoutEnableLocalPickup, setCheckoutEnableLocalPickup] = useState(initialSettings?.checkout_enable_local_pickup ?? false);
  const [checkoutLocalPickupLabel, setCheckoutLocalPickupLabel] = useState(initialSettings?.checkout_local_pickup_label ?? "Porch pickup");
  const [checkoutLocalPickupFeeCents, setCheckoutLocalPickupFeeCents] = useState(
    String(initialSettings?.checkout_local_pickup_fee_cents ?? 0)
  );
  const [checkoutEnableFlatRateShipping, setCheckoutEnableFlatRateShipping] = useState(
    initialSettings?.checkout_enable_flat_rate_shipping ?? true
  );
  const [checkoutFlatRateShippingLabel, setCheckoutFlatRateShippingLabel] = useState(
    initialSettings?.checkout_flat_rate_shipping_label ?? "Shipped (flat fee)"
  );
  const [checkoutFlatRateShippingFeeCents, setCheckoutFlatRateShippingFeeCents] = useState(
    String(initialSettings?.checkout_flat_rate_shipping_fee_cents ?? 0)
  );
  const [checkoutAllowOrderNote, setCheckoutAllowOrderNote] = useState(initialSettings?.checkout_allow_order_note ?? false);
  const [checkoutOrderNotePrompt, setCheckoutOrderNotePrompt] = useState(
    initialSettings?.checkout_order_note_prompt ?? "If you have any questions, comments, or concerns about your order, leave a note below."
  );
  const [savedValues, setSavedValues] = useState({
    supportEmail: initialSettings?.support_email ?? "",
    announcement: initialSettings?.announcement ?? "",
    fulfillmentMessage: initialSettings?.fulfillment_message ?? "",
    shippingPolicy: initialSettings?.shipping_policy ?? "",
    returnPolicy: initialSettings?.return_policy ?? "",
    footerTagline: initialSettings?.footer_tagline ?? "",
    footerNote: initialSettings?.footer_note ?? "",
    instagramUrl: initialSettings?.instagram_url ?? "",
    facebookUrl: initialSettings?.facebook_url ?? "",
    tiktokUrl: initialSettings?.tiktok_url ?? "",
    policyFaqs: normalizePolicyFaqs(initialSettings?.policy_faqs),
    aboutArticleHtml: initialSettings?.about_article_html ?? "",
    aboutSections: normalizeAboutSections(initialSettings?.about_sections),
    storefrontCopyJson: JSON.stringify(initialSettings?.storefront_copy_json ?? {}, null, 2),
    emailCaptureEnabled: initialSettings?.email_capture_enabled ?? false,
    emailCaptureHeading: initialSettings?.email_capture_heading ?? "",
    emailCaptureDescription: initialSettings?.email_capture_description ?? "",
    emailCaptureSuccessMessage: initialSettings?.email_capture_success_message ?? "",
    checkoutEnableLocalPickup: initialSettings?.checkout_enable_local_pickup ?? false,
    checkoutLocalPickupLabel: initialSettings?.checkout_local_pickup_label ?? "Porch pickup",
    checkoutLocalPickupFeeCents: String(initialSettings?.checkout_local_pickup_fee_cents ?? 0),
    checkoutEnableFlatRateShipping: initialSettings?.checkout_enable_flat_rate_shipping ?? true,
    checkoutFlatRateShippingLabel: initialSettings?.checkout_flat_rate_shipping_label ?? "Shipped (flat fee)",
    checkoutFlatRateShippingFeeCents: String(initialSettings?.checkout_flat_rate_shipping_fee_cents ?? 0),
    checkoutAllowOrderNote: initialSettings?.checkout_allow_order_note ?? false,
    checkoutOrderNotePrompt:
      initialSettings?.checkout_order_note_prompt ??
      "If you have any questions, comments, or concerns about your order, leave a note below."
  });
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flyoutError, setFlyoutError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isPoliciesMode = mode === "all" || mode === "policies";
  const isCheckoutMode = mode === "all" || mode === "checkout";
  const isContentMode = mode === "all" || mode === "content";
  const cardTitle =
    title ??
    (mode === "policies"
      ? "Policies and Contact"
      : mode === "checkout"
        ? "Checkout and Fulfillment"
        : mode === "content"
          ? "Storefront Copy and Content"
          : "Shop Policies and Contact");
  const isDirty =
    supportEmail !== savedValues.supportEmail ||
    announcement !== savedValues.announcement ||
    fulfillmentMessage !== savedValues.fulfillmentMessage ||
    shippingPolicy !== savedValues.shippingPolicy ||
    returnPolicy !== savedValues.returnPolicy ||
    footerTagline !== savedValues.footerTagline ||
    footerNote !== savedValues.footerNote ||
    instagramUrl !== savedValues.instagramUrl ||
    facebookUrl !== savedValues.facebookUrl ||
    tiktokUrl !== savedValues.tiktokUrl ||
    JSON.stringify(policyFaqs) !== JSON.stringify(savedValues.policyFaqs) ||
    aboutArticleHtml !== savedValues.aboutArticleHtml ||
    JSON.stringify(aboutSections) !== JSON.stringify(savedValues.aboutSections) ||
    storefrontCopyJson !== savedValues.storefrontCopyJson ||
    emailCaptureEnabled !== savedValues.emailCaptureEnabled ||
    emailCaptureHeading !== savedValues.emailCaptureHeading ||
    emailCaptureDescription !== savedValues.emailCaptureDescription ||
    emailCaptureSuccessMessage !== savedValues.emailCaptureSuccessMessage ||
    checkoutEnableLocalPickup !== savedValues.checkoutEnableLocalPickup ||
    checkoutLocalPickupLabel !== savedValues.checkoutLocalPickupLabel ||
    checkoutLocalPickupFeeCents !== savedValues.checkoutLocalPickupFeeCents ||
    checkoutEnableFlatRateShipping !== savedValues.checkoutEnableFlatRateShipping ||
    checkoutFlatRateShippingLabel !== savedValues.checkoutFlatRateShippingLabel ||
    checkoutFlatRateShippingFeeCents !== savedValues.checkoutFlatRateShippingFeeCents ||
    checkoutAllowOrderNote !== savedValues.checkoutAllowOrderNote ||
    checkoutOrderNotePrompt !== savedValues.checkoutOrderNotePrompt;

  function resetDraftFromSaved() {
    setSupportEmail(savedValues.supportEmail);
    setAnnouncement(savedValues.announcement);
    setFulfillmentMessage(savedValues.fulfillmentMessage);
    setShippingPolicy(savedValues.shippingPolicy);
    setReturnPolicy(savedValues.returnPolicy);
    setFooterTagline(savedValues.footerTagline);
    setFooterNote(savedValues.footerNote);
    setInstagramUrl(savedValues.instagramUrl);
    setFacebookUrl(savedValues.facebookUrl);
    setTiktokUrl(savedValues.tiktokUrl);
    setPolicyFaqs(savedValues.policyFaqs);
    setAboutArticleHtml(savedValues.aboutArticleHtml);
    setAboutSections(savedValues.aboutSections);
    setStorefrontCopyJson(savedValues.storefrontCopyJson);
    setEmailCaptureEnabled(savedValues.emailCaptureEnabled);
    setEmailCaptureHeading(savedValues.emailCaptureHeading);
    setEmailCaptureDescription(savedValues.emailCaptureDescription);
    setEmailCaptureSuccessMessage(savedValues.emailCaptureSuccessMessage);
    setCheckoutEnableLocalPickup(savedValues.checkoutEnableLocalPickup);
    setCheckoutLocalPickupLabel(savedValues.checkoutLocalPickupLabel);
    setCheckoutLocalPickupFeeCents(savedValues.checkoutLocalPickupFeeCents);
    setCheckoutEnableFlatRateShipping(savedValues.checkoutEnableFlatRateShipping);
    setCheckoutFlatRateShippingLabel(savedValues.checkoutFlatRateShippingLabel);
    setCheckoutFlatRateShippingFeeCents(savedValues.checkoutFlatRateShippingFeeCents);
    setCheckoutAllowOrderNote(savedValues.checkoutAllowOrderNote);
    setCheckoutOrderNotePrompt(savedValues.checkoutOrderNotePrompt);
    setFlyoutError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      resetDraftFromSaved();
      return;
    }
    setSaving(true);
    setFlyoutError(null);
    setMessage(null);

    let parsedStorefrontCopy: Record<string, unknown> = {};
    if (isContentMode) {
      try {
        const parsed = JSON.parse(storefrontCopyJson || "{}") as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setFlyoutError("Storefront copy overrides must be a JSON object.");
          setSaving(false);
          return;
        }
        parsedStorefrontCopy = parsed as Record<string, unknown>;
      } catch {
        setFlyoutError("Storefront copy overrides must be valid JSON.");
        setSaving(false);
        return;
      }
    }

    const localPickupFeeCents = Number.parseInt(checkoutLocalPickupFeeCents || "0", 10);
    const flatRateShippingFeeCents = Number.parseInt(checkoutFlatRateShippingFeeCents || "0", 10);

    if (isCheckoutMode) {
      if (!Number.isInteger(localPickupFeeCents) || localPickupFeeCents < 0) {
        setFlyoutError("Local pickup fee must be a valid non-negative amount in cents.");
        setSaving(false);
        return;
      }

      if (!Number.isInteger(flatRateShippingFeeCents) || flatRateShippingFeeCents < 0) {
        setFlyoutError("Shipping fee must be a valid non-negative amount in cents.");
        setSaving(false);
        return;
      }
    }

    const requestBody: Record<string, unknown> = {};

    if (isPoliciesMode) {
      requestBody.supportEmail = supportEmail.trim() || null;
      requestBody.shippingPolicy = shippingPolicy.trim() || null;
      requestBody.returnPolicy = returnPolicy.trim() || null;
      requestBody.instagramUrl = instagramUrl.trim() || null;
      requestBody.facebookUrl = facebookUrl.trim() || null;
      requestBody.tiktokUrl = tiktokUrl.trim() || null;
    }

    if (isCheckoutMode) {
      requestBody.fulfillmentMessage = fulfillmentMessage.trim() || null;
      requestBody.checkoutEnableLocalPickup = checkoutEnableLocalPickup;
      requestBody.checkoutLocalPickupLabel = checkoutLocalPickupLabel.trim() || null;
      requestBody.checkoutLocalPickupFeeCents = localPickupFeeCents;
      requestBody.checkoutEnableFlatRateShipping = checkoutEnableFlatRateShipping;
      requestBody.checkoutFlatRateShippingLabel = checkoutFlatRateShippingLabel.trim() || null;
      requestBody.checkoutFlatRateShippingFeeCents = flatRateShippingFeeCents;
      requestBody.checkoutAllowOrderNote = checkoutAllowOrderNote;
      requestBody.checkoutOrderNotePrompt = checkoutOrderNotePrompt.trim() || null;
    }

    if (isContentMode) {
      requestBody.announcement = announcement.trim() || null;
      requestBody.footerTagline = footerTagline.trim() || null;
      requestBody.footerNote = footerNote.trim() || null;
      requestBody.policyFaqs = policyFaqs.map((faq, index) => ({
        id: faq.id,
        question: faq.question.trim(),
        answer: faq.answer.trim(),
        sortOrder: index,
        isActive: faq.isActive
      }));
      requestBody.aboutArticleHtml = aboutArticleHtml.trim() || null;
      requestBody.aboutSections = aboutSections.map((section) => ({
        id: section.id,
        title: section.title.trim(),
        body: section.body.trim(),
        imageUrl: section.imageUrl.trim() || null,
        layout: section.layout
      }));
      requestBody.storefrontCopy = parsedStorefrontCopy;
      requestBody.emailCaptureEnabled = emailCaptureEnabled;
      requestBody.emailCaptureHeading = emailCaptureHeading.trim() || null;
      requestBody.emailCaptureDescription = emailCaptureDescription.trim() || null;
      requestBody.emailCaptureSuccessMessage = emailCaptureSuccessMessage.trim() || null;
    }

    const response = await fetch("/api/stores/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const payload = (await response.json()) as StoreSettingsResponse;

    setSaving(false);

    if (!response.ok || !payload.settings) {
      setFlyoutError(payload.error ?? "Unable to save policies.");
      return;
    }

    setSavedValues({
      supportEmail: payload.settings.support_email ?? "",
      announcement: payload.settings.announcement ?? "",
      fulfillmentMessage: payload.settings.fulfillment_message ?? "",
      shippingPolicy: payload.settings.shipping_policy ?? "",
      returnPolicy: payload.settings.return_policy ?? "",
      footerTagline: payload.settings.footer_tagline ?? "",
      footerNote: payload.settings.footer_note ?? "",
      instagramUrl: payload.settings.instagram_url ?? "",
      facebookUrl: payload.settings.facebook_url ?? "",
      tiktokUrl: payload.settings.tiktok_url ?? "",
      policyFaqs: normalizePolicyFaqs(payload.settings.policy_faqs),
      aboutArticleHtml: payload.settings.about_article_html ?? "",
      aboutSections: normalizeAboutSections(payload.settings.about_sections),
      storefrontCopyJson: JSON.stringify(payload.settings.storefront_copy_json ?? {}, null, 2),
      emailCaptureEnabled: payload.settings.email_capture_enabled ?? false,
      emailCaptureHeading: payload.settings.email_capture_heading ?? "",
      emailCaptureDescription: payload.settings.email_capture_description ?? "",
      emailCaptureSuccessMessage: payload.settings.email_capture_success_message ?? "",
      checkoutEnableLocalPickup: payload.settings.checkout_enable_local_pickup ?? false,
      checkoutLocalPickupLabel: payload.settings.checkout_local_pickup_label ?? "Porch pickup",
      checkoutLocalPickupFeeCents: String(payload.settings.checkout_local_pickup_fee_cents ?? 0),
      checkoutEnableFlatRateShipping: payload.settings.checkout_enable_flat_rate_shipping ?? true,
      checkoutFlatRateShippingLabel: payload.settings.checkout_flat_rate_shipping_label ?? "Shipped (flat fee)",
      checkoutFlatRateShippingFeeCents: String(payload.settings.checkout_flat_rate_shipping_fee_cents ?? 0),
      checkoutAllowOrderNote: payload.settings.checkout_allow_order_note ?? false,
      checkoutOrderNotePrompt:
        payload.settings.checkout_order_note_prompt ??
        "If you have any questions, comments, or concerns about your order, leave a note below."
    });
    setStorefrontCopyJson(JSON.stringify(payload.settings.storefront_copy_json ?? {}, null, 2));
    setEmailCaptureEnabled(payload.settings.email_capture_enabled ?? false);
    setEmailCaptureHeading(payload.settings.email_capture_heading ?? "");
    setEmailCaptureDescription(payload.settings.email_capture_description ?? "");
    setEmailCaptureSuccessMessage(payload.settings.email_capture_success_message ?? "");
    setCheckoutEnableLocalPickup(payload.settings.checkout_enable_local_pickup ?? false);
    setCheckoutLocalPickupLabel(payload.settings.checkout_local_pickup_label ?? "Porch pickup");
    setCheckoutLocalPickupFeeCents(String(payload.settings.checkout_local_pickup_fee_cents ?? 0));
    setCheckoutEnableFlatRateShipping(payload.settings.checkout_enable_flat_rate_shipping ?? true);
    setCheckoutFlatRateShippingLabel(payload.settings.checkout_flat_rate_shipping_label ?? "Shipped (flat fee)");
    setCheckoutFlatRateShippingFeeCents(String(payload.settings.checkout_flat_rate_shipping_fee_cents ?? 0));
    setCheckoutAllowOrderNote(payload.settings.checkout_allow_order_note ?? false);
    setCheckoutOrderNotePrompt(
      payload.settings.checkout_order_note_prompt ??
        "If you have any questions, comments, or concerns about your order, leave a note below."
    );
    setMessage(
      mode === "policies"
        ? "Policies and contact settings saved."
        : mode === "checkout"
          ? "Checkout and fulfillment settings saved."
          : mode === "content"
            ? "Storefront content settings saved."
            : "Policies and contact settings saved."
    );
    if (!inlineEditor) {
      setIsFlyoutOpen(false);
    }
  }

  return (
    <SectionCard
      title={cardTitle}
      action={
        inlineEditor ? undefined : (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsFlyoutOpen(true)}>
            Edit
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {inlineEditor ? null : (
          <div className="rounded-lg bg-muted/35 p-3 text-sm">
            <p>
              Support email: <span className="font-medium">{supportEmail || "Not set"}</span>
            </p>
            <p>
              Announcement: <span className="font-medium">{announcement || "Not set"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Footer links configured: {[instagramUrl, facebookUrl, tiktokUrl].filter((value) => value.trim().length > 0).length}
            </p>
            <p className="text-xs text-muted-foreground">
              FAQs: {policyFaqs.length} · About article: {aboutArticleHtml.trim() ? "Configured" : "Not set"} · Sections: {aboutSections.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Newsletter signup: {emailCaptureEnabled ? "Enabled" : "Disabled"}
            </p>
            <p className="text-xs text-muted-foreground">
              Checkout options: {checkoutEnableLocalPickup ? "Pickup on" : "Pickup off"} · {checkoutEnableFlatRateShipping ? "Shipping on" : "Shipping off"} ·{" "}
              {checkoutAllowOrderNote ? "Buyer note on" : "Buyer note off"}
            </p>
          </div>
        )}
        <FeedbackMessage type="success" message={message} />
      </div>

      <Flyout
        inline={inlineEditor}
        open={inlineEditor ? true : isFlyoutOpen}
        onOpenChange={(open) => {
          setIsFlyoutOpen(open);
          if (!open && !inlineEditor) {
            resetDraftFromSaved();
          }
        }}
        confirmDiscardOnClose={!inlineEditor}
        isDirty={isDirty}
        onDiscardConfirm={resetDraftFromSaved}
        title={inlineEditor ? undefined : "Edit Shop Policies and Contact"}
        description={inlineEditor ? undefined : "Update announcement text, support details, policy copy, and footer/social content."}
        footer={({ requestClose }) => (
          <div className="flex justify-end gap-2">
            {inlineEditor ? null : (
              <Button type="button" variant="outline" onClick={requestClose}>
                Close
              </Button>
            )}
            {inlineEditor ? null : (
              <Button type="submit" form="store-policies-form" disabled={saving}>
                {saving ? "Saving..." : "Save policies"}
              </Button>
            )}
          </div>
        )}
      >
        <form id="store-policies-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {isPoliciesMode ? (
              <FormField label="Support Email" className="sm:col-span-2" description="Public support contact shown on policies and checkout messaging.">
                <Input
                  type="email"
                  value={supportEmail}
                  onChange={(event) => setSupportEmail(event.target.value)}
                  placeholder="support@yourshop.com"
                />
              </FormField>
            ) : null}
            {isContentMode ? (
              <FormField label="Announcement Bar Text" className="sm:col-span-2" description="Short top-of-site message for promotions or shipping updates.">
                <Input
                  value={announcement}
                  onChange={(event) => setAnnouncement(event.target.value)}
                  maxLength={300}
                  placeholder="Free local pickup every Friday"
                />
              </FormField>
            ) : null}
            {isCheckoutMode ? (
              <FormField label="Fulfillment Message" className="sm:col-span-2" description="Displayed in storefront sections to set delivery expectations.">
                <Textarea
                  rows={2}
                  value={fulfillmentMessage}
                  onChange={(event) => setFulfillmentMessage(event.target.value)}
                  placeholder="Small-batch orders ship in 2-4 business days"
                />
              </FormField>
            ) : null}
            {isPoliciesMode ? (
              <FormField label="Shipping Policy" description="Public shipping policy text shown on the policies page.">
                <Textarea
                  rows={4}
                  placeholder="Orders ship within 2-4 business days. Tracking is emailed once fulfilled."
                  value={shippingPolicy}
                  onChange={(event) => setShippingPolicy(event.target.value)}
                />
              </FormField>
            ) : null}
            {isPoliciesMode ? (
              <FormField label="Return Policy" description="Explain return windows, eligibility, and condition requirements.">
                <Textarea
                  rows={4}
                  placeholder="Returns accepted within 14 days for unopened products."
                  value={returnPolicy}
                  onChange={(event) => setReturnPolicy(event.target.value)}
                />
              </FormField>
            ) : null}
            {isContentMode ? (
              <FormField label="Footer Tagline" className="sm:col-span-2">
                <Input
                  value={footerTagline}
                  onChange={(event) => setFooterTagline(event.target.value)}
                  maxLength={120}
                  placeholder="Clean ingredients. Intentional routines. Everyday care."
                />
              </FormField>
            ) : null}
            {isContentMode ? (
              <FormField label="Footer Note" className="sm:col-span-2">
                <Input
                  value={footerNote}
                  onChange={(event) => setFooterNote(event.target.value)}
                  maxLength={240}
                  placeholder="Small-batch tallow products hand-poured in Tennessee."
                />
              </FormField>
            ) : null}
            {isContentMode ? (
              <div className="space-y-3 rounded-lg bg-muted/35 p-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={emailCaptureEnabled} onChange={(event) => setEmailCaptureEnabled(event.target.checked)} />
                Enable newsletter signup in footer
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Signup Heading" className="sm:col-span-2">
                  <Input
                    value={emailCaptureHeading}
                    onChange={(event) => setEmailCaptureHeading(event.target.value)}
                    maxLength={120}
                    placeholder="Get product drops and restock alerts"
                  />
                </FormField>
                <FormField label="Signup Description" className="sm:col-span-2">
                  <Input
                    value={emailCaptureDescription}
                    onChange={(event) => setEmailCaptureDescription(event.target.value)}
                    maxLength={280}
                    placeholder="One to two emails per month. Unsubscribe anytime."
                  />
                </FormField>
                <FormField label="Success Message" className="sm:col-span-2">
                  <Input
                    value={emailCaptureSuccessMessage}
                    onChange={(event) => setEmailCaptureSuccessMessage(event.target.value)}
                    maxLength={180}
                    placeholder="Thanks for joining. Check your inbox for updates."
                  />
                </FormField>
              </div>
            </div>
            ) : null}
            {isCheckoutMode ? (
              <div className="space-y-3 rounded-lg bg-muted/35 p-3 sm:col-span-2">
              <p className="text-sm font-medium">Checkout Fulfillment Options</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={checkoutEnableLocalPickup} onChange={(event) => setCheckoutEnableLocalPickup(event.target.checked)} />
                Enable local pickup option
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Pickup Label">
                  <Input
                    value={checkoutLocalPickupLabel}
                    onChange={(event) => setCheckoutLocalPickupLabel(event.target.value)}
                    maxLength={120}
                    placeholder="Porch pickup in Virginia Beach"
                  />
                </FormField>
                <FormField label="Pickup Fee (cents)">
                  <Input
                    type="number"
                    min={0}
                    value={checkoutLocalPickupFeeCents}
                    onChange={(event) => setCheckoutLocalPickupFeeCents(event.target.value)}
                    placeholder="0"
                  />
                </FormField>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={checkoutEnableFlatRateShipping} onChange={(event) => setCheckoutEnableFlatRateShipping(event.target.checked)} />
                Enable flat-rate shipping option
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Shipping Label">
                  <Input
                    value={checkoutFlatRateShippingLabel}
                    onChange={(event) => setCheckoutFlatRateShippingLabel(event.target.value)}
                    maxLength={120}
                    placeholder="Shipped (flat fee)"
                  />
                </FormField>
                <FormField label="Shipping Fee (cents)">
                  <Input
                    type="number"
                    min={0}
                    value={checkoutFlatRateShippingFeeCents}
                    onChange={(event) => setCheckoutFlatRateShippingFeeCents(event.target.value)}
                    placeholder="1000"
                  />
                </FormField>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={checkoutAllowOrderNote} onChange={(event) => setCheckoutAllowOrderNote(event.target.checked)} />
                Allow buyer order note
              </label>
              <FormField label="Order Note Prompt" description="Prompt shown above the optional customer order note field at checkout.">
                <Input
                  value={checkoutOrderNotePrompt}
                  onChange={(event) => setCheckoutOrderNotePrompt(event.target.value)}
                  maxLength={300}
                  placeholder="If you have any questions, comments, or concerns about your order, leave a note below."
                />
              </FormField>
            </div>
            ) : null}
            {isPoliciesMode ? (
              <FormField label="Instagram URL">
              <Input
                type="url"
                value={instagramUrl}
                onChange={(event) => setInstagramUrl(event.target.value)}
                placeholder="https://instagram.com/..."
              />
            </FormField>
            ) : null}
            {isPoliciesMode ? (
              <FormField label="Facebook URL">
              <Input
                type="url"
                value={facebookUrl}
                onChange={(event) => setFacebookUrl(event.target.value)}
                placeholder="https://facebook.com/..."
              />
            </FormField>
            ) : null}
            {isPoliciesMode ? (
              <FormField label="TikTok URL" className="sm:col-span-2">
              <Input
                type="url"
                value={tiktokUrl}
                onChange={(event) => setTiktokUrl(event.target.value)}
                placeholder="https://tiktok.com/@..."
              />
            </FormField>
            ) : null}

            {isContentMode ? (
              <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Policy FAQs</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPolicyFaqs((current) => [...current, createPolicyFaqDraft(current.length)])}
                >
                  Add FAQ
                </Button>
              </div>
              {policyFaqs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Add common customer questions shown on the Policies page.</p>
              ) : (
                <div className="space-y-3">
                  {policyFaqs.map((faq, index) => (
                    <div key={faq.id} className="space-y-3 rounded-lg bg-muted/35 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">FAQ {index + 1}</p>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Checkbox
                              checked={faq.isActive}
                              onChange={(event) =>
                                setPolicyFaqs((current) =>
                                  current.map((entry) =>
                                    entry.id === faq.id ? { ...entry, isActive: event.target.checked } : entry
                                  )
                                )
                              }
                            />
                            Active
                          </label>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setPolicyFaqs((current) => current.filter((entry) => entry.id !== faq.id))}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      <FormField label="Question">
                        <Input
                          value={faq.question}
                          onChange={(event) =>
                            setPolicyFaqs((current) =>
                              current.map((entry) => (entry.id === faq.id ? { ...entry, question: event.target.value } : entry))
                            )
                          }
                          placeholder="When will my order ship?"
                        />
                      </FormField>
                      <FormField label="Answer">
                        <Textarea
                          rows={3}
                          value={faq.answer}
                          onChange={(event) =>
                            setPolicyFaqs((current) =>
                              current.map((entry) => (entry.id === faq.id ? { ...entry, answer: event.target.value } : entry))
                            )
                          }
                          placeholder="Most orders ship within 2-4 business days..."
                        />
                      </FormField>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : null}

            {isContentMode ? (
              <FormField label="About Article" className="sm:col-span-2">
              <RichTextEditor
                value={aboutArticleHtml}
                onChange={setAboutArticleHtml}
                placeholder="Tell your brand story: who you are, what you value, and what makes your products special."
              />
            </FormField>
            ) : null}

            {isContentMode ? (
              <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">About Sections</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAboutSections((current) => [...current, createAboutSectionDraft()])}
                >
                  Add section
                </Button>
              </div>
              {aboutSections.length === 0 ? (
                <p className="text-xs text-muted-foreground">Optional visual story sections with image + copy layouts.</p>
              ) : (
                <div className="space-y-3">
                  {aboutSections.map((section) => (
                    <div key={section.id} className="space-y-3 rounded-lg bg-muted/35 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Section</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAboutSections((current) => current.filter((entry) => entry.id !== section.id))}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Title" className="sm:col-span-2">
                          <Input
                            value={section.title}
                            onChange={(event) =>
                              setAboutSections((current) =>
                                current.map((entry) => (entry.id === section.id ? { ...entry, title: event.target.value } : entry))
                              )
                            }
                            placeholder="Our ingredient standards"
                          />
                        </FormField>
                        <FormField label="Body" className="sm:col-span-2">
                          <Textarea
                            rows={3}
                            value={section.body}
                            onChange={(event) =>
                              setAboutSections((current) =>
                                current.map((entry) => (entry.id === section.id ? { ...entry, body: event.target.value } : entry))
                              )
                            }
                            placeholder="Describe your process, values, and quality promise."
                          />
                        </FormField>
                        <FormField label="Image URL">
                          <Input
                            type="url"
                            value={section.imageUrl}
                            onChange={(event) =>
                              setAboutSections((current) =>
                                current.map((entry) => (entry.id === section.id ? { ...entry, imageUrl: event.target.value } : entry))
                              )
                            }
                            placeholder="https://..."
                          />
                        </FormField>
                        <FormField label="Layout">
                          <Select
                            value={section.layout}
                            onChange={(event) =>
                              setAboutSections((current) =>
                                current.map((entry) =>
                                  entry.id === section.id
                                    ? { ...entry, layout: event.target.value as AboutSectionDraft["layout"] }
                                    : entry
                                )
                              )
                            }
                          >
                            <option value="image_right">Image right</option>
                            <option value="image_left">Image left</option>
                            <option value="full">Full width text</option>
                          </Select>
                        </FormField>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : null}

            {isContentMode ? (
              <FormField label="Storefront Copy Overrides (JSON)" className="sm:col-span-2">
              <Textarea
                rows={14}
                value={storefrontCopyJson}
                onChange={(event) => setStorefrontCopyJson(event.target.value)}
                placeholder={`{\n  "home": {\n    "contentBlocksHeading": "How We Craft"\n  },\n  "footer": {\n    "defaultTagline": "Small-batch care from our home to yours."\n  }\n}`}
              />
              <p className="text-xs text-muted-foreground">Optional advanced overrides. Leave as {`{}`} to use defaults.</p>
            </FormField>
            ) : null}
          </div>
          <FeedbackMessage type="error" message={flyoutError} />
        </form>
      </Flyout>
    </SectionCard>
  );
}
