"use client";

import { useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type LegalAdminResponse = {
  role: "user" | "support" | "admin";
  documents: Array<{
    id: string;
    key: string;
    title: string;
    audience: "all" | "merchant" | "customer" | "platform";
    isActive: boolean;
  }>;
  versions: Array<{
    id: string;
    documentId: string;
    documentKey: string;
    documentTitle: string;
    versionLabel: string;
    status: "draft" | "published" | "retired";
    isRequired: boolean;
    effectiveAt: string | null;
    publishedAt: string | null;
    createdAt: string;
  }>;
  acceptances: Array<{
    id: string;
    acceptedAt: string;
    acceptanceSurface: string;
    userId: string;
    userEmail: string | null;
    storeId: string | null;
    storeSlug: string | null;
    documentKey: string;
    documentTitle: string;
    versionLabel: string;
  }>;
  error?: string;
};

const blankVersionForm = {
  documentId: "",
  versionLabel: "",
  isRequired: true,
  contentMarkdown: "",
  changeSummary: "",
  effectiveAt: "",
  publishNow: true
};

export function PlatformLegalPanel() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingVersionId, setPublishingVersionId] = useState<string | null>(null);
  const [announcingVersionId, setAnnouncingVersionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payload, setPayload] = useState<LegalAdminResponse | null>(null);
  const [filters, setFilters] = useState({ userEmail: "", storeSlug: "", documentKey: "", versionLabel: "" });
  const [versionForm, setVersionForm] = useState(blankVersionForm);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.userEmail.trim()) params.set("userEmail", filters.userEmail.trim());
    if (filters.storeSlug.trim()) params.set("storeSlug", filters.storeSlug.trim());
    if (filters.documentKey.trim()) params.set("documentKey", filters.documentKey.trim());
    if (filters.versionLabel.trim()) params.set("versionLabel", filters.versionLabel.trim());
    const query = params.toString();
    return query ? `/api/platform/legal/acceptances/export?${query}` : "/api/platform/legal/acceptances/export";
  }, [filters]);

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);

    const params = new URLSearchParams();
    if (filters.userEmail.trim()) params.set("userEmail", filters.userEmail.trim());
    if (filters.storeSlug.trim()) params.set("storeSlug", filters.storeSlug.trim());
    if (filters.documentKey.trim()) params.set("documentKey", filters.documentKey.trim());
    if (filters.versionLabel.trim()) params.set("versionLabel", filters.versionLabel.trim());

    const query = params.toString();
    const response = await fetch(query ? `/api/platform/legal?${query}` : "/api/platform/legal", { cache: "no-store" });
    const body = (await response.json()) as LegalAdminResponse;

    if (!response.ok) {
      setError(body.error ?? "Unable to load legal admin data.");
      setLoading(false);
      return;
    }

    setPayload(body);
    setVersionForm((current) => ({
      ...current,
      documentId: current.documentId || body.documents[0]?.id || ""
    }));
    setLoading(false);
  }

  async function createVersion() {
    if (!versionForm.documentId || !versionForm.versionLabel.trim() || versionForm.contentMarkdown.trim().length < 40) {
      setError("Document, version label, and at least 40 characters of content are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/platform/legal/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: versionForm.documentId,
        versionLabel: versionForm.versionLabel.trim(),
        isRequired: versionForm.isRequired,
        contentMarkdown: versionForm.contentMarkdown,
        changeSummary: versionForm.changeSummary.trim() || undefined,
        effectiveAt: versionForm.effectiveAt ? new Date(versionForm.effectiveAt).toISOString() : undefined,
        publishNow: versionForm.publishNow
      })
    });

    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Unable to create legal version.");
      setSaving(false);
      return;
    }

    setVersionForm(blankVersionForm);
    setNotice("Legal version saved.");
    setSaving(false);
    await load();
  }

  async function publishDraft(versionId: string) {
    setPublishingVersionId(versionId);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/platform/legal/versions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId })
    });

    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Unable to publish draft version.");
      setPublishingVersionId(null);
      return;
    }

    setNotice("Draft version published.");
    setPublishingVersionId(null);
    await load();
  }

  async function announceVersion(versionId: string) {
    setAnnouncingVersionId(versionId);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/platform/legal/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId })
    });

    const body = (await response.json()) as { error?: string; sent?: number; skipped?: number; recipients?: number };
    if (!response.ok) {
      setError(body.error ?? "Unable to send legal update notification.");
      setAnnouncingVersionId(null);
      return;
    }

    setNotice(`Legal update announcement sent to ${body.sent ?? 0} recipients (${body.skipped ?? 0} skipped from dedupe/preferences).`);
    setAnnouncingVersionId(null);
  }

  return (
    <section className="space-y-4">
      <SectionCard title="Legal Version Management" description="Create, publish, and review legal document versions with effective dates.">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
        <AppAlert variant="error" message={error} className="mt-2" />
        <AppAlert variant="success" message={notice} className="mt-2" />

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Document</span>
            <select
              className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
              value={versionForm.documentId}
              onChange={(event) => setVersionForm((current) => ({ ...current, documentId: event.target.value }))}
            >
              <option value="">Select a document</option>
              {(payload?.documents ?? []).map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title} ({document.key})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Version label</span>
            <input
              className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
              value={versionForm.versionLabel}
              onChange={(event) => setVersionForm((current) => ({ ...current, versionLabel: event.target.value }))}
              placeholder="v1.1"
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Change summary (optional)</span>
            <input
              className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
              value={versionForm.changeSummary}
              onChange={(event) => setVersionForm((current) => ({ ...current, changeSummary: event.target.value }))}
              placeholder="Short summary of legal changes"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Effective at (optional)</span>
            <input
              type="datetime-local"
              className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
              value={versionForm.effectiveAt}
              onChange={(event) => setVersionForm((current) => ({ ...current, effectiveAt: event.target.value }))}
            />
          </label>

          <div className="flex items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={versionForm.isRequired}
                onChange={(event) => setVersionForm((current) => ({ ...current, isRequired: event.target.checked }))}
              />
              Required
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={versionForm.publishNow}
                onChange={(event) => setVersionForm((current) => ({ ...current, publishNow: event.target.checked }))}
              />
              Publish now
            </label>
          </div>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Content (markdown)</span>
            <textarea
              className="min-h-40 w-full rounded-md border border-border/70 bg-background px-2 py-2 text-sm"
              value={versionForm.contentMarkdown}
              onChange={(event) => setVersionForm((current) => ({ ...current, contentMarkdown: event.target.value }))}
              placeholder="# Terms\n\nAdd legal markdown content here..."
            />
          </label>

          <div className="md:col-span-2">
            <Button type="button" size="sm" onClick={() => void createVersion()} disabled={saving || payload?.role !== "admin"}>
              {saving ? "Saving..." : "Save Version"}
            </Button>
            {payload?.role !== "admin" ? <p className="mt-1 text-xs text-muted-foreground">Only admins can publish or create versions.</p> : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Recent Versions" description="Publish drafts and verify effective schedule.">
        {!payload?.versions?.length ? <p className="text-sm text-muted-foreground">No legal versions found.</p> : null}
        <div className="space-y-2">
          {(payload?.versions ?? []).map((version) => (
            <div key={version.id} className="rounded-md border border-border/70 px-3 py-2 text-sm">
              <p className="font-medium">
                {version.documentTitle} · {version.versionLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {version.documentKey} · {version.status} · required: {version.isRequired ? "yes" : "no"} · effective: {version.effectiveAt ? new Date(version.effectiveAt).toLocaleString() : "n/a"}
              </p>
              {payload?.role === "admin" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {version.status === "published" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={announcingVersionId === version.id}
                      onClick={() => void announceVersion(version.id)}
                    >
                      {announcingVersionId === version.id ? "Sending..." : "Send Update Notice"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={version.status !== "draft" || publishingVersionId === version.id}
                    onClick={() => void publishDraft(version.id)}
                  >
                    {publishingVersionId === version.id ? "Publishing..." : "Publish Draft"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Acceptance Lookup" description="Search acceptance records by user, store, document, and version.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
            value={filters.userEmail}
            onChange={(event) => setFilters((current) => ({ ...current, userEmail: event.target.value }))}
            placeholder="User email contains"
          />
          <input
            className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
            value={filters.storeSlug}
            onChange={(event) => setFilters((current) => ({ ...current, storeSlug: event.target.value }))}
            placeholder="Store slug"
          />
          <input
            className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
            value={filters.documentKey}
            onChange={(event) => setFilters((current) => ({ ...current, documentKey: event.target.value }))}
            placeholder="Document key (terms)"
          />
          <input
            className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
            value={filters.versionLabel}
            onChange={(event) => setFilters((current) => ({ ...current, versionLabel: event.target.value }))}
            placeholder="Version label"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void load()} disabled={loading}>
            Apply Filters
          </Button>
          <a href={exportUrl}>
            <Button type="button" size="sm" variant="outline">
              Export CSV
            </Button>
          </a>
        </div>

        {!payload?.acceptances?.length ? <p className="mt-3 text-sm text-muted-foreground">No acceptance records loaded yet.</p> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Accepted</th>
                <th className="px-2 py-2">Document</th>
                <th className="px-2 py-2">Version</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Store</th>
                <th className="px-2 py-2">Surface</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.acceptances ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/40 align-top">
                  <td className="px-2 py-2">{new Date(row.acceptedAt).toLocaleString()}</td>
                  <td className="px-2 py-2">
                    {row.documentTitle}
                    <p className="text-xs text-muted-foreground">{row.documentKey}</p>
                  </td>
                  <td className="px-2 py-2">{row.versionLabel}</td>
                  <td className="px-2 py-2">
                    {row.userEmail ?? row.userId}
                    <p className="text-xs text-muted-foreground">{row.userId}</p>
                  </td>
                  <td className="px-2 py-2">{row.storeSlug ?? "n/a"}</td>
                  <td className="px-2 py-2">{row.acceptanceSurface}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </section>
  );
}
