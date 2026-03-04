"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

function resolveBackHref(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, "") || "/";

  if (normalized.startsWith("/dashboard/content-studio/")) {
    return "/dashboard";
  }

  if (normalized.startsWith("/dashboard/store-settings/")) {
    return "/dashboard";
  }

  if (normalized.startsWith("/dashboard/reports/")) {
    return "/dashboard";
  }

  return null;
}

export function DashboardHeaderBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const backHref = pathname ? resolveBackHref(pathname) : null;

  if (!backHref) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Go back"
      className="h-8 w-8"
      onClick={() => router.push(backHref)}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
