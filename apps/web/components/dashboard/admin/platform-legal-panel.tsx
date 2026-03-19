"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { PlatformLegalVersionPreviewDialog } from "@/components/dashboard/admin/platform-legal-version-preview-dialog";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Flyout } from "@/components/ui/flyout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getManagedLegalDocumentScope, isPlatformLegalDocumentKey } from "@/lib/legal/document-keys";

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
    changeSummary: string | null;
    contentMarkdown: string;
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

type FlyoutMode = "create" | "edit" | "view";

const blankVersionForm = {
  documentId: "",
  versionLabel: "",
  isRequired: true,
  contentMarkdown: "",
  changeSummary: "",
  effectiveAt: "",
  publishNow: true,
  sendNoticeAfterPublish: false
};

type PlatformLegalPanelProps = {
  initialPayload?: LegalAdminResponse | null;
};

function formatScopeLabel(documentKey: string) {
  return getManagedLegalDocumentScope(documentKey as never) === "platform" ? "Platform" : "Storefront base";
}

function parseVersionLabel(label: string) {
  const match = label.trim().match(/^v(\d+)(?:\.(\d+))?$/i);
  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1] ?? "0", 10),
    minor: Number.parseInt(match[2] ?? "0", 10)
  };
}

function compareVersionLabels(left: string, right: string) {
  const leftParsed = parseVersionLabel(left);
  const rightParsed = parseVersionLabel(right);

  if (leftParsed && rightParsed) {
    if (leftParsed.major !== rightParsed.major) {
      return rightParsed.major - leftParsed.major;
    }
    if (leftParsed.minor !== rightParsed.minor) {
      return rightParsed.minor - leftParsed.minor;
    }
  }

  return right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });
}

