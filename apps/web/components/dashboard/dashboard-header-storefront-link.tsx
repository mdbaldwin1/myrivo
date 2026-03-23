"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { isStoreWorkspacePath, resolveCurrentStoreWorkspaceSlug } from "@/lib/routes/store-workspace";

type DashboardHeaderStorefrontLinkProps = {
  storeSlug: string | null;
};

export function DashboardHeaderStorefrontLink({ storeSlug }: DashboardHeaderStorefrontLinkProps) {
  const pathname = usePathname();
  const effectiveStoreSlug = resolveCurrentStoreWorkspaceSlug(pathname, storeSlug);
  const isStoreWorkspaceRoute = isStoreWorkspacePath(pathname, effectiveStoreSlug);

  if (!effectiveStoreSlug || !isStoreWorkspaceRoute) {
    return null;
  }

  return (
    <Link href={`/s/${effectiveStoreSlug}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "default", size: "sm" })}>
      View storefront
    </Link>
  );
}
