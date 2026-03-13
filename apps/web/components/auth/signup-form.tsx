"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { extractPendingStoreInviteTokenFromReturnTo } from "@/lib/auth/pending-store-invite";
import type { LegalRequirement } from "@/lib/legal/documents";
import {
  MARKETING_ANALYTICS_COOKIE_NAME,
  MARKETING_ANALYTICS_SESSION_STORAGE_KEY,
  isMarketingPageKey,
  type MarketingPageKey
} from "@/lib/marketing/analytics";
import { withReturnTo } from "@/lib/auth/return-to";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignupMarketingAttribution = {
  source: string | null;
  marketingPage: string | null;
  marketingSection: string | null;
  marketingCta: string | null;
  marketingLabel: string | null;
};

type SignupFormProps = {
  returnTo: string;
  legalRequirements: { terms: LegalRequirement; privacy: LegalRequirement } | null;
  legalUnavailable: boolean;
  marketingAttribution: SignupMarketingAttribution;
};

function readMarketingSessionKey() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(MARKETING_ANALYTICS_SESSION_STORAGE_KEY);
  if (stored?.trim()) {
    return stored;
  }

  const cookieEntry = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${MARKETING_ANALYTICS_COOKIE_NAME}=`));
  return cookieEntry?.slice(`${MARKETING_ANALYTICS_COOKIE_NAME}=`.length) ?? null;
}

export function SignupForm({ returnTo, legalRequirements, legalUnavailable, marketingAttribution }: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (legalUnavailable || !legalRequirements) {
      setError("Legal configuration is unavailable. Please try again shortly.");
      setLoading(false);
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError("You must accept the Terms and Privacy Policy to create an account.");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const consentVersionIds = [legalRequirements.terms.versionId, legalRequirements.privacy.versionId];
    const pendingStoreInviteToken = extractPendingStoreInviteTokenFromReturnTo(returnTo);
    const { data: signupData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
        data: {
          signup_legal_version_ids: consentVersionIds,
          pending_store_invite_token: pendingStoreInviteToken
        }
      }
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (!signupData.session) {
      setLoading(false);
      setSuccess("Account created. Check your email to confirm your address and finish signing in.");
      return;
    }

    const consentResponse = await fetch("/api/legal/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        versionIds: consentVersionIds,
        acceptanceSurface: "signup",
        returnTo
      })
    });
    const consentPayload = (await consentResponse.json().catch(() => ({}))) as { error?: string };
    setLoading(false);
    if (!consentResponse.ok) {
      setError(consentPayload.error ?? "Account created, but legal acceptance capture failed. Please contact support before continuing.");
      return;
    }

    if (marketingAttribution.marketingCta || marketingAttribution.source) {
      const marketingSessionKey = readMarketingSessionKey();
      if (marketingSessionKey) {
        void fetch("/api/marketing/analytics/collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionKey: marketingSessionKey,
            entryPath: window.location.pathname + window.location.search,
            referrer: document.referrer || undefined,
            userAgent: navigator.userAgent,
            events: [
              {
                eventType: "signup_completed",
                path: window.location.pathname + window.location.search,
                pageKey: isMarketingPageKey(marketingAttribution.marketingPage) ? (marketingAttribution.marketingPage as MarketingPageKey) : undefined,
                sectionKey: marketingAttribution.marketingSection ?? undefined,
                ctaKey: marketingAttribution.marketingCta ?? marketingAttribution.source ?? undefined,
                ctaLabel: marketingAttribution.marketingLabel ?? undefined,
                value: {
                  source: marketingAttribution.source ?? undefined,
                  returnTo
                }
              }
            ]
          }),
          keepalive: true
        });
      }
    }

    router.push(returnTo);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Create your account, then set up your first store workspace.</CardDescription>
        {legalUnavailable ? (
          <p className="text-sm text-amber-700">Signup is temporarily unavailable while legal documents are being configured.</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Email" description="Use an email address you can access for verification and invites.">
            <Input type="email" required placeholder="owner@yourshop.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </FormField>
          <FormField label="Password" description="Use at least 8 characters and keep it secure.">
            <Input
              type="password"
              minLength={8}
              required
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Terms and Conditions
                </Link>
                .
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
              <span>
                I agree to the{" "}
                <Link href="/privacy" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>
          <FeedbackMessage type="error" message={error} />
          <FeedbackMessage type="success" message={success} />
          <Button type="submit" disabled={loading || legalUnavailable || !termsAccepted || !privacyAccepted} className="w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={withReturnTo("/login", returnTo)} className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
