"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { withReturnTo } from "@/lib/auth/return-to";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignupFormProps = {
  returnTo: string;
};

export function SignupForm({ returnTo }: SignupFormProps) {
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
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`
      }
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push(returnTo);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Create your account, then set up your first store workspace.</CardDescription>
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
          <FeedbackMessage type="error" message={error} />
          <Button type="submit" disabled={loading} className="w-full">
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
