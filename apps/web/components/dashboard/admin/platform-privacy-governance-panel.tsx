"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { Switch } from "@/components/ui/switch";

type SettingsResponse = {
  role?: "user" | "support" | "admin";
  settings?: {
    notice_at_collection_enabled: boolean;
    checkout_notice_enabled: boolean;
    newsletter_notice_enabled: boolean;
    review_notice_enabled: boolean;
    show_california_notice: boolean;
    show_do_not_sell_link: boolean;
  };
  error?: string;
};

const EMPTY_SETTINGS = {
  notice_at_collection_enabled: true,
  checkout_notice_enabled: true,
  newsletter_notice_enabled: true,
  review_notice_enabled: true,
  show_california_notice: false,
  show_do_not_sell_link: false
};

export function PlatformPrivacyGovernancePanel() {
  const [role, setRole] = useState<"user" | "support" | "admin">("user");
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/platform/privacy-settings", { cache: "no-store" });
      const payload = (await response.json()) as SettingsResponse;

      if (cancelled) {
        return;
      }

      if (!response.ok || !payload.settings) {
        setError(payload.error ?? "Unable to load storefront privacy governance.");
        setLoading(false);
        return;
      }

      setRole(payload.role ?? "user");
      setSettings(payload.settings);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/platform/privacy-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    const payload = (await response.json()) as SettingsResponse;

    if (!response.ok || !payload.settings) {
      setError(payload.error ?? "Unable to save storefront privacy governance.");
      setSaving(false);
      return;
    }

    setSettings(payload.settings);
    setNotice("Storefront privacy governance saved.");
    setSaving(false);
  }

  return (
    <SectionCard
      title="Storefront Privacy Governance"
      description="These switches control the shared privacy surfaces rendered across every storefront. Stores only control contacts, request intro, and store-specific addenda."
    >
      {loading ? <p className="text-sm text-muted-foreground">Loading privacy governance...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      {!loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex min-h-11 items-center justify-between rounded-xl border border-border/70 bg-background px-3 text-sm">
              <span>Enable notice at collection</span>
              <Switch
                checked={settings.notice_at_collection_enabled}
                disabled={role !== "admin"}
                onChange={(event) => setSettings((current) => ({ ...current, notice_at_collection_enabled: event.target.checked }))}
              />
            </label>
            <label className="flex min-h-11 items-center justify-between rounded-xl border border-border/70 bg-background px-3 text-sm">
              <span>Show California privacy rights section</span>
              <Switch
                checked={settings.show_california_notice}
                disabled={role !== "admin"}
                onChange={(event) => setSettings((current) => ({ ...current, show_california_notice: event.target.checked }))}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex min-h-11 items-center justify-between rounded-xl border border-border/70 bg-background px-3 text-sm">
              <span>Checkout notice</span>
              <Switch
                checked={settings.checkout_notice_enabled}
                disabled={role !== "admin" || !settings.notice_at_collection_enabled}
                onChange={(event) => setSettings((current) => ({ ...current, checkout_notice_enabled: event.target.checked }))}
              />
            </label>
            <label className="flex min-h-11 items-center justify-between rounded-xl border border-border/70 bg-background px-3 text-sm">
              <span>Newsletter notice</span>
              <Switch
                checked={settings.newsletter_notice_enabled}
                disabled={role !== "admin" || !settings.notice_at_collection_enabled}
                onChange={(event) => setSettings((current) => ({ ...current, newsletter_notice_enabled: event.target.checked }))}
              />
            </label>
            <label className="flex min-h-11 items-center justify-between rounded-xl border border-border/70 bg-background px-3 text-sm">
              <span>Review notice</span>
              <Switch
                checked={settings.review_notice_enabled}
                disabled={role !== "admin" || !settings.notice_at_collection_enabled}
                onChange={(event) => setSettings((current) => ({ ...current, review_notice_enabled: event.target.checked }))}
              />
            </label>
          </div>

          <label className="flex min-h-11 items-center justify-between rounded-xl border border-border/70 bg-background px-3 text-sm">
            <span>Show Do Not Sell / Share link</span>
            <Switch
              checked={settings.show_do_not_sell_link}
              disabled={role !== "admin" || !settings.show_california_notice}
              onChange={(event) => setSettings((current) => ({ ...current, show_do_not_sell_link: event.target.checked }))}
            />
          </label>

          {role === "admin" ? (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving..." : "Save Privacy Governance"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Only admins can change storefront privacy governance.</p>
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}
