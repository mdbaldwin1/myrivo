"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode, MouseEvent } from "react";

type StoreWorkspaceLaunchLinkProps = {
  href: string;
  storeSlug: string;
  className?: string;
  children: ReactNode;
  target?: string;
  rel?: string;
  "aria-label"?: string;
};

function shouldBypassIntercept(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function StoreWorkspaceLaunchLink({
  href,
  storeSlug,
  className,
  children,
  target,
  rel,
  "aria-label": ariaLabel
}: StoreWorkspaceLaunchLinkProps) {
  const router = useRouter();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (target === "_blank" || shouldBypassIntercept(event)) {
      return;
    }

    event.preventDefault();

    try {
      await fetch("/api/stores/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: storeSlug })
      });
    } finally {
      router.push(href);
      router.refresh();
    }
  }

  return (
    <Link href={href} className={className} onClick={(event) => void handleClick(event)} target={target} rel={rel} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
