"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRANDED_SENDER_ENABLED } from "@/lib/notifications/branded-sender";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/feedback/toast";
import { buildStoreWorkspacePath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type DomainRecord = {
  id: string;
  domain: string;
  is_primary: boolean;
  verification_status: "pending" | "verified" | "failed";
  verification_token: string | null;
  last_verification_at: string | null;
  verified_at: string | null;
  hosting_provider: "vercel";
  hosting_status: "pending" | "provisioning" | "ready" | "failed" | "not_configured";
  hosting_last_checked_at: string | null;
  hosting_ready_at: string | null;
  hosting_error: string | null;
  hosting_metadata_json: Record<string, unknown> | null;
  email_provider: "resend";
  email_sender_enabled: boolean;
  email_status: "pending" | "provisioning" | "ready" | "failed" | "not_configured";
  email_domain_id: string | null;
  email_last_checked_at: string | null;
  email_ready_at: string | null;
  email_error: string | null;
  email_metadata_json: Record<string, unknown> | null;
};

type VercelVerificationRecord = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
  verified?: boolean;
};

type VercelDomainConfig = {
  recommendedIPv4?: Array<{ rank?: number; value?: string[] }>;
  recommendedCNAME?: Array<{ rank?: number; value?: string }>;
  aValues?: string[];
  cnames?: string[];
};

type DnsInstruction = {
  provider: "myrivo" | "vercel" | "resend";
  type: string;
  host: string;
  value: string;
  ttl: string;
  required: boolean;
  purpose: string;
};

function getInstructionTooltipText(instruction: DnsInstruction) {
  const providerLabel =
    instruction.provider === "myrivo" ? "Ownership verification" : instruction.provider === "vercel" ? "Storefront hosting" : "Email sending";
  return `${providerLabel} - ${instruction.required ? "Required" : "Optional"} - ${instruction.purpose}`;
}

type ResendDnsRecord = {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  status?: string;
  ttl?: string;
  priority?: number;
};

type HoverTooltip = {
  text: string;
  x: number;
  y: number;
};

function extractRecommendedDnsRecordsFromMetadata(metadata: Record<string, unknown> | null, apexDomain: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const domainConfig = metadata.domainConfig;
  if (!domainConfig || typeof domainConfig !== "object" || Array.isArray(domainConfig)) {
    return [];
  }

  const config = domainConfig as VercelDomainConfig;
  const records: VercelVerificationRecord[] = [];

  const rankedIpv4 = (config.recommendedIPv4 ?? []).filter((entry) => Array.isArray(entry.value) && entry.value.length > 0);
  rankedIpv4.sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  for (const value of rankedIpv4[0]?.value ?? []) {
    records.push({ type: "A", domain: apexDomain, value });
  }

  const rankedCname = (config.recommendedCNAME ?? []).filter((entry) => typeof entry.value === "string" && entry.value.trim().length > 0);
  rankedCname.sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  const cnameValue = rankedCname[0]?.value?.trim() ?? config.cnames?.[0]?.trim();
  if (cnameValue) {
    records.push({ type: "CNAME", domain: `www.${apexDomain}`, value: cnameValue.replace(/\.$/, "") });
  }

  return records;
}

function extractDnsRecordsFromMetadata(metadata: Record<string, unknown> | null, apexDomain: string) {
  const records: VercelVerificationRecord[] = [];

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return records;
  }

  const domainStatus = metadata.domainStatus;
  if (domainStatus && typeof domainStatus === "object" && !Array.isArray(domainStatus)) {
    const verification = (domainStatus as { verification?: unknown }).verification;
    if (Array.isArray(verification)) {
      records.push(...verification.filter((record): record is VercelVerificationRecord => typeof record === "object" && record !== null));
    }
  }

  records.push(...extractRecommendedDnsRecordsFromMetadata(metadata, apexDomain));
  const deduped = new Map<string, VercelVerificationRecord>();
  for (const record of records) {
    const key = `${record.type ?? ""}|${record.domain ?? ""}|${record.value ?? ""}`.toLowerCase();
    deduped.set(key, record);
  }
  return Array.from(deduped.values());
}

function extractResendDnsRecordsFromMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [] as ResendDnsRecord[];
  }

  const candidateValues: unknown[] = [];
  const asRecord = metadata as Record<string, unknown>;
  if (asRecord.domain && typeof asRecord.domain === "object" && !Array.isArray(asRecord.domain)) {
    candidateValues.push((asRecord.domain as Record<string, unknown>).records);
  }
  if (asRecord.getPayload && typeof asRecord.getPayload === "object" && !Array.isArray(asRecord.getPayload)) {
    const data = (asRecord.getPayload as Record<string, unknown>).data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      candidateValues.push((data as Record<string, unknown>).records);
    }
  }

  for (const value of candidateValues) {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is ResendDnsRecord => Boolean(entry) && typeof entry === "object");
    }
  }

  return [] as ResendDnsRecord[];
}

function formatHostForProvider(recordDomain: string, apexDomain: string) {
  const normalizedRecordDomain = recordDomain.trim().toLowerCase().replace(/\.$/, "");
  const normalizedApex = apexDomain.trim().toLowerCase().replace(/\.$/, "");
  if (normalizedRecordDomain === normalizedApex) {
    return "@";
  }
  const suffix = `.${normalizedApex}`;
  if (normalizedRecordDomain.endsWith(suffix)) {
    return normalizedRecordDomain.slice(0, -suffix.length);
  }
  return normalizedRecordDomain;
}

function buildDnsInstructions(domain: DomainRecord, dnsRecords: VercelVerificationRecord[], resendRecords: ResendDnsRecord[]): DnsInstruction[] {
  const instructions: DnsInstruction[] = [];

  if (domain.verification_token) {
    instructions.push({
      provider: "myrivo",
      type: "TXT",
      host: "_myrivo-verification",
      value: domain.verification_token,
      ttl: "300",
      required: true,
      purpose: "Verifies domain ownership so Myrivo can validate your domain."
    });
  }

  const vercelRows: DnsInstruction[] = [];
  for (const record of dnsRecords) {
    if (!record.type || !record.domain || !record.value) {
      continue;
    }
    vercelRows.push({
      provider: "vercel",
      type: record.type.toUpperCase(),
      host: formatHostForProvider(record.domain, domain.domain),
      value: record.value,
      ttl: "300",
      required: !(record.type.toUpperCase() === "CNAME" && formatHostForProvider(record.domain, domain.domain) === "www"),
      purpose:
        record.type.toUpperCase() === "A" && formatHostForProvider(record.domain, domain.domain) === "@"
          ? "Required: routes your apex domain to Vercel."
          : record.type.toUpperCase() === "CNAME" && formatHostForProvider(record.domain, domain.domain) === "www"
            ? "Optional but recommended: enables www.yourdomain.com."
            : "Connects this host to Vercel for serving your storefront."
    });
  }

  instructions.push(...vercelRows);

  const hasWwwRow = vercelRows.some((row) => row.host === "www");
  const cnameFallbackValue =
    vercelRows.find((row) => row.type === "CNAME")?.value ??
    "cname.vercel-dns.com";
  if (!hasWwwRow) {
    instructions.push({
      provider: "vercel",
      type: "CNAME",
      host: "www",
      value: cnameFallbackValue,
      ttl: "300",
      required: false,
      purpose: "Enables the www subdomain to resolve to your storefront."
    });
  }

  for (const record of resendRecords) {
    const type = record.record?.trim().toUpperCase() || record.type?.trim().toUpperCase();
    const name = record.name?.trim();
    const value = record.value?.trim();
    if (!type || !name || !value) {
      continue;
    }

    const status = record.status?.trim().toLowerCase() ?? "";
    const host = formatHostForProvider(name, domain.domain);
    const priorityPrefix = typeof record.priority === "number" && Number.isFinite(record.priority) ? `${record.priority} ` : "";
    instructions.push({
      provider: "resend",
      type,
      host,
      value: type === "MX" ? `${priorityPrefix}${value}`.trim() : value,
      ttl: record.ttl?.trim() || "300",
      required: type !== "CNAME" || host !== "www",
      purpose:
        status === "verified"
          ? "Configured for email sending."
          : type === "TXT"
            ? "Required for SPF/verification so transactional emails can be delivered."
            : type === "CNAME"
              ? "Required for DKIM/signing so inbox providers trust your messages."
              : type === "MX"
                ? "Required for return-path and bounce handling."
                : "Required for email domain verification in Resend."
    });
  }

  return instructions;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}

function validateDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "Domain is required.";
  }

  if (!/^[a-z0-9.-]+$/.test(trimmed)) {
    return "Use letters, numbers, dots, and dashes only.";
  }

  if (!trimmed.includes(".")) {
    return "Enter a fully-qualified domain like shop.example.com.";
  }

  return null;
}

