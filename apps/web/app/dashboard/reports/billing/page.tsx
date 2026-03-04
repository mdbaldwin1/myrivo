import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BillingEventRow = {
  id: string;
  event_type: string;
  source: string | null;
  occurred_at: string;
  created_at: string;
  payload_json: Record<string, unknown>;
};

export default async function DashboardReportsBillingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundle(user.id);
  if (!bundle) {
    return null;
  }

  const { data: events, error: eventsError } = await supabase
    .from("billing_events")
    .select("id,event_type,source,occurred_at,created_at,payload_json")
    .eq("store_id", bundle.store.id)
    .order("occurred_at", { ascending: false })
    .limit(200)
    .returns<BillingEventRow[]>();

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Reports · Billing"
        description="Billing event history for auditability and support troubleshooting."
      />
      <SectionCard title="Billing Events">
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No billing events recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Occurred</TableHead>
                <TableHead>Payload Keys</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events ?? []).map((event) => {
                const payloadKeys =
                  event.payload_json && typeof event.payload_json === "object" && !Array.isArray(event.payload_json)
                    ? Object.keys(event.payload_json).slice(0, 5)
                    : [];
                return (
                  <TableRow key={event.id}>
                    <TableCell>{event.event_type}</TableCell>
                    <TableCell>{event.source ?? "-"}</TableCell>
                    <TableCell>{new Date(event.occurred_at).toLocaleString()}</TableCell>
                    <TableCell>{payloadKeys.length > 0 ? payloadKeys.join(", ") : "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </section>
  );
}
