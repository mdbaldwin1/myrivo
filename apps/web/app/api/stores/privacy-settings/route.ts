import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { getDefaultPlatformStorefrontPrivacySettings } from "@/lib/privacy/platform-storefront-privacy";
import { resolveStorePrivacyProfile } from "@/lib/privacy/store-privacy";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { storePrivacyComplianceEditorSchema, type StorePrivacyComplianceEditorSnapshot } from "@/lib/store-editor/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import type { StorePrivacyProfileRecord } from "@/types/database";

type SettingsResponse = {
  settings?: StorePrivacyComplianceEditorSnapshot;
  store?: {
    name: string;
    slug: string;
    supportEmail: string | null;
  };
  error?: string;
};

function buildPrivacyComplianceEntry(profile: StorePrivacyProfileRecord | null | undefined, supportEmail: string | null) {
  const resolved = resolveStorePrivacyProfile(profile, getDefaultPlatformStorefrontPrivacySettings(), { support_email: supportEmail });
  return {
    privacy_contact_email: resolved.privacyContactEmail,
    privacy_rights_email: resolved.privacyRightsEmail,
    privacy_contact_name: resolved.privacyContactName,
    collection_notice_addendum_markdown: resolved.collectionNoticeAddendumMarkdown,
    california_notice_markdown: resolved.californiaNoticeMarkdown,
    do_not_sell_markdown: resolved.doNotSellMarkdown,
    request_page_intro_markdown: resolved.requestPageIntroMarkdown
  } satisfies StorePrivacyComplianceEditorSnapshot;
}

async function resolveOwnerContext(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "admin");
  if (!bundle) {
    return { error: NextResponse.json({ error: "Store not found or insufficient access." }, { status: 404 }) } as const;
  }

  return { supabase, bundle, user } as const;
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle } = resolved;
  const privacyProfileResult = await supabase
    .from("store_privacy_profiles")
    .select("*")
    .eq("store_id", bundle.store.id)
    .maybeSingle<StorePrivacyProfileRecord>();

  if (privacyProfileResult.error) {
    return NextResponse.json({ error: privacyProfileResult.error.message } satisfies SettingsResponse, { status: 500 });
  }

  return NextResponse.json({
    settings: buildPrivacyComplianceEntry(privacyProfileResult.data, bundle.settings?.support_email ?? null),
    store: {
      name: bundle.store.name,
      slug: bundle.store.slug,
      supportEmail: bundle.settings?.support_email ?? null
    }
  } satisfies SettingsResponse);
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, storePrivacyComplianceEditorSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle, user } = resolved;
  const { error } = await supabase.from("store_privacy_profiles").upsert(
    {
      store_id: bundle.store.id,
      ...payload.data
    },
    { onConflict: "store_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message } satisfies SettingsResponse, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store_privacy_profile",
    entityId: bundle.store.id,
    metadata: {
      hasPrivacyContactEmail: Boolean(payload.data.privacy_contact_email),
      hasPrivacyRightsEmail: Boolean(payload.data.privacy_rights_email),
      hasRequestPageIntro: Boolean(payload.data.request_page_intro_markdown.trim())
    }
  });

  return NextResponse.json({ settings: payload.data } satisfies SettingsResponse);
}
