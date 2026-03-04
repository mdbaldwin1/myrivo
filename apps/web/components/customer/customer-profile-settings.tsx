"use client";

import { useMemo, useState } from "react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { AvatarPicker } from "@/components/ui/avatar-picker";

type CustomerProfileSettingsProps = {
  email: string | null;
  displayName: string | null;
  initialAvatarPath: string | null;
};

export function CustomerProfileSettings({ email, displayName, initialAvatarPath }: CustomerProfileSettingsProps) {
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fallbackLabel = useMemo(() => {
    const source = displayName?.trim() || email?.split("@")[0] || "ME";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [displayName, email]);

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

  async function persistAvatar(nextAvatarPath: string | null): Promise<boolean> {
    const response = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarPath: nextAvatarPath })
    });
    const payload = (await response.json()) as { profile?: { avatarPath: string | null }; error?: string };
    if (!response.ok || !payload.profile) {
      setError(payload.error ?? "Unable to update avatar.");
      return false;
    }
    setAvatarPath(payload.profile.avatarPath ?? null);
    return true;
  }

  async function handleAvatarUpload(file: File) {
    setUploading(true);
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
      setUploading(false);
      return;
    }

    const persisted = await persistAvatar(payload.avatarPath);
    if (!persisted) {
      await cleanupUploadedAvatar(payload.avatarPath);
    }
    if (persisted) {
      setMessage("Avatar updated.");
    }
    setUploading(false);
  }

  async function handleAvatarRemove() {
    setUploading(true);
    setError(null);
    setMessage(null);
    const persisted = await persistAvatar(null);
    if (persisted) {
      setMessage("Avatar removed.");
    }
    setUploading(false);
  }

  return (
    <div className="space-y-3">
      <FormField label="Email">
        <Input value={email ?? ""} readOnly disabled />
      </FormField>
      <FormField label="Display Name">
        <Input value={displayName ?? ""} readOnly disabled />
      </FormField>
      <FormField label="Avatar" description="Upload PNG, JPG, WEBP, or SVG up to 2MB.">
        <AvatarPicker
          avatarPath={avatarPath}
          fallbackLabel={fallbackLabel}
          uploading={uploading}
          onSelectFile={(file) => void handleAvatarUpload(file)}
          onRemove={() => void handleAvatarRemove()}
        />
      </FormField>
      <FeedbackMessage type="success" message={message} />
      <FeedbackMessage type="error" message={error} />
    </div>
  );
}