function getLeftmostLabel(domain: string) {
  const labels = domain.trim().toLowerCase().split(".").filter(Boolean);
  if (labels.length < 3) {
    return "@";
  }
  return labels[0] ?? "@";
}

function isDnsActionStillRequired(domain: DomainRecord) {
  if (domain.hosting_status !== "ready") {
    return true;
  }
  const metadata = domain.hosting_metadata_json;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const domainConfig = metadata.domainConfig;
  if (!domainConfig || typeof domainConfig !== "object" || Array.isArray(domainConfig)) {
    return false;
  }
  return (domainConfig as { misconfigured?: unknown }).misconfigured === true;
}

function getDomainSetupState(domain: DomainRecord) {
  if (domain.verification_status !== "verified") {
    return "needs_verification" as const;
  }
  if (isDnsActionStillRequired(domain)) {
    return "needs_dns" as const;
  }
  return "connected" as const;
}

export function DomainManager() {
  const pathname = usePathname();
  const activeStoreSlug = getStoreSlugFromDashboardPathname(pathname);
  const generalSettingsHref = buildStoreWorkspacePath(activeStoreSlug, "/store-settings/general", "/dashboard/stores");
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);
  const [dnsPanelOpenById, setDnsPanelOpenById] = useState<Record<string, boolean>>({});

  function isDnsPanelOpen(domain: DomainRecord) {
    const override = dnsPanelOpenById[domain.id];
    if (typeof override === "boolean") {
      return override;
    }
    return getDomainSetupState(domain) !== "connected";
  }

  function toggleDnsInstructions(domain: DomainRecord) {
    const nextOpen = !isDnsPanelOpen(domain);
    setDnsPanelOpenById((current) => ({
      ...current,
      [domain.id]: nextOpen
    }));
  }

  async function refreshVerifiedDomainDnsRecords(records: DomainRecord[]) {
    const verifiedDomains = records.filter((record) => record.verification_status === "verified");
    if (verifiedDomains.length === 0) {
      return;
    }

    const refreshed = await Promise.all(
      verifiedDomains.map(async (record) => {
        const response = await fetch(`/api/stores/domains/${record.id}/verify`, { method: "POST" });
        const payload = (await response.json().catch(() => ({}))) as { domain?: DomainRecord };
        if (!response.ok || !payload.domain) {
          return null;
        }
        return payload.domain;
      })
    );

    const updates = refreshed.filter((record): record is DomainRecord => record !== null);
    if (updates.length === 0) {
      return;
    }

    const updatesById = new Map(updates.map((record) => [record.id, record]));
    setDomains((current) => current.map((record) => updatesById.get(record.id) ?? record));
  }

  async function fetchDomains() {
    const [domainsResponse, whiteLabelResponse] = await Promise.all([
      fetch("/api/stores/domains", { cache: "no-store" }),
      fetch("/api/stores/white-label", { cache: "no-store" })
    ]);
    const domainsPayload = (await domainsResponse.json()) as { domains?: DomainRecord[]; error?: string };
    const whiteLabelPayload = (await whiteLabelResponse.json()) as { enabled?: boolean; error?: string };
    return { domainsResponse, whiteLabelResponse, domainsPayload, whiteLabelPayload };
  }

  async function reloadDomains() {
    setError(null);
    const result = await fetchDomains();

    if (!result.domainsResponse.ok) {
      setError(result.domainsPayload.error ?? "Unable to load domains.");
      setLoading(false);
      return;
    }

    if (!result.whiteLabelResponse.ok) {
      setError(result.whiteLabelPayload.error ?? "Unable to load white-label settings.");
      setLoading(false);
      return;
    }

    setDomains(result.domainsPayload.domains ?? []);
    setWhiteLabelEnabled(Boolean(result.whiteLabelPayload.enabled));
    setLoading(false);
    void refreshVerifiedDomainDnsRecords(result.domainsPayload.domains ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchDomains();
      if (cancelled) {
        return;
      }
      if (!result.domainsResponse.ok) {
        setError(result.domainsPayload.error ?? "Unable to load domains.");
        setLoading(false);
        return;
      }
      if (!result.whiteLabelResponse.ok) {
        setError(result.whiteLabelPayload.error ?? "Unable to load white-label settings.");
        setLoading(false);
        return;
      }
      setDomains(result.domainsPayload.domains ?? []);
      setWhiteLabelEnabled(Boolean(result.whiteLabelPayload.enabled));
      setLoading(false);
      void refreshVerifiedDomainDnsRecords(result.domainsPayload.domains ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addDomain() {
    const validationError = validateDomain(newDomain);
    if (validationError) {
      setError(validationError);
      return;
    }

    const candidate = newDomain.trim().toLowerCase();
    const duplicate = domains.some((entry) => entry.domain.toLowerCase() === candidate);
    if (duplicate) {
      setError("That domain is already listed.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/stores/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: candidate })
    });

    const payload = (await response.json()) as { domain?: DomainRecord; error?: string };

    if (!response.ok || !payload.domain) {
      setError(payload.error ?? "Unable to add domain.");
      setSaving(false);
      return;
    }

    setDomains((current) => [...current, payload.domain!]);
    setNewDomain("");
    notify.success("Domain added.");
    setAddModalOpen(false);
    setSaving(false);
  }

  async function verifyDomain(id: string) {
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/stores/domains/${id}/verify`, { method: "POST" });
    const payload = (await response.json()) as { domain?: DomainRecord; error?: string };

    if (!response.ok || !payload.domain) {
      setError(payload.error ?? "Unable to verify domain.");
      setSaving(false);
      return;
    }

    setDomains((current) => current.map((entry) => (entry.id === id ? payload.domain! : entry)));
    notify.success("Domain verification check complete.");
    setSaving(false);
  }

  async function setPrimary(id: string) {
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/stores/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true })
    });

    const payload = (await response.json()) as { domain?: DomainRecord; error?: string };

    if (!response.ok || !payload.domain) {
      setError(payload.error ?? "Unable to update primary domain.");
      setSaving(false);
      return;
    }

    setDomains((current) => current.map((entry) => ({ ...entry, is_primary: entry.id === id })));
    notify.success("Primary domain updated.");
    setSaving(false);
  }

  async function setEmailSenderEnabled(id: string, enabled: boolean) {
    if (!BRANDED_SENDER_ENABLED) {
      notify.error("Branded sender domains are currently disabled.");
      return;
    }
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/stores/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailSenderEnabled: enabled })
    });

    const payload = (await response.json()) as { domain?: DomainRecord; error?: string };
    if (!response.ok || !payload.domain) {
      setError(payload.error ?? "Unable to update email sender settings.");
      setSaving(false);
      return;
    }

    setDomains((current) => current.map((entry) => (entry.id === id ? payload.domain! : entry)));
    if (enabled) {
      await verifyDomain(id);
    } else {
      notify.success("Branded sender disabled. Platform sender fallback will be used.");
      setSaving(false);
    }
  }

  async function deleteDomain(id: string) {
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/stores/domains/${id}`, { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to remove domain.");
      setSaving(false);
      return;
    }

    setDomains((current) => current.filter((entry) => entry.id !== id));
    notify.success("Domain removed.");
    setSaving(false);
  }

  async function copyTextToClipboard(value: string, label: string) {
    if (!navigator?.clipboard) {
      notify.error("Clipboard not available in this browser.");
      return;
    }
    await navigator.clipboard.writeText(value);
    notify.success(`${label} copied.`);
  }

  const domainRows = useMemo(
    () =>
      domains.map((domain) => ({
        ...domain,
        dnsRecords: extractDnsRecordsFromMetadata(domain.hosting_metadata_json, domain.domain).filter((record) => record.verified !== true),
        emailDnsRecords: extractResendDnsRecordsFromMetadata(domain.email_metadata_json).filter(
          (record) => record.status?.trim().toLowerCase() !== "verified"
        ),
        dnsInstructions: buildDnsInstructions(
          domain,
          extractDnsRecordsFromMetadata(domain.hosting_metadata_json, domain.domain).filter((record) => record.verified !== true),
          extractResendDnsRecordsFromMetadata(domain.email_metadata_json).filter((record) => record.status?.trim().toLowerCase() !== "verified")
        )
      })),
    [domains]
  );

  if (!loading && !whiteLabelEnabled) {
    return (
      <SectionCard
        title="Domain Management"
        description="Enable white labeling to connect and verify custom storefront domains."
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Custom domains are currently disabled. Turn on White Labeling in General settings to manage domains.
          </p>
          <div>
            <Button type="button" variant="outline" asChild>
              <Link href={generalSettingsHref}>Go to General</Link>
            </Button>
          </div>
          <AppAlert variant="error" message={error} />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Domain List"
      description="Manage custom domains, DNS verification, and primary domain selection for your storefront."
      action={
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void reloadDomains()} disabled={loading || saving}>
            Refresh
          </Button>
          <DialogPrimitive.Root open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button type="button" size="sm" disabled={saving || loading || !whiteLabelEnabled}>
                Add Domain
              </Button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
              <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[61] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-6 shadow-lg">
                <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Add Domain</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                  Add a domain like shop.example.com, then complete DNS verification.
                </DialogPrimitive.Description>
                <div className="mt-4 space-y-4">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Domain Name</span>
                    <Input
                      value={newDomain}
                      onChange={(event) => setNewDomain(event.target.value)}
                      placeholder="shop.example.com"
                      autoFocus
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">Use a fully-qualified domain. You can set it as primary after verification.</p>
                  <div className="flex justify-end gap-2">
                    <DialogPrimitive.Close asChild>
                      <Button type="button" variant="outline" disabled={saving}>
                        Cancel
                      </Button>
                    </DialogPrimitive.Close>
                    <Button type="button" onClick={() => void addDomain()} disabled={saving || !newDomain.trim()}>
                      {saving ? "Adding..." : "Add Domain"}
                    </Button>
                  </div>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>
      }
    >
      <div className="space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Loading domains...</p> : null}

        {!loading ? (
          <ul className="space-y-3">
            {domainRows.length === 0 ? <li className="text-sm text-muted-foreground">No domains configured.</li> : null}
            {domainRows.map((domain) => (
              <li key={domain.id} className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
                {(() => {
                  const setupState = getDomainSetupState(domain);
                  const stateLabel =
                    setupState === "connected" ? "Connected" : setupState === "needs_dns" ? "Needs DNS setup" : "Needs ownership verification";
                  const stateClasses =
                    setupState === "connected"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : setupState === "needs_dns"
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-blue-300 bg-blue-50 text-blue-700";
                  const primaryActionLabel =
                    setupState === "needs_verification" ? "Verify ownership" : setupState === "needs_dns" ? "Refresh DNS status" : "Refresh status";
                  const showDnsTable = isDnsPanelOpen(domain);

                  return (
                    <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{domain.domain}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {domain.is_primary ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          Primary
                        </span>
                      ) : null}
                      <span className={`rounded-full border px-2 py-0.5 font-medium ${stateClasses}`}>{stateLabel}</span>
                      <span>Last checked: {formatDate(domain.hosting_last_checked_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => void verifyDomain(domain.id)} disabled={saving}>
                      {primaryActionLabel}
                    </Button>
                    {BRANDED_SENDER_ENABLED ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void setEmailSenderEnabled(domain.id, !domain.email_sender_enabled)}
                        disabled={saving}
                      >
                        {domain.email_sender_enabled ? "Disable branded sender" : "Enable branded sender"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void setPrimary(domain.id)}
                      disabled={saving || domain.verification_status !== "verified" || domain.is_primary}
                    >
                      Set primary
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void deleteDomain(domain.id)} disabled={saving}>
                      Remove
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {setupState === "connected"
                    ? "Domain is active and routed to your storefront."
                    : setupState === "needs_dns"
                      ? "Ownership is verified. Add or correct DNS records below, then refresh status."
                      : "Add the TXT verification record below, wait for DNS propagation, then verify ownership."}
                </p>
                <AppAlert
                  variant="warning"
                  className="break-all text-xs"
                  message={domain.hosting_error ? `Hosting error: ${domain.hosting_error}` : null}
                />
                <AppAlert
                  variant="warning"
                  className="break-all text-xs"
                  message={domain.email_error ? `Email error: ${domain.email_error}` : null}
                />
                {domain.dnsInstructions.length > 0 ? (
                  <div className="space-y-2 rounded-md border border-dashed border-border/60 bg-background p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">DNS Setup Instructions</p>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => toggleDnsInstructions(domain)}
                        aria-label={showDnsTable ? "Collapse DNS setup instructions" : "Expand DNS setup instructions"}
                        title={showDnsTable ? "Collapse DNS setup instructions" : "Expand DNS setup instructions"}
                      >
                        {showDnsTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    {setupState === "connected" ? (
                      <div className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-800">DNS is configured and active.</div>
                    ) : null}
                    {setupState === "needs_dns" && domain.dnsInstructions.some((instruction) => instruction.type === "A" && instruction.host === "@") ? (
                      <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
                        Required next step: add the apex <span className="font-mono">A</span> record(s) for host{" "}
                        <span className="font-mono">@</span> exactly as shown below.
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">
                      Email sender status:{" "}
                      <span className="font-medium">
                        {!BRANDED_SENDER_ENABLED
                          ? "Platform sender only"
                          : !domain.email_sender_enabled
                          ? "Using platform sender"
                          : domain.email_status === "ready"
                            ? "Ready"
                            : domain.email_status === "not_configured"
                              ? "Not configured on server"
                              : domain.email_status === "failed"
                                ? "Failed"
                                : "Pending DNS setup"}
                      </span>
                      {domain.email_provider ? ` (${domain.email_provider})` : ""}
                    </p>
                    {!BRANDED_SENDER_ENABLED ? (
                      <p className="text-muted-foreground">
                        Custom sender domains are disabled right now. Emails send from the platform sender with your support email as reply-to.
                      </p>
                    ) : null}
                    {showDnsTable ? (
                      <>
                        <p className="text-muted-foreground">In Namecheap, add these records in Advanced DNS. Use the exact Host and Value fields shown below.</p>
                        <p className="text-muted-foreground">
                          The table combines ownership verification (Myrivo), storefront hosting (Vercel), and transactional email (Resend).
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] border-collapse text-left">
                            <thead>
                              <tr className="border-b border-border/60 text-muted-foreground">
                                <th className="py-1 pr-3 font-medium">Provider</th>
                                <th className="py-1 pr-3 font-medium">Type</th>
                                <th className="py-1 pr-3 font-medium">Host</th>
                                <th className="py-1 pr-3 font-medium">Value</th>
                                <th className="py-1 font-medium">TTL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {domain.dnsInstructions.map((instruction, index) => (
                                <tr
                                  key={`${domain.id}-instruction-${index}`}
                                  className="border-b border-border/30 align-middle hover:bg-muted/40"
                                  onMouseEnter={(event) =>
                                    setHoverTooltip({
                                      text: getInstructionTooltipText(instruction),
                                      x: event.clientX + 12,
                                      y: event.clientY + 12
                                    })
                                  }
                                  onMouseMove={(event) =>
                                    setHoverTooltip((current) =>
                                      current
                                        ? {
                                            ...current,
                                            x: event.clientX + 12,
                                            y: event.clientY + 12
                                          }
                                        : null
                                    )
                                  }
                                  onMouseLeave={() => setHoverTooltip(null)}
                                >
                                  <td className="py-1 pr-3 align-middle">
                                    <span className="rounded border border-border/60 px-1.5 py-0.5 text-[11px] uppercase">
                                      {instruction.provider}
                                    </span>
                                  </td>
                                  <td className="py-1 pr-3 align-middle">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono">{instruction.type}</span>
                                    </div>
                                  </td>
                                  <td className="py-1 pr-3 align-middle">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono">{instruction.host}</span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        aria-label="Copy host"
                                        title="Copy host"
                                        onClick={() => void copyTextToClipboard(instruction.host, "Host")}
                                        disabled={saving}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                  <td className="py-1 pr-3 align-middle">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono break-all">{instruction.value}</span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        aria-label="Copy value"
                                        title="Copy value"
                                        onClick={() => void copyTextToClipboard(instruction.value, "Value")}
                                        disabled={saving}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                  <td className="py-1 align-middle">{instruction.ttl}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-muted-foreground">
                          Use Vercel-provided values above when available. For Namecheap, host values should be relative (for example{" "}
                          <span className="font-mono">@</span>, <span className="font-mono">www</span>, or{" "}
                          <span className="font-mono">{getLeftmostLabel(domain.domain)}</span>). After saving DNS changes, wait for propagation and
                          click Verify.
                        </p>
                        <p className="text-muted-foreground">
                          For email sender setup, add all rows labeled <span className="font-mono">resend</span>. Once DNS propagates, click Verify to
                          refresh domain and email readiness.
                        </p>
                      </>
                    ) : null}
                  </div>
                ) : null}
                    </>
                  );
                })()}
              </li>
            ))}
          </ul>
        ) : null}

        <AppAlert variant="error" message={error} />
      </div>
      {hoverTooltip ? (
        <div
          className="pointer-events-none fixed z-[70] max-w-xs rounded-md border border-border/70 bg-white px-2 py-1 text-xs text-foreground shadow-lg"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
        >
          {hoverTooltip.text}
        </div>
      ) : null}
    </SectionCard>
  );
}
