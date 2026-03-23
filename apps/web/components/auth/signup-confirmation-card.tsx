"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthSurface } from "@/components/auth/auth-surface";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { withReturnTo } from "@/lib/auth/return-to";

type SignupConfirmationCardProps = {
  email: string;
  returnTo: string;
};

export function SignupConfirmationCard({ email, returnTo }: SignupConfirmationCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleResend() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createSupabaseBrowserClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`
      }
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setSuccess("Confirmation email resent. Check your inbox and spam folder.");
  }

  return (
    <AuthSurface
      title="Confirm your email"
      description={
        <>
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open that email to finish creating your account.
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
          <p>After you confirm your email, we’ll bring you back and finish signing you in.</p>
          <p>If you don’t see the message right away, check spam or promotions.</p>
        </div>

        <FeedbackMessage type="error" message={error} />
        <FeedbackMessage type="success" message={success} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => void handleResend()} disabled={loading} className="h-12 rounded-full sm:flex-1">
            {loading ? "Resending..." : "Resend email"}
          </Button>
          <Link href={withReturnTo("/login", returnTo)} className="sm:flex-1">
            <Button type="button" variant="outline" className="h-12 w-full rounded-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    </AuthSurface>
  );
}
