import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import {
  getPlatformStorefrontPrivacySettings,
  resolvePlatformStorefrontPrivacySettings
} from "@/lib/privacy/platform-storefront-privacy";
import {
  platformStorefrontPrivacyGovernanceSchema,
  type PlatformStorefrontPrivacyGovernanceSnapshot
} from "@/lib/store-editor/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SettingsResponse = {
  settings?: PlatformStorefrontPrivacyGovernanceSnapshot;
  role?: "user" | "support" | "admin";
  error?: string;
};

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  try {
    const admin = createSupabaseAdminClient();
    const record = await getPlatformStorefrontPrivacySettings(admin);
    const resolved = resolvePlatformStorefrontPrivacySettings(record);

    return NextResponse.json({
      role: auth.context?.globalRole ?? "user",
      settings: {
        notice_at_collection_enabled: resolved.noticeAtCollectionEnabled,
        checkout_notice_enabled: resolved.checkoutNoticeEnabled,
        newsletter_notice_enabled: resolved.newsletterNoticeEnabled,
        review_notice_enabled: resolved.reviewNoticeEnabled,
        show_california_notice: resolved.showCaliforniaNotice,
        show_do_not_sell_link: resolved.showDoNotSellLink
      }
    } satisfies SettingsResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load platform privacy settings.";
    return NextResponse.json({ error: message } satisfies SettingsResponse, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const parsed = platformStorefrontPrivacyGovernanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." } satisfies SettingsResponse, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("platform_storefront_privacy_settings").upsert(
    {
      key: "default",
      ...parsed.data
    },
    { onConflict: "key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message } satisfies SettingsResponse, { status: 500 });
  }

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    settings: parsed.data
  } satisfies SettingsResponse);
}
