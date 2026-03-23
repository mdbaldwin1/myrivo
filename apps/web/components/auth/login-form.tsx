"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthSurface } from "@/components/auth/auth-surface";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { resolvePostAuthReturnTo } from "@/lib/auth/pending-store-invite";
import { withReturnTo } from "@/lib/auth/return-to";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginFormProps = {
  returnTo: string;
};

export function LoginForm({ returnTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const nextTarget = resolvePostAuthReturnTo(returnTo, signInData.user?.user_metadata ?? signInData.session?.user.user_metadata);
    router.push(nextTarget);
    router.refresh();
  }

  return (
    <AuthSurface title="Sign in" description="Owner and team access for your store workspace.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Email" description="Use the owner or team account email for this store.">
          <Input
            type="email"
            required
            placeholder="owner@yourshop.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 rounded-2xl border-border/70 bg-white"
          />
        </FormField>
        <FormField label="Password" description="Passwords are case-sensitive.">
          <Input
            type="password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 rounded-2xl border-border/70 bg-white"
          />
        </FormField>
        <div className="-mt-2 text-right">
          <Link
            href={withReturnTo("/forgot-password", returnTo)}
            className="text-sm font-medium text-[hsl(var(--brand-secondary))] underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <FeedbackMessage type="error" message={error} />
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link href={withReturnTo("/signup", returnTo)} className="font-medium text-foreground underline-offset-4 hover:underline">
            Create account
          </Link>
        </p>
      </form>
    </AuthSurface>
  );
}
