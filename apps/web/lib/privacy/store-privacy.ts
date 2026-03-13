import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StorePrivacyProfileRecord,
  StorePrivacyRequestRecord,
  StorePrivacyRequestStatus,
  StorePrivacyRequestType,
  StoreRecord,
  StoreSettingsRecord
} from "@/types/database";

export type { StorePrivacyRequestStatus, StorePrivacyRequestType };

export const STORE_PRIVACY_REQUEST_TYPES: readonly StorePrivacyRequestType[] = [
  "access",
  "deletion",
  "correction",
  "know",
  "opt_out_sale_share"
];
export const STORE_PRIVACY_REQUEST_STATUSES = ["open", "in_progress", "completed", "closed"] as const;

export const STORE_PRIVACY_INFORMATION_ARCHITECTURE = {
  platformOwns: [
    "platform-wide privacy statement and support posture",
    "account-signup legal acceptance and platform-level privacy disclosure",
    "future automated rights fulfillment infrastructure",
    "global privacy control and browser-signal support when implemented"
  ],
  storeSettingsLegalOwns: [
    "store-level privacy contact details",
    "store-level California/privacy addenda",
    "point-of-collection notice enablement",
    "privacy request intake and operator workflow state"
  ],
  storefrontOwns: [
    "rendering privacy notices at collection points",
    "privacy policy and rights links in shopper-facing navigation",
    "customer-facing privacy request form and confirmation messaging"
  ],
  nonGoals: [
    "a separate drag-and-drop privacy studio",
    "forcing every store to publish a standalone California page by default",
    "store-managed account-signup legal acceptance"
  ]
} as const;

export type StorePrivacyNoticeSurface = "checkout" | "newsletter" | "review";

export type ResolvedStorePrivacyProfile = {
  noticeAtCollectionEnabled: boolean;
  checkoutNoticeEnabled: boolean;
  newsletterNoticeEnabled: boolean;
  reviewNoticeEnabled: boolean;
  showCaliforniaNotice: boolean;
  showDoNotSellLink: boolean;
  privacyContactEmail: string;
  privacyRightsEmail: string;
  privacyContactName: string;
  collectionNoticeAddendumMarkdown: string;
  californiaNoticeMarkdown: string;
  doNotSellMarkdown: string;
  requestPageIntroMarkdown: string;
};

export function getDefaultStorePrivacyProfile(
  settings?: Pick<StoreSettingsRecord, "support_email"> | null
): ResolvedStorePrivacyProfile {
  const supportEmail = settings?.support_email?.trim() || "privacy@example.com";
  return {
    noticeAtCollectionEnabled: true,
    checkoutNoticeEnabled: true,
    newsletterNoticeEnabled: true,
    reviewNoticeEnabled: true,
    showCaliforniaNotice: false,
    showDoNotSellLink: false,
    privacyContactEmail: supportEmail,
    privacyRightsEmail: supportEmail,
    privacyContactName: "Privacy team",
    collectionNoticeAddendumMarkdown: "",
    californiaNoticeMarkdown: "",
    doNotSellMarkdown: "",
    requestPageIntroMarkdown: ""
  };
}

export function resolveStorePrivacyProfile(
  profile: StorePrivacyProfileRecord | null | undefined,
  settings?: Pick<StoreSettingsRecord, "support_email"> | null
): ResolvedStorePrivacyProfile {
  const fallback = getDefaultStorePrivacyProfile(settings);
  if (!profile) {
    return fallback;
  }

  return {
    noticeAtCollectionEnabled: profile.notice_at_collection_enabled,
    checkoutNoticeEnabled: profile.checkout_notice_enabled,
    newsletterNoticeEnabled: profile.newsletter_notice_enabled,
    reviewNoticeEnabled: profile.review_notice_enabled,
    showCaliforniaNotice: profile.show_california_notice,
    showDoNotSellLink: profile.show_do_not_sell_link,
    privacyContactEmail: profile.privacy_contact_email?.trim() || fallback.privacyContactEmail,
    privacyRightsEmail: profile.privacy_rights_email?.trim() || fallback.privacyRightsEmail,
    privacyContactName: profile.privacy_contact_name?.trim() || fallback.privacyContactName,
    collectionNoticeAddendumMarkdown: profile.collection_notice_addendum_markdown?.trim() || "",
    californiaNoticeMarkdown: profile.california_notice_markdown?.trim() || "",
    doNotSellMarkdown: profile.do_not_sell_markdown?.trim() || "",
    requestPageIntroMarkdown: profile.request_page_intro_markdown?.trim() || ""
  };
}

export function getStorePrivacyCollectionNotice(
  surface: StorePrivacyNoticeSurface,
  store: Pick<StoreRecord, "name" | "slug">,
  profile: ResolvedStorePrivacyProfile
) {
  const surfaceLead =
    surface === "checkout"
      ? "When you check out, we collect the information needed to process and fulfill your order."
      : surface === "newsletter"
        ? "When you join the email list, we collect your email address to send store updates and offers."
        : "When you submit a review, we collect the information needed to publish and moderate your review.";

  return {
    body: `${surfaceLead} Review ${store.name}'s Privacy Policy for details on how your information is used.`,
    policyHref: `/privacy?store=${encodeURIComponent(store.slug)}`,
    californiaHref: `/privacy?store=${encodeURIComponent(store.slug)}#california-privacy-notice`,
    requestHref: `/privacy/request?store=${encodeURIComponent(store.slug)}`,
    doNotSellHref: `/privacy/request?store=${encodeURIComponent(store.slug)}&type=opt_out_sale_share`,
    addendumMarkdown: profile.collectionNoticeAddendumMarkdown
  };
}

export function getStorePrivacyRequestTypes() {
  return [...STORE_PRIVACY_REQUEST_TYPES];
}

export function getStorePrivacyRequestTypeLabel(requestType: (typeof STORE_PRIVACY_REQUEST_TYPES)[number]) {
  switch (requestType) {
    case "access":
      return "Access my information";
    case "deletion":
      return "Delete my information";
    case "correction":
      return "Correct my information";
    case "know":
      return "Know what information you have";
    case "opt_out_sale_share":
      return "Do not sell or share my information";
  }
}

export async function getStorePrivacyProfileByStoreId(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase
    .from("store_privacy_profiles")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle<StorePrivacyProfileRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getStorePrivacyRequestsByStoreId(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase
    .from("store_privacy_requests")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .returns<StorePrivacyRequestRecord[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export function getStorePrivacyRequestStatusLabel(status: StorePrivacyRequestStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "closed":
      return "Closed";
  }
}
