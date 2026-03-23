"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { withReturnTo } from "@/lib/auth/return-to";

type ResetPasswordFormProps = {
  canReset: boolean;
  email: string | null;
  returnTo: string;
};

export function ResetPasswordForm({ canReset, email, returnTo }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const payload = (await response.json()) as { message?: string; error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to reset password.");
      return;
    }

    setMessage(payload.message ?? "Password reset complete.");
    setPassword("");
    setConfirmPassword("");
    window.setTimeout(() => {
      router.push(withReturnTo("/login", returnTo));
    }, 900);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          {canReset
            ? `Set a new password${email ? ` for ${email}` : ""}.`
            : "This reset session is no longer active. Request a new password reset email to continue."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canReset ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="New password" description="Use at least 8 characters.">
              <Input
                type="password"
                required
                minLength={8}
                placeholder="Enter a new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            <FormField label="Confirm password">
              <Input
                type="password"
                required
                minLength={8}
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </FormField>
            <FeedbackMessage type="error" message={error} />
            <FeedbackMessage type="success" message={message} />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Updating..." : "Reset password"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <FeedbackMessage type="error" message="Password reset link is missing or expired." />
            <Button asChild className="w-full">
              <Link href={withReturnTo("/forgot-password", returnTo)}>Request a new reset link</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
