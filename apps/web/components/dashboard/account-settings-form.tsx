"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";

type AccountSettingsFormProps = {
  email: string | null;
  globalRole: "user" | "support" | "admin";
  initialDisplayName: string;
  initialPreferences: {
    weeklyDigestEmails: boolean;
    productAnnouncements: boolean;
  };
};

type AccountProfileResponse = {
  ok?: boolean;
  profile?: {
    id: string;
    email: string | null;
    displayName: string | null;
    globalRole: "user" | "support" | "admin";
    preferences: {
      weeklyDigestEmails: boolean;
      productAnnouncements: boolean;
    };
  };
  error?: string;
};

export function AccountSettingsForm({ email, globalRole, initialDisplayName, initialPreferences }: AccountSettingsFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [weeklyDigestEmails, setWeeklyDigestEmails] = useState(initialPreferences.weeklyDigestEmails);
  const [productAnnouncements, setProductAnnouncements] = useState(initialPreferences.productAnnouncements);

  const [savedDisplayName, setSavedDisplayName] = useState(initialDisplayName);
  const [savedWeeklyDigestEmails, setSavedWeeklyDigestEmails] = useState(initialPreferences.weeklyDigestEmails);
  const [savedProductAnnouncements, setSavedProductAnnouncements] = useState(initialPreferences.productAnnouncements);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      setDisplayName(savedDisplayName);
      setWeeklyDigestEmails(savedWeeklyDigestEmails);
      setProductAnnouncements(savedProductAnnouncements);
      setError(null);
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        preferences: {
          weeklyDigestEmails,
          productAnnouncements
        }
      })
    });

    const payload = (await response.json()) as AccountProfileResponse;
    if (!response.ok || !payload.profile) {
      setError(payload.error ?? "Unable to update account settings.");
      setSaving(false);
      return;
    }

    const nextDisplayName = payload.profile.displayName ?? "";
    const nextPreferences = payload.profile.preferences;
    setDisplayName(nextDisplayName);
    setWeeklyDigestEmails(nextPreferences.weeklyDigestEmails);
    setProductAnnouncements(nextPreferences.productAnnouncements);
    setSavedDisplayName(nextDisplayName);
    setSavedWeeklyDigestEmails(nextPreferences.weeklyDigestEmails);
    setSavedProductAnnouncements(nextPreferences.productAnnouncements);
    setMessage("Account settings saved.");
    setSaving(false);
  }

  return (
    <form id="account-settings-form" onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="Identity">
        <div className="space-y-3">
          <FormField label="Email" description="Sign-in email is managed by your auth provider.">
            <Input value={email ?? ""} readOnly disabled />
          </FormField>
          <FormField label="Display Name" description="This name appears in team management and platform admin views.">
            <Input
              required
              minLength={2}
              maxLength={80}
              placeholder="Your name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </FormField>
          <FormField label="Platform Role" description="Role is managed by Myrivo platform administrators.">
            <Input value={globalRole.toUpperCase()} readOnly disabled />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Notification Preferences">
        <div className="space-y-3">
          <FormField label="Weekly Digest Emails" description="Receive a weekly summary of orders and storefront activity.">
            <Checkbox checked={weeklyDigestEmails} onChange={(event) => setWeeklyDigestEmails(event.target.checked)} />
          </FormField>
          <FormField label="Product Announcements" description="Receive occasional updates for product and platform releases.">
            <Checkbox checked={productAnnouncements} onChange={(event) => setProductAnnouncements(event.target.checked)} />
          </FormField>
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="intent"
          value="discard"
          variant="outline"
          disabled={saving}
        >
          Discard
        </Button>
        <Button
          type="submit"
          name="intent"
          value="save"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save account settings"}
        </Button>
      </div>

      <FeedbackMessage type="success" message={message} />
      <FeedbackMessage type="error" message={error} />
    </form>
  );
}
