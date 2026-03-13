import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { SkipLink } from "@/components/ui/skip-link";
import { Toaster } from "@/components/ui/toaster";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import "./globals.css";

function defaultMetadata(): Metadata {
  return {
    title: "Myrivo",
    description: "Commerce platform for independent makers",
    icons: {
      icon: [
        { url: "/brand/myrivo-favicon.svg", type: "image/svg+xml" },
        { url: "/icon.svg", type: "image/svg+xml" }
      ],
      shortcut: ["/brand/myrivo-favicon.svg"],
      apple: ["/icon.svg"]
    }
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const storeSlug = await resolveStoreSlugFromDomain(host);

  if (!storeSlug) {
    return defaultMetadata();
  }

  const admin = createSupabaseAdminClient();
  const { data: store, error } = await admin
    .from("stores")
    .select("id,name,status,white_label_enabled")
    .eq("slug", storeSlug)
    .maybeSingle<{
      id: string;
      name: string;
      status: "draft" | "pending_review" | "active" | "suspended";
      white_label_enabled: boolean;
    }>();

  if (error || !store || store.status !== "active" || !store.white_label_enabled) {
    return defaultMetadata();
  }

  const brandingQuery = await admin
    .from("store_branding")
    .select("logo_path,favicon_path,apple_touch_icon_path,og_image_path,twitter_image_path")
    .eq("store_id", store.id)
    .maybeSingle<{
      logo_path: string | null;
      favicon_path: string | null;
      apple_touch_icon_path: string | null;
      og_image_path: string | null;
      twitter_image_path: string | null;
    }>();
  let branding = brandingQuery.data;

  if (
    brandingQuery.error &&
    (isMissingColumnInSchemaCache(brandingQuery.error, "favicon_path") ||
      isMissingColumnInSchemaCache(brandingQuery.error, "apple_touch_icon_path") ||
      isMissingColumnInSchemaCache(brandingQuery.error, "og_image_path") ||
      isMissingColumnInSchemaCache(brandingQuery.error, "twitter_image_path"))
  ) {
    const fallback = await admin
      .from("store_branding")
      .select("logo_path")
      .eq("store_id", store.id)
      .maybeSingle<{ logo_path: string | null }>();
    branding = fallback.data
      ? {
          logo_path: fallback.data.logo_path,
          favicon_path: null,
          apple_touch_icon_path: null,
          og_image_path: null,
          twitter_image_path: null
        }
      : null;
  }

  const favicon = branding?.favicon_path?.trim() || branding?.logo_path?.trim() || "/brand/myrivo-favicon.svg";
  const appleTouchIcon = branding?.apple_touch_icon_path?.trim() || favicon;
  const socialImage = branding?.og_image_path?.trim() || branding?.twitter_image_path?.trim() || null;
  const title = store.name || "Myrivo";

  return {
    title,
    description: `Storefront powered by ${title}`,
    icons: {
      icon: [{ url: favicon }],
      shortcut: [favicon],
      apple: [appleTouchIcon]
    },
    openGraph: socialImage ? { images: [{ url: socialImage }] } : undefined,
    twitter: socialImage ? { images: [socialImage] } : undefined
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SkipLink />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
