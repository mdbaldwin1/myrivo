"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { notify } from "@/lib/feedback/toast";
import { cn } from "@/lib/utils";
import type { AccountNotificationPreferences } from "@/lib/notifications/preferences";

type AccountSettingsFormProps = {
  email: string | null;
  globalRole: "user" | "support" | "admin";
  initialDisplayName: string;
  initialAvatarPath: string | null;
  header?: ReactNode;
  mode?: "full" | "profile" | "settings";
  contentMaxWidthClassName?: string;
  initialPreferences: AccountNotificationPreferences;
};

type AccountProfileResponse = {
  ok?: boolean;
  profile?: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarPath: string | null;
    globalRole: "user" | "support" | "admin";
    preferences: AccountNotificationPreferences;
  };
  error?: string;
};

const preferenceKeys: Array<keyof AccountNotificationPreferences> = [
  "weeklyDigestEmails",
  "productAnnouncements",
  "notificationSoundEnabled",
  "orderAlertsEmail",
  "orderAlertsInApp",
  "inventoryAlertsEmail",
  "inventoryAlertsInApp",
  "systemAlertsEmail",
  "systemAlertsInApp",
  "teamAlertsEmail",
  "teamAlertsInApp"
];
const NOTIFICATION_SOUND_PREF_STORAGE_KEY = "myrivo.notificationSoundEnabled";

async function playNotificationPing() {
  if (typeof window === "undefined") {
    return;
  }
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  try {
    await context.resume();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(980, context.currentTime);
    gainNode.gain.setValueAtTime(0.0001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.24);
    await new Promise((resolve) => window.setTimeout(resolve, 280));
  } finally {
    await context.close();
  }
}

