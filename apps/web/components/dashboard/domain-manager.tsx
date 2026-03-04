"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";

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
};

type VercelVerificationRecord = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
  verified?: boolean;
};

function extractDnsRecordsFromMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const domainStatus = metadata.domainStatus;
  if (!domainStatus || typeof domainStatus !== "object" || Array.isArray(domainStatus)) {
    return [];
  }

  const verification = (domainStatus as { verification?: unknown }).verification;
  if (!Array.isArray(verification)) {
    return [];
  }

  return verification.filter((record): record is VercelVerificationRecord => typeof record === "object" && record !== null);
}

export function DomainManager() {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDomains() {
    const [domainsResponse, whiteLabelResponse] = await Promise.all([
      fetch("/api/stores/domains", { cache: "no-store" }),
      fetch("/api/stores/white-label", { cache: "no-store" })
    ]);
    const domainsPayload = (await domainsResponse.json()) as { domains?: DomainRecord[]; error?: string };
    const whiteLabelPayload = (await whiteLabelResponse.json()) as { enabled?: boolean; error?: string };
    return { domainsResponse, whiteLabelResponse, domainsPayload, whiteLabelPayload };
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addDomain() {
    if (!newDomain.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/stores/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: newDomain.trim() })
    });

    const payload = (await response.json()) as { domain?: DomainRecord; error?: string };

    if (!response.ok || !payload.domain) {
      setError(payload.error ?? "Unable to add domain.");
      setSaving(false);
      return;
    }

    setDomains((current) => [...current, payload.domain!]);
    setNewDomain("");
    setSaving(false);
  }

  async function toggleWhiteLabel(nextEnabled: boolean) {
    setSaving(true);
    setError(null);

    const response = await fetch("/api/stores/white-label", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled })
    });
    const payload = (await response.json()) as { enabled?: boolean; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to update white-label mode.");
      setSaving(false);
      return;
    }

    setWhiteLabelEnabled(Boolean(payload.enabled));
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
    setSaving(false);
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
    setSaving(false);
  }

  return (
    <SectionCard title="Custom Domains">
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium">White Label & Domain Setup</p>
          <p className="mt-1 text-xs text-muted-foreground">
            White labeling uses your store name and logo automatically. Turn it on, then add a domain and complete DNS verification.
          </p>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2">
            <div>
              <p className="text-sm font-medium">White Labeling</p>
              <p className="text-xs text-muted-foreground">Enable custom domains and branded browser metadata.</p>
            </div>
            <Button
              type="button"
              variant={whiteLabelEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => void toggleWhiteLabel(!whiteLabelEnabled)}
              disabled={saving || loading}
            >
              {whiteLabelEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              value={newDomain}
              onChange={(event) => setNewDomain(event.target.value)}
              placeholder={whiteLabelEnabled ? "shop.example.com" : "Enable white labeling first"}
              disabled={!whiteLabelEnabled}
            />
            <Button type="button" variant="outline" onClick={() => void addDomain()} disabled={saving || !newDomain.trim() || !whiteLabelEnabled}>
              Add
            </Button>
          </div>
          {!whiteLabelEnabled ? <p className="mt-2 text-xs text-muted-foreground">Custom domains are available when white labeling is enabled.</p> : null}
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading domains...</p> : null}

        <ul className="space-y-2">
          {domains.length === 0 ? <li className="text-sm text-muted-foreground">No domains configured.</li> : null}
          {domains.map((domain) => (
            <li key={domain.id} className="space-y-2 rounded-md border border-border/60 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{domain.domain}</p>
                  <p className="text-muted-foreground">
                    Status: {domain.verification_status}
                    {domain.is_primary ? " · Primary" : ""}
                  </p>
                  <p className="text-muted-foreground">Hosting: {domain.hosting_status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => void verifyDomain(domain.id)} disabled={saving}>
                    Verify & Provision
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void setPrimary(domain.id)} disabled={saving || domain.verification_status !== "verified"}>
                    Set primary
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void deleteDomain(domain.id)} disabled={saving}>
                    Remove
                  </Button>
                </div>
              </div>

              {(() => {
                const dnsRecords = extractDnsRecordsFromMetadata(domain.hosting_metadata_json).filter((record) => record.verified !== true);
                if (dnsRecords.length === 0) {
                  return null;
                }

                return (
                  <div className="space-y-1 rounded-md border border-dashed border-border/60 bg-background p-2">
                    <p className="text-muted-foreground">Vercel DNS records needed:</p>
                    {dnsRecords.map((record, index) => (
                      <p key={`${domain.id}-dns-${index}`} className="break-all text-muted-foreground">
                        {record.type ?? "Record"} {record.domain ?? "(host missing)"} {"->"} {record.value ?? "(value missing)"}
                        {record.reason ? ` (${record.reason})` : ""}
                      </p>
                    ))}
                  </div>
                );
              })()}

              {domain.hosting_status === "provisioning" && !extractDnsRecordsFromMetadata(domain.hosting_metadata_json).length ? (
                <p className="text-muted-foreground">
                  If your registrar needs values: `www` CNAME to `cname.vercel-dns.com` and apex `@` A to `76.76.21.21`.
                </p>
              ) : null}

              {domain.verification_token ? (
                <p className="break-all text-muted-foreground">TXT token: {domain.verification_token}</p>
              ) : null}
              {domain.hosting_error ? <p className="break-all text-red-600">Hosting error: {domain.hosting_error}</p> : null}
              {domain.hosting_last_checked_at ? (
                <p className="text-muted-foreground">Hosting checked: {new Date(domain.hosting_last_checked_at).toLocaleString()}</p>
              ) : null}
            </li>
          ))}
        </ul>

        <FeedbackMessage type="error" message={error} />
      </div>
    </SectionCard>
  );
}
