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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(returnTo);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Owner access only. Contact admin if you need an invitation.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Email" description="Use the owner or team account email for this store.">
            <Input
              type="email"
              required
              placeholder="owner@yourshop.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <FormField label="Password" description="Passwords are case-sensitive.">
            <Input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <FeedbackMessage type="error" message={error} />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <Link href={withReturnTo("/signup", returnTo)} className="font-medium text-foreground underline-offset-4 hover:underline">
              Create account
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