export function PlatformLegalPanel({ initialPayload = null }: PlatformLegalPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingVersionId, setPublishingVersionId] = useState<string | null>(null);
  const [announcingVersionId, setAnnouncingVersionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payload, setPayload] = useState<LegalAdminResponse | null>(initialPayload);
  const [filters, setFilters] = useState({ userEmail: "", storeSlug: "", documentKey: "", versionLabel: "" });
  const [versionForm, setVersionForm] = useState(() => ({
    ...blankVersionForm,
    documentId: initialPayload?.documents[0]?.id || ""
  }));
  const [documentFilters, setDocumentFilters] = useState({
    query: "",
    scope: "all",
    status: "all"
  });
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutMode, setFlyoutMode] = useState<FlyoutMode>("create");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.userEmail.trim()) params.set("userEmail", filters.userEmail.trim());
    if (filters.storeSlug.trim()) params.set("storeSlug", filters.storeSlug.trim());
    if (filters.documentKey.trim()) params.set("documentKey", filters.documentKey.trim());
    if (filters.versionLabel.trim()) params.set("versionLabel", filters.versionLabel.trim());
    const query = params.toString();
    return query ? `/api/platform/legal/acceptances/export?${query}` : "/api/platform/legal/acceptances/export";
  }, [filters]);

  const selectedVersion = useMemo(
    () => (selectedVersionId ? (payload?.versions ?? []).find((entry) => entry.id === selectedVersionId) ?? null : null),
    [payload?.versions, selectedVersionId]
  );

  const previewDocumentTitle = useMemo(() => {
    if (flyoutMode === "view") {
      return selectedVersion?.documentTitle ?? "Legal Version";
    }
    return (payload?.documents ?? []).find((document) => document.id === versionForm.documentId)?.title ?? "Legal Document";
  }, [flyoutMode, payload?.documents, selectedVersion?.documentTitle, versionForm.documentId]);

  const filteredVersions = useMemo(() => {
    const normalizedQuery = documentFilters.query.trim().toLowerCase();
    return (payload?.versions ?? []).filter((version) => {
      const versionScope = formatScopeLabel(version.documentKey).toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        version.documentTitle.toLowerCase().includes(normalizedQuery) ||
        version.documentKey.toLowerCase().includes(normalizedQuery) ||
        version.versionLabel.toLowerCase().includes(normalizedQuery);
      const matchesScope = documentFilters.scope === "all" || versionScope === documentFilters.scope;
      const matchesStatus = documentFilters.status === "all" || version.status === documentFilters.status;
      return matchesQuery && matchesScope && matchesStatus;
    });
  }, [documentFilters.query, documentFilters.scope, documentFilters.status, payload?.versions]);

  const getLatestVersionForDocument = useCallback(
    (documentId: string) => {
      const matchingVersions = (payload?.versions ?? []).filter((version) => version.documentId === documentId);
      if (matchingVersions.length === 0) {
        return null;
      }

      return [...matchingVersions].sort((left, right) => {
        const versionCompare = compareVersionLabels(left.versionLabel, right.versionLabel);
        if (versionCompare !== 0) {
          return versionCompare;
        }

        const leftPublishedAt = left.publishedAt ? Date.parse(left.publishedAt) : 0;
        const rightPublishedAt = right.publishedAt ? Date.parse(right.publishedAt) : 0;
        if (leftPublishedAt !== rightPublishedAt) {
          return rightPublishedAt - leftPublishedAt;
        }

        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      })[0]!;
    },
    [payload?.versions]
  );

  const getSuggestedVersionLabel = useCallback(
    (documentId: string) => {
      const latestVersion = getLatestVersionForDocument(documentId);
      if (!latestVersion) {
        return "v1.0";
      }

      const latest = parseVersionLabel(latestVersion.versionLabel);
      if (!latest) {
        return latestVersion.versionLabel || "v1.0";
      }

      return `v${latest.major}.${latest.minor + 1}`;
    },
    [getLatestVersionForDocument]
  );

  const load = useCallback(async () => {
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
  }, [filters.documentKey, filters.storeSlug, filters.userEmail, filters.versionLabel]);

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

    const body = (await response.json()) as { error?: string; id?: string | null; published?: boolean };
    if (!response.ok) {
      setError(body.error ?? "Unable to create legal version.");
      setSaving(false);
      return;
    }

    if (body.published && versionForm.sendNoticeAfterPublish && body.id) {
      await announceVersion(body.id, { suppressNotice: true });
    }

    setVersionForm({
      ...blankVersionForm,
      documentId: payload?.documents[0]?.id || ""
    });
    setNotice(body.published ? "Legal version published." : "Legal version saved.");
    setSaving(false);
    setFlyoutOpen(false);
    await load();
  }

  async function updateDraftVersion() {
    if (!selectedVersionId || !versionForm.versionLabel.trim() || versionForm.contentMarkdown.trim().length < 40) {
      setError("Version label and at least 40 characters of content are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/platform/legal/versions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        versionId: selectedVersionId,
        versionLabel: versionForm.versionLabel.trim(),
        isRequired: versionForm.isRequired,
        contentMarkdown: versionForm.contentMarkdown,
        changeSummary: versionForm.changeSummary.trim() || undefined,
        effectiveAt: versionForm.effectiveAt ? new Date(versionForm.effectiveAt).toISOString() : undefined,
        publishNow: versionForm.publishNow
      })
    });

    const body = (await response.json()) as { error?: string; id?: string; published?: boolean };
    if (!response.ok) {
      setError(body.error ?? "Unable to update draft version.");
      setSaving(false);
      return;
    }

    if (body.published && versionForm.sendNoticeAfterPublish && body.id) {
      await announceVersion(body.id, { suppressNotice: true });
    }

    setNotice(body.published ? "Draft version published." : "Draft version updated.");
    setSaving(false);
    setFlyoutOpen(false);
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

  async function announceVersion(versionId: string, options?: { suppressNotice?: boolean }) {
    setAnnouncingVersionId(versionId);
    setError(null);
    if (!options?.suppressNotice) {
      setNotice(null);
    }

    const response = await fetch("/api/platform/legal/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId })
    });

    const body = (await response.json()) as { error?: string; sent?: number; skipped?: number };
    if (!response.ok) {
      setError(body.error ?? "Unable to send legal update notification.");
      setAnnouncingVersionId(null);
      return;
    }

    if (!options?.suppressNotice) {
      setNotice(`Legal update announcement sent to ${body.sent ?? 0} recipients (${body.skipped ?? 0} skipped from dedupe/preferences).`);
    }
    setAnnouncingVersionId(null);
  }

  function openCreateFlyout() {
    const initialDocumentId = payload?.documents[0]?.id || "";
    const latestVersion = initialDocumentId ? getLatestVersionForDocument(initialDocumentId) : null;
    setFlyoutMode("create");
    setSelectedVersionId(null);
    setVersionForm({
      ...blankVersionForm,
      documentId: initialDocumentId,
      versionLabel: initialDocumentId ? getSuggestedVersionLabel(initialDocumentId) : "",
      isRequired: latestVersion?.isRequired ?? true,
      contentMarkdown: latestVersion?.contentMarkdown ?? "",
      changeSummary: latestVersion?.changeSummary ?? ""
    });
    setFlyoutOpen(true);
  }

  function openVersionFlyout(versionId: string) {
    const version = (payload?.versions ?? []).find((entry) => entry.id === versionId) ?? null;
    if (!version) {
      return;
    }

    if (payload?.role === "admin" && version.status === "draft") {
      setFlyoutMode("edit");
      setSelectedVersionId(versionId);
      setVersionForm({
        ...blankVersionForm,
        documentId: version.documentId,
        versionLabel: version.versionLabel,
        isRequired: version.isRequired,
        contentMarkdown: version.contentMarkdown,
        changeSummary: version.changeSummary ?? "",
        effectiveAt: version.effectiveAt ? version.effectiveAt.slice(0, 16) : "",
        publishNow: false,
        sendNoticeAfterPublish: false
      });
      setFlyoutOpen(true);
      return;
    }

    setFlyoutMode("view");
    setSelectedVersionId(versionId);
    setFlyoutOpen(true);
  }

  const flyoutTitle =
    flyoutMode === "create"
      ? "Create Legal Version"
      : flyoutMode === "edit"
        ? selectedVersion
          ? `Edit ${selectedVersion.documentTitle} ${selectedVersion.versionLabel}`
          : "Edit Draft Legal Version"
        : selectedVersion
          ? `${selectedVersion.documentTitle} ${selectedVersion.versionLabel}`
          : "Legal Version";
  const flyoutDescription =
    flyoutMode === "create"
      ? "Create and optionally publish a new managed legal version using the admin-owned platform or storefront base documents."
      : flyoutMode === "edit"
        ? "Update the draft legal version before publishing it."
      : selectedVersion
        ? `${formatScopeLabel(selectedVersion.documentKey)} · ${selectedVersion.status}`
        : "View legal version details.";

  return (
    <section className="space-y-4">
      <AppAlert variant="error" message={error} />
      <AppAlert variant="success" message={notice} />

      <SectionCard
        title="Legal Documents"
        description="Review platform policies and storefront base templates, then create, publish, or announce updates from one list."
        action={
          <Button type="button" size="sm" onClick={openCreateFlyout} disabled={payload?.role !== "admin"}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-full sm:w-64"
            value={documentFilters.query}
            onChange={(event) => setDocumentFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search documents"
          />
          <Select
            className="w-full sm:w-44"
            value={documentFilters.scope}
            onChange={(event) => setDocumentFilters((current) => ({ ...current, scope: event.target.value }))}
          >
            <option value="all">All scopes</option>
            <option value="platform">Platform</option>
            <option value="storefront base">Storefront base</option>
          </Select>
          <Select
            className="w-full sm:w-40"
            value={documentFilters.status}
            onChange={(event) => setDocumentFilters((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="retired">Retired</option>
          </Select>
        </div>

        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVersions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-3 text-muted-foreground">
                    No legal documents match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredVersions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium">{version.documentTitle}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{version.documentKey}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatScopeLabel(version.documentKey)}</TableCell>
                    <TableCell>
                      <span className="capitalize">{version.status}</span>
                      <p className="text-xs text-muted-foreground">Required: {version.isRequired ? "Yes" : "No"}</p>
                    </TableCell>
                    <TableCell>{version.versionLabel}</TableCell>
                    <TableCell>{version.effectiveAt ? new Date(version.effectiveAt).toLocaleString() : "n/a"}</TableCell>
                    <TableCell>{version.publishedAt ? new Date(version.publishedAt).toLocaleString() : "n/a"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="ml-auto h-7 w-7 p-0" aria-label={`Open actions for ${version.documentTitle}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openVersionFlyout(version.id)}>
                            {payload?.role === "admin" && version.status === "draft" ? "Edit Draft" : "View"}
                          </DropdownMenuItem>
                          {payload?.role === "admin" && version.status === "draft" ? (
                            <DropdownMenuItem onClick={() => void publishDraft(version.id)}>
                              {publishingVersionId === version.id ? "Publishing..." : "Publish Draft"}
                            </DropdownMenuItem>
                          ) : null}
                          {payload?.role === "admin" && version.status === "published" && isPlatformLegalDocumentKey(version.documentKey) ? (
                            <DropdownMenuItem onClick={() => void announceVersion(version.id)}>
                              {announcingVersionId === version.id ? "Sending..." : "Send Update Notice"}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard title="Acceptance Lookup" description="Search acceptance records by user, store, document, and version.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            value={filters.userEmail}
            onChange={(event) => setFilters((current) => ({ ...current, userEmail: event.target.value }))}
            placeholder="User email contains"
          />
          <Input
            value={filters.storeSlug}
            onChange={(event) => setFilters((current) => ({ ...current, storeSlug: event.target.value }))}
            placeholder="Store slug"
          />
          <Input
            value={filters.documentKey}
            onChange={(event) => setFilters((current) => ({ ...current, documentKey: event.target.value }))}
            placeholder="Document key (platform_terms)"
          />
          <Input
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

      <Flyout
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        title={flyoutTitle}
        description={flyoutDescription}
        className="sm:max-w-3xl"
        footer={
          flyoutMode === "create" || flyoutMode === "edit"
            ? (
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setFlyoutOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    disabled={versionForm.contentMarkdown.trim().length < 10}
                  >
                    Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void (flyoutMode === "create" ? createVersion() : updateDraftVersion())}
                    disabled={saving || payload?.role !== "admin"}
                  >
                    {saving
                      ? "Saving..."
                      : versionForm.publishNow
                        ? versionForm.sendNoticeAfterPublish
                          ? "Publish & Send Notice"
                          : "Publish Version"
                        : flyoutMode === "create"
                          ? "Save Version"
                          : "Save Draft"}
                  </Button>
                </div>
              )
            : undefined
        }
      >
        {flyoutMode === "create" || flyoutMode === "edit" ? (
          <div className="space-y-4">
            <FormField label="Document">
              <Select
                value={versionForm.documentId}
                placeholder="Select a document"
                disabled={flyoutMode === "edit"}
                onChange={(event) => {
                  const nextDocumentId = event.target.value;
                  const latestVersion = getLatestVersionForDocument(nextDocumentId);
                  setVersionForm((current) => ({
                    ...current,
                    documentId: nextDocumentId,
                    versionLabel: getSuggestedVersionLabel(nextDocumentId),
                    isRequired: latestVersion?.isRequired ?? current.isRequired,
                    contentMarkdown: latestVersion?.contentMarkdown ?? "",
                    changeSummary: latestVersion?.changeSummary ?? ""
                  }));
                }}
              >
                {(payload?.documents ?? []).map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Version label">
                <Input value={versionForm.versionLabel} onChange={(event) => setVersionForm((current) => ({ ...current, versionLabel: event.target.value }))} placeholder="v1.1" />
              </FormField>
              <FormField label="Effective at">
                <DateTimePicker value={versionForm.effectiveAt} onChange={(value) => setVersionForm((current) => ({ ...current, effectiveAt: value }))} />
              </FormField>
            </div>

            <FormField label="Change summary" description="Optional short summary of what changed in this legal version.">
              <Input
                value={versionForm.changeSummary}
                onChange={(event) => setVersionForm((current) => ({ ...current, changeSummary: event.target.value }))}
                placeholder="Short summary of legal changes"
              />
            </FormField>

            <FormField label="Content">
              <Textarea
                rows={18}
                value={versionForm.contentMarkdown}
                onChange={(event) => setVersionForm((current) => ({ ...current, contentMarkdown: event.target.value }))}
                placeholder="# Policy&#10;&#10;Add the managed legal markdown content here..."
              />
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-2 rounded-md border border-border/70 p-3 text-sm">
                <Checkbox checked={versionForm.isRequired} onChange={(event) => setVersionForm((current) => ({ ...current, isRequired: event.target.checked }))} />
                <span>
                  <span className="font-medium text-foreground">Required</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Require acceptance for this version when it is published.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-border/70 p-3 text-sm">
                <Checkbox checked={versionForm.publishNow} onChange={(event) => setVersionForm((current) => ({ ...current, publishNow: event.target.checked }))} />
                <span>
                  <span className="font-medium text-foreground">Publish now</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Publish immediately instead of saving as a draft.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-border/70 p-3 text-sm">
                <Checkbox
                  checked={versionForm.sendNoticeAfterPublish}
                  disabled={!versionForm.publishNow}
                  onChange={(event) => setVersionForm((current) => ({ ...current, sendNoticeAfterPublish: event.target.checked }))}
                />
                <span>
                  <span className="font-medium text-foreground">Send update notice after publishing</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Send the legal update notification immediately after this version is published.</span>
                </span>
              </label>
            </div>
          </div>
        ) : selectedVersion ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Document">
                <Input value={selectedVersion.documentTitle} readOnly />
              </FormField>
              <FormField label="Scope">
                <Input value={formatScopeLabel(selectedVersion.documentKey)} readOnly />
              </FormField>
              <FormField label="Version label">
                <Input value={selectedVersion.versionLabel} readOnly />
              </FormField>
              <FormField label="Status">
                <Input value={selectedVersion.status} readOnly />
              </FormField>
              <FormField label="Effective at">
                <Input value={selectedVersion.effectiveAt ? new Date(selectedVersion.effectiveAt).toLocaleString() : "n/a"} readOnly />
              </FormField>
              <FormField label="Published at">
                <Input value={selectedVersion.publishedAt ? new Date(selectedVersion.publishedAt).toLocaleString() : "n/a"} readOnly />
              </FormField>
            </div>
            <FormField label="Required">
              <Input value={selectedVersion.isRequired ? "Yes" : "No"} readOnly />
            </FormField>
            <FormField label="Document key">
              <Input value={selectedVersion.documentKey} readOnly />
            </FormField>
            <FormField label="Change summary">
              <Input value={selectedVersion.changeSummary ?? "No summary recorded"} readOnly />
            </FormField>
            <div className="space-y-2">
              <p className="text-sm font-medium">Content</p>
              <LegalMarkdown content={selectedVersion.contentMarkdown} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a legal document version to view it.</p>
        )}
      </Flyout>

      <PlatformLegalVersionPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={flyoutMode === "view" ? `${selectedVersion?.documentTitle ?? "Legal Version"} ${selectedVersion?.versionLabel ?? ""}`.trim() : `${previewDocumentTitle} ${versionForm.versionLabel.trim() || "Draft"}`.trim()}
        description={
          flyoutMode === "view"
            ? `${selectedVersion ? formatScopeLabel(selectedVersion.documentKey) : "Legal version"} preview`
            : `${previewDocumentTitle} draft preview`
        }
        contentMarkdown={flyoutMode === "view" ? selectedVersion?.contentMarkdown ?? "" : versionForm.contentMarkdown}
      />
    </section>
  );
}
