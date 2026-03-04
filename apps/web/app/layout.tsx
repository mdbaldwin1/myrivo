import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
      status: "draft" | "active" | "suspended";
      white_label_enabled: boolean;
    }>();

  if (error || !store || store.status !== "active" || !store.white_label_enabled) {
    return defaultMetadata();
  }

  const { data: branding } = await admin
    .from("store_branding")
    .select("logo_path")
    .eq("store_id", store.id)
    .maybeSingle<{ logo_path: string | null }>();

  const favicon = branding?.logo_path?.trim() || "/brand/myrivo-favicon.svg";
  const title = store.name || "Myrivo";

  return {
    title,
    description: `Storefront powered by ${title}`,
    icons: {
      icon: [{ url: favicon }],
      shortcut: [favicon],
      apple: [favicon]
    }
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
