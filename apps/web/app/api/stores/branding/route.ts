import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";

const hexColor = z.string().regex(/^#([0-9a-fA-F]{6})$/, "Expected 6-digit hex color");

const brandingSchema = z.object({
  logoPath: z.string().max(500).nullable().optional(),
  faviconPath: z.string().max(500).nullable().optional(),
  appleTouchIconPath: z.string().max(500).nullable().optional(),
  ogImagePath: z.string().max(500).nullable().optional(),
  twitterImagePath: z.string().max(500).nullable().optional(),
  primaryColor: hexColor.nullable().optional(),
  accentColor: hexColor.nullable().optional(),
  themeJson: z.record(z.string(), z.unknown()).nullable().optional()
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  return NextResponse.json({ branding: bundle.branding });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, brandingSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const hasField = (key: keyof z.infer<typeof brandingSchema>) => Object.prototype.hasOwnProperty.call(payload.data, key);
  const resolvedThemeConfig = resolveStorefrontThemeConfig(payload.data.themeJson ?? bundle.branding?.theme_json ?? {});
  const themeJson = {
    ...resolvedThemeConfig,
    primaryColor: hasField("primaryColor") ? payload.data.primaryColor ?? null : bundle.branding?.primary_color ?? null,
    accentColor: hasField("accentColor") ? payload.data.accentColor ?? null : bundle.branding?.accent_color ?? null
  };

  const { data, error } = await supabase
    .from("store_branding")
    .upsert(
      {
        store_id: bundle.store.id,
        logo_path: hasField("logoPath") ? payload.data.logoPath ?? null : bundle.branding?.logo_path ?? null,
        favicon_path: hasField("faviconPath") ? payload.data.faviconPath ?? null : bundle.branding?.favicon_path ?? null,
        apple_touch_icon_path: hasField("appleTouchIconPath")
          ? payload.data.appleTouchIconPath ?? null
          : bundle.branding?.apple_touch_icon_path ?? null,
        og_image_path: hasField("ogImagePath") ? payload.data.ogImagePath ?? null : bundle.branding?.og_image_path ?? null,
        twitter_image_path: hasField("twitterImagePath")
          ? payload.data.twitterImagePath ?? null
          : bundle.branding?.twitter_image_path ?? null,
        primary_color: hasField("primaryColor") ? payload.data.primaryColor ?? null : bundle.branding?.primary_color ?? null,
        accent_color: hasField("accentColor") ? payload.data.accentColor ?? null : bundle.branding?.accent_color ?? null,
        theme_json: themeJson
      },
      { onConflict: "store_id" }
    )
    .select("store_id,logo_path,favicon_path,apple_touch_icon_path,og_image_path,twitter_image_path,primary_color,accent_color,theme_json")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ branding: data });
}