export function AccountSettingsForm({
  email,
  globalRole,
  initialDisplayName,
  initialAvatarPath,
  header,
  mode = "full",
  contentMaxWidthClassName = "max-w-5xl",
  initialPreferences
}: AccountSettingsFormProps) {
  const showProfileFields = mode !== "settings";
  const showNotificationPreferences = mode !== "profile";
  const sectionTitle = mode === "settings" ? "Notification Settings" : "Edit Profile";
  const sectionDescription =
    mode === "settings"
      ? "Manage how and when Myrivo communicates with you."
      : "Update your identity details and communication preferences.";
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [preferences, setPreferences] = useState<AccountNotificationPreferences>(initialPreferences);

  const [savedDisplayName, setSavedDisplayName] = useState(initialDisplayName);
  const [savedAvatarPath, setSavedAvatarPath] = useState(initialAvatarPath);
  const [savedPreferences, setSavedPreferences] = useState<AccountNotificationPreferences>(initialPreferences);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hasPreferenceChanges = preferenceKeys.some((key) => preferences[key] !== savedPreferences[key]);
  const isDirty =
    (showProfileFields && (displayName !== savedDisplayName || avatarPath !== savedAvatarPath)) ||
    (showNotificationPreferences && hasPreferenceChanges);

  const avatarFallbackLabel = useMemo(() => {
    const source = displayName.trim() || email?.split("@")[0] || "ME";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [displayName, email]);

  function setPreference(key: keyof AccountNotificationPreferences, checked: boolean) {
    if (key === "notificationSoundEnabled" && typeof window !== "undefined") {
      window.localStorage.setItem(NOTIFICATION_SOUND_PREF_STORAGE_KEY, checked ? "1" : "0");
    }
    setPreferences((current) => ({
      ...current,
      [key]: checked
    }));
  }

  async function cleanupUploadedAvatar(path: string) {
    await fetch("/api/user/avatar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        avatarPath: path,
        clearProfile: false
      })
    });
  }

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

    const previousAvatarPath = avatarPath;
    if (previousAvatarPath && previousAvatarPath !== savedAvatarPath && previousAvatarPath !== payload.avatarPath) {
      await cleanupUploadedAvatar(previousAvatarPath);
    }

    setAvatarPath(payload.avatarPath);
    setMessage("Avatar ready to save.");
    setAvatarUploading(false);
  }

  async function handleAvatarRemove() {
    setError(null);
    setMessage(null);
    if (avatarPath && avatarPath !== savedAvatarPath) {
      await cleanupUploadedAvatar(avatarPath);
    }
    setAvatarPath(null);
    setMessage("Avatar removal ready to save.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      if (avatarPath && avatarPath !== savedAvatarPath) {
        await cleanupUploadedAvatar(avatarPath);
      }
      setDisplayName(savedDisplayName);
      setAvatarPath(savedAvatarPath);
      setPreferences(savedPreferences);
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
        ...(showProfileFields ? { displayName, avatarPath } : {}),
        ...(showNotificationPreferences
          ? {
              preferences
            }
          : {})
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
    setPreferences(nextPreferences);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NOTIFICATION_SOUND_PREF_STORAGE_KEY, nextPreferences.notificationSoundEnabled ? "1" : "0");
    }
    setSavedDisplayName(nextDisplayName);
    setSavedAvatarPath(nextAvatarPath);
    setSavedPreferences(nextPreferences);
    notify.success("Account settings saved.");
    setMessage(null);
    setSaving(false);
  }

  return (
    <form id="account-settings-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-4">
        <div className={cn("mx-auto w-full space-y-4", contentMaxWidthClassName)}>
          {header}
          <SectionCard title={sectionTitle} description={sectionDescription}>
            <div className="space-y-5">
              {showProfileFields ? (
                <>
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
                </>
              ) : null}

              {showNotificationPreferences ? (
                <div className={showProfileFields ? "border-t border-border/70 pt-4" : ""}>
                  <p className="text-sm font-medium">Notification Preferences</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Configure operational alerts by channel and optional platform communications.
                  </p>

                  <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Alert Type</span>
                      <span className="text-center">Email</span>
                      <span className="text-center">In App</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Order Updates</p>
                          <p className="text-xs text-muted-foreground">New order and fulfillment state changes.</p>
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={preferences.orderAlertsEmail}
                            onChange={(event) => setPreference("orderAlertsEmail", event.target.checked)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={preferences.orderAlertsInApp}
                            onChange={(event) => setPreference("orderAlertsInApp", event.target.checked)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Inventory Alerts</p>
                          <p className="text-xs text-muted-foreground">Low stock and out-of-stock warnings.</p>
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={preferences.inventoryAlertsEmail}
                            onChange={(event) => setPreference("inventoryAlertsEmail", event.target.checked)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={preferences.inventoryAlertsInApp}
                            onChange={(event) => setPreference("inventoryAlertsInApp", event.target.checked)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">System Alerts</p>
                          <p className="text-xs text-muted-foreground">Setup and configuration reminders.</p>
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={preferences.systemAlertsEmail}
                            onChange={(event) => setPreference("systemAlertsEmail", event.target.checked)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={preferences.systemAlertsInApp}
                            onChange={(event) => setPreference("systemAlertsInApp", event.target.checked)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Team Activity</p>
                          <p className="text-xs text-muted-foreground">Member invites and team access events.</p>
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={preferences.teamAlertsEmail}
                            onChange={(event) => setPreference("teamAlertsEmail", event.target.checked)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={preferences.teamAlertsInApp}
                            onChange={(event) => setPreference("teamAlertsInApp", event.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Notification Sound</p>
                        <p className="text-xs text-muted-foreground">Play a ping when new unread notifications arrive while you are active.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => void playNotificationPing()}>
                          Test
                        </Button>
                        <Checkbox
                          checked={preferences.notificationSoundEnabled}
                          onChange={(event) => setPreference("notificationSoundEnabled", event.target.checked)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Weekly Digest Emails</p>
                        <p className="text-xs text-muted-foreground">A weekly summary of orders and storefront activity.</p>
                      </div>
                      <Checkbox
                        checked={preferences.weeklyDigestEmails}
                        onChange={(event) => setPreference("weeklyDigestEmails", event.target.checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Product Announcements</p>
                        <p className="text-xs text-muted-foreground">Occasional Myrivo product and release updates.</p>
                      </div>
                      <Checkbox
                        checked={preferences.productAnnouncements}
                        onChange={(event) => setPreference("productAnnouncements", event.target.checked)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>

      <DashboardFormActionBar
        formId="account-settings-form"
        saveLabel="Save changes"
        savePendingLabel="Saving..."
        savePending={saving || avatarUploading}
        saveDisabled={saving || avatarUploading || !isDirty}
        discardDisabled={saving || avatarUploading || !isDirty}
        statusMessage={error ?? message}
        statusVariant={error ? "error" : "info"}
      />
    </form>
  );
}
