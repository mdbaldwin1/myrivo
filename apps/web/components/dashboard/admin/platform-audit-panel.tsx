"use client";

import { useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type PlatformAuditResponse = {
  role: "user" | "support" | "admin";
  events: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    store: { id: string; name: string; slug: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" } | null;
    actor: { id: string; email: string | null; display_name: string | null; global_role: "user" | "support" | "admin" } | null;
  }>;
  error?: string;
};

const DEFAULT_LIMIT = 100;

export function PlatformAuditPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [storeId, setStoreId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [events, setEvents] = useState<PlatformAuditResponse["events"]>([]);

  async function load() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: String(DEFAULT_LIMIT) });
    if (entity.trim()) params.set("entity", entity.trim());
    if (action.trim()) params.set("action", action.trim());
    if (storeId.trim()) params.set("storeId", storeId.trim());
    if (actorUserId.trim()) params.set("actorUserId", actorUserId.trim());

    const response = await fetch(`/api/platform/audit?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as PlatformAuditResponse;
    if (!response.ok) {
      setError(payload.error ?? "Unable to load audit events.");
      setLoading(false);
      return;
    }
    setEvents(payload.events);
    setLoading(false);
  }

  return (
    <section className="space-y-4">
      <SectionCard title="Filters" description="Filter platform audit events by action, entity, store, or actor.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            placeholder="entity (ex: store)"
          />
          <input
            className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="action (ex: update)"
          />
          <input
            className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            placeholder="storeId (uuid)"
          />
          <input
            className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
            value={actorUserId}
            onChange={(event) => setActorUserId(event.target.value)}
            placeholder="actorUserId (uuid)"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Apply Filters"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEntity("");
              setAction("");
              setStoreId("");
              setActorUserId("");
              setEvents([]);
              setError(null);
            }}
            disabled={loading}
          >
            Reset
          </Button>
        </div>
        <AppAlert variant="error" message={error} className="mt-2" />
      </SectionCard>

      <SectionCard title="Audit Events" description="Most recent platform-level events matching your filters.">
        {events.length === 0 ? <p className="text-sm text-muted-foreground">No events loaded. Apply filters to fetch events.</p> : null}
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-md border border-border/70 px-3 py-2 text-sm">
              <p className="font-medium">
                {event.entity}.{event.action}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString()} · store: {event.store?.name ?? "n/a"} · actor:{" "}
                {event.actor?.display_name ?? event.actor?.email ?? "n/a"}
              </p>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/30 p-2 text-[11px] text-muted-foreground">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}
