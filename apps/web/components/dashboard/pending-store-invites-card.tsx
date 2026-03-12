"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SectionCard } from "@/components/ui/section-card";
import type { DashboardHomePendingInvite } from "@/lib/dashboard/home/dashboard-home-types";

type PendingStoreInvitesCardProps = {
  invites: DashboardHomePendingInvite[];
};

export function PendingStoreInvitesCard({ invites }: PendingStoreInvitesCardProps) {
  const router = useRouter();
  const [submittingInviteId, setSubmittingInviteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function acceptInvite(inviteId: string) {
    setSubmittingInviteId(inviteId);
    setError(null);

    const response = await fetch(`/api/account/store-invites/${inviteId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; storeSlug?: string | null; error?: string };

    setSubmittingInviteId(null);
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Unable to accept this invite.");
      return;
    }

    router.replace(payload.storeSlug ? `/dashboard/stores/${payload.storeSlug}` : "/dashboard/stores");
    router.refresh();
  }

  return (
    <SectionCard title="Pending Team Invites" description="Invites tied to your account email that still need to be accepted.">
      <div className="space-y-3">
        <FeedbackMessage type="error" message={error} />
        <ul className="space-y-2 text-sm">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{invite.storeName}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.role === "admin" ? "Admin" : "Staff"} access · expires {new Date(invite.expiresAt).toLocaleString()}
                </p>
              </div>
              <Button type="button" size="sm" onClick={() => void acceptInvite(invite.id)} disabled={submittingInviteId === invite.id}>
                {submittingInviteId === invite.id ? "Joining..." : "Accept invite"}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}
