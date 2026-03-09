"use client";

import { useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import type { AuditEventRecord } from "@/types/database";

type AuditEventsPanelProps = {
  initialEvents: Array<Pick<AuditEventRecord, "id" | "action" | "entity" | "entity_id" | "metadata" | "created_at">>;
};

type AuditEventsResponse = {
  events?: Array<Pick<AuditEventRecord, "id" | "action" | "entity" | "entity_id" | "metadata" | "created_at">>;
  error?: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function AuditEventsPanel({ initialEvents }: AuditEventsPanelProps) {
  const [events, setEvents] = useState(initialEvents);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commonActions = useMemo(() => {
    return [...new Set(initialEvents.map((event) => event.action))].slice(0, 8);
  }, [initialEvents]);

  async function applyFilters() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: "50" });

    if (actionFilter.trim().length > 0) {
      params.set("action", actionFilter.trim());
    }

    if (entityFilter.trim().length > 0) {
      params.set("entity", entityFilter.trim());
    }

    const response = await fetch(`/api/audit-events?${params.toString()}`, { method: "GET" });
    const payload = (await response.json()) as AuditEventsResponse;

    setLoading(false);

    if (!response.ok || !payload.events) {
      setError(payload.error ?? "Unable to load audit events.");
      return;
    }

    setEvents(payload.events);
  }

  return (
    <SectionCard
      title="Recent Audit Events"
      description="Track sensitive merchant actions for support investigations and operational confidence."
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="audit-action" className="text-xs uppercase tracking-wide text-muted-foreground">Action</Label>
            <Input
              id="audit-action"
              list="audit-actions"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              placeholder="promotion.created"
            />
            <p className="text-xs text-muted-foreground">Example actions: `promotion.created`, `order.shipped`, `product.updated`.</p>
            <datalist id="audit-actions">
              {commonActions.map((action) => (
                <option key={action} value={action} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-entity" className="text-xs uppercase tracking-wide text-muted-foreground">Entity</Label>
            <Input
              id="audit-entity"
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
              placeholder="order"
            />
            <p className="text-xs text-muted-foreground">Filter by resource type such as `order`, `product`, or `store`.</p>
          </div>

          <Button type="button" onClick={() => void applyFilters()} disabled={loading} className="h-fit self-end">
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>

        <AppAlert variant="error" message={error} />

        <ul className="space-y-2">
          {events.length === 0 ? (
            <li className="rounded-md border border-border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">No events found.</li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="space-y-2 rounded-md border border-border bg-muted/25 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="bg-background font-medium">{event.action}</Badge>
                  <Badge variant="outline" className="bg-background">{event.entity}</Badge>
                  {event.entity_id ? (
                    <Badge variant="outline" className="bg-background text-muted-foreground">{event.entity_id}</Badge>
                  ) : null}
                  <span className="ml-auto text-muted-foreground">{formatDate(event.created_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{JSON.stringify(event.metadata)}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </SectionCard>
  );
}
