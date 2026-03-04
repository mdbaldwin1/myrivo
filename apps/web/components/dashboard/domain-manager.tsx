"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
};

export function DomainManager() {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadDomains() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/stores/domains", { cache: "no-store" });
    const payload = (await response.json()) as { domains?: DomainRecord[]; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to load domains.");
      setLoading(false);
      return;
    }

    setDomains(payload.domains ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadDomains();
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
        <p className="text-sm text-muted-foreground">
          Add your domain and create TXT record `_myrivo-verification.yourdomain.com` with the token shown below, then click Verify.
        </p>

        <div className="flex gap-2">
          <Input value={newDomain} onChange={(event) => setNewDomain(event.target.value)} placeholder="shop.example.com" />
          <Button type="button" variant="outline" onClick={() => void addDomain()} disabled={saving || !newDomain.trim()}>
            Add
          </Button>
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
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => void verifyDomain(domain.id)} disabled={saving}>
                    Verify
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void setPrimary(domain.id)} disabled={saving || domain.verification_status !== "verified"}>
                    Set primary
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void deleteDomain(domain.id)} disabled={saving}>
                    Remove
                  </Button>
                </div>
              </div>

              {domain.verification_token ? (
                <p className="break-all text-muted-foreground">TXT token: {domain.verification_token}</p>
              ) : null}
            </li>
          ))}
        </ul>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </SectionCard>
  );
}
