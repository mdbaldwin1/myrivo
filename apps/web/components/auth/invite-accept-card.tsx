"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { withReturnTo } from "@/lib/auth/return-to";

type InviteAcceptCardProps = {
  inviteToken: string;
  isAuthenticated: boolean;
  userEmail: string | null;
};

type InviteAcceptResponse = {
  ok?: boolean;
  storeSlug?: string | null;
  error?: string;
};

export function InviteAcceptCard({ inviteToken, isAuthenticated, userEmail }: InviteAcceptCardProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = useMemo(() => `/invite/${inviteToken}`, [inviteToken]);

  const acceptInvite = useCallback(async () => {
    setAccepting(true);
    setError(null);

    const response = await fetch("/api/stores/members/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: inviteToken })
    });

    const payload = (await response.json().catch(() => ({}))) as InviteAcceptResponse;
    if (!response.ok || !payload.ok) {
      setAccepting(false);
      setError(payload.error ?? "Unable to accept this invite.");
      return;
    }

    setAccepted(true);
    const target = payload.storeSlug ? `/dashboard/stores/${payload.storeSlug}` : "/dashboard/stores";
    router.replace(target);
    router.refresh();
  }, [inviteToken, router]);

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accept Team Invitation</CardTitle>
          <CardDescription>Sign in with the invited email address to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            After you sign in, you will return here automatically and can join the store workspace.
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={withReturnTo("/login", returnTo)}>Log in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={withReturnTo("/signup", returnTo)}>Create account</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept Team Invitation</CardTitle>
        <CardDescription>
          {userEmail ? `Signed in as ${userEmail}.` : "Signed in account detected."} Accepting confirms this account should join the store.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FeedbackMessage type="error" message={error} />
        {error ? (
          <p className="text-sm text-muted-foreground">
            If this invite was sent to a different email address, sign out and sign in with the invited account.
          </p>
        ) : null}
        {accepted ? <p className="text-sm text-muted-foreground">Invite accepted. Redirecting to store workspace...</p> : null}
        {!accepted && !accepting && !error ? <p className="text-sm text-muted-foreground">Continue below to join the store.</p> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void acceptInvite()} disabled={accepting}>
          {accepting ? "Accepting..." : "Accept invite"}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/dashboard/stores">Back to stores</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
