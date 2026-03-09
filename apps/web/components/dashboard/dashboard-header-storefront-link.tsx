"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

type DashboardHeaderStorefrontLinkProps = {
  storeSlug: string | null;
};

export function DashboardHeaderStorefrontLink({ storeSlug }: DashboardHeaderStorefrontLinkProps) {
  const pathname = usePathname();
  const isStoreWorkspaceRoute = Boolean(
    storeSlug &&
      pathname &&
      (pathname === `/dashboard/stores/${storeSlug}` || pathname.startsWith(`/dashboard/stores/${storeSlug}/`))
  );

  if (!storeSlug || !isStoreWorkspaceRoute) {
    return null;
  }

  return (
    <Link href={`/s/${storeSlug}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "default", size: "sm" })}>
      View storefront
    </Link>
  );
}
