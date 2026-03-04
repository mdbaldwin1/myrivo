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
    .select("name,status,white_label_enabled,white_label_brand_name,white_label_favicon_path")
    .eq("slug", storeSlug)
    .maybeSingle<{
      name: string;
      status: "draft" | "active" | "suspended";
      white_label_enabled: boolean;
      white_label_brand_name: string | null;
      white_label_favicon_path: string | null;
    }>();

  if (error || !store || store.status !== "active" || !store.white_label_enabled) {
    return defaultMetadata();
  }

  const favicon = store.white_label_favicon_path?.trim() || "/brand/myrivo-favicon.svg";
  const title = store.white_label_brand_name?.trim() || store.name || "Myrivo";

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
