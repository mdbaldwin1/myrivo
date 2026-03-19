"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import type { OnboardingMilestone } from "@/lib/onboarding/analytics";

type OnboardingRevealActionLinkProps = {
  href: string;
  storeId: string;
  storeSlug: string;
  sessionId: string;
  milestone?: Extract<OnboardingMilestone, "studio_handoff" | "catalog_handoff" | "payments_handoff" | "launch_checklist_handoff">;
  activateStore?: boolean;
  className?: string;
  children: ReactNode;
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

export function OnboardingRevealActionLink({
  href,
  storeId,
  storeSlug,
  sessionId,
  milestone,
  activateStore = true,
  className,
  children
}: OnboardingRevealActionLinkProps) {
  const router = useRouter();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (shouldBypassIntercept(event)) {
      return;
    }

    event.preventDefault();

    try {
      if (milestone) {
        await fetch(`/api/onboarding/session/${sessionId}/milestone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            milestone
          })
        });
      }

      await fetch(`/api/onboarding/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          currentStep: "review",
          lastCompletedStep: "review",
          status: "completed"
        })
      });

      if (activateStore) {
        await fetch("/api/stores/active", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: storeSlug })
        });
      }
    } finally {
      router.push(href);
      router.refresh();
    }
  }

  return (
    <Link href={href} className={className} onClick={(event) => void handleClick(event)}>
      {children}
    </Link>
  );
}
