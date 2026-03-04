"use client";

import { useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { AvatarPicker } from "@/components/ui/avatar-picker";

type AccountSettingsFormProps = {
  email: string | null;
  globalRole: "user" | "support" | "admin";
  initialDisplayName: string;
  initialAvatarPath: string | null;
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
    avatarPath: string | null;
    globalRole: "user" | "support" | "admin";
    preferences: {
      weeklyDigestEmails: boolean;
      productAnnouncements: boolean;
    };
  };
  error?: string;
};

export function AccountSettingsForm({ email, globalRole, initialDisplayName, initialAvatarPath, initialPreferences }: AccountSettingsFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [weeklyDigestEmails, setWeeklyDigestEmails] = useState(initialPreferences.weeklyDigestEmails);
  const [productAnnouncements, setProductAnnouncements] = useState(initialPreferences.productAnnouncements);

  const [savedDisplayName, setSavedDisplayName] = useState(initialDisplayName);
  const [savedAvatarPath, setSavedAvatarPath] = useState(initialAvatarPath);
  const [savedWeeklyDigestEmails, setSavedWeeklyDigestEmails] = useState(initialPreferences.weeklyDigestEmails);
  const [savedProductAnnouncements, setSavedProductAnnouncements] = useState(initialPreferences.productAnnouncements);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isDirty =
    displayName !== savedDisplayName ||
    avatarPath !== savedAvatarPath ||
    weeklyDigestEmails !== savedWeeklyDigestEmails ||
    productAnnouncements !== savedProductAnnouncements;
  const avatarFallbackLabel = useMemo(() => {
    const source = displayName.trim() || email?.split("@")[0] || "ME";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [displayName, email]);

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/user/avatar", {
      method: "POST",
      body: formData
    });
    const payload = (await response.json()) as { avatarPath?: string; error?: string };

    if (!response.ok || !payload.avatarPath) {
      setError(payload.error ?? "Unable to upload avatar.");
      setAvatarUploading(false);
      return;
    }

    setAvatarPath(payload.avatarPath);
    setMessage("Avatar ready to save.");
    setAvatarUploading(false);
  }

  async function handleAvatarRemove() {
    setError(null);
    setMessage(null);
    setAvatarPath(null);
    setMessage("Avatar removal ready to save.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      setDisplayName(savedDisplayName);
      setAvatarPath(savedAvatarPath);
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
        avatarPath,
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
    const nextAvatarPath = payload.profile.avatarPath ?? null;
    const nextPreferences = payload.profile.preferences;
    setDisplayName(nextDisplayName);
    setAvatarPath(nextAvatarPath);
    setWeeklyDigestEmails(nextPreferences.weeklyDigestEmails);
    setProductAnnouncements(nextPreferences.productAnnouncements);
    setSavedDisplayName(nextDisplayName);
    setSavedAvatarPath(nextAvatarPath);
    setSavedWeeklyDigestEmails(nextPreferences.weeklyDigestEmails);
    setSavedProductAnnouncements(nextPreferences.productAnnouncements);
    setMessage("Account settings saved.");
    setSaving(false);
  }

  return (
    <form id="account-settings-form" onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="Edit Profile" description="Update your identity details and communication preferences.">
        <div className="space-y-5">
          <FormField label="Avatar" description="Use a square image for best results. PNG, JPG, WEBP, or SVG up to 2MB.">
            <AvatarPicker
              avatarPath={avatarPath}
              fallbackLabel={avatarFallbackLabel}
              uploading={avatarUploading}
              onSelectFile={(file) => void handleAvatarUpload(file)}
              onRemove={() => void handleAvatarRemove()}
            />
          </FormField>

          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Display Name" description="Shown in team management and admin views.">
              <Input
                required
                minLength={2}
                maxLength={80}
                placeholder="Your name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </FormField>

            <FormField label="Email" description="Sign-in email is managed by your auth provider.">
              <Input value={email ?? ""} readOnly disabled />
            </FormField>

            <FormField label="Platform Role" description="Assigned by Myrivo platform administrators.">
              <Input value={globalRole.toUpperCase()} readOnly disabled />
            </FormField>
          </div>

          <div className="border-t border-border/70 pt-4">
            <p className="text-sm font-medium">Notification Preferences</p>
            <p className="mt-1 text-xs text-muted-foreground">Choose which optional account communications you receive.</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Weekly Digest Emails</p>
                  <p className="text-xs text-muted-foreground">A weekly summary of orders and storefront activity.</p>
                </div>
                <Checkbox checked={weeklyDigestEmails} onChange={(event) => setWeeklyDigestEmails(event.target.checked)} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Product Announcements</p>
                  <p className="text-xs text-muted-foreground">Occasional Myrivo product and release updates.</p>
                </div>
                <Checkbox checked={productAnnouncements} onChange={(event) => setProductAnnouncements(event.target.checked)} />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <DashboardFormActionBar
        formId="account-settings-form"
        saveLabel="Save changes"
        savePendingLabel="Saving..."
        savePending={saving || avatarUploading}
        saveDisabled={saving || avatarUploading || !isDirty}
        discardDisabled={saving || avatarUploading || !isDirty}
      />

      <FeedbackMessage type="success" message={message} />
      <FeedbackMessage type="error" message={error} />
    </form>
  );
}
