"use client";

type OrderTimelineEvent = {
  id: string;
  action: string;
  actor_user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

type OrderActivityTimelinePanelProps = {
  events: OrderTimelineEvent[];
};

function describeTimelineEvent(event: OrderTimelineEvent) {
  const shippingDelayId = typeof event.metadata.shippingDelayId === "string" ? event.metadata.shippingDelayId : null;
  const reasonKey = typeof event.metadata.reasonKey === "string" ? event.metadata.reasonKey.replaceAll("_", " ") : null;
  const nextStatus = typeof event.metadata.nextStatus === "string" ? event.metadata.nextStatus.replaceAll("_", " ") : null;
  const revisedShipDate = typeof event.metadata.revisedShipDate === "string" ? event.metadata.revisedShipDate : null;

  switch (event.action) {
    case "shipping_delay_recorded":
      return {
        title: "Shipping delay recorded",
        body: [
          reasonKey ? `Reason: ${reasonKey}.` : null,
          revisedShipDate ? `Revised ship date: ${revisedShipDate}.` : null,
          shippingDelayId ? `Delay case: ${shippingDelayId.slice(0, 8)}.` : null
        ]
          .filter(Boolean)
          .join(" ")
      };
    case "shipping_delay_updated":
      return {
        title: "Shipping delay updated",
        body: [
          reasonKey ? `Updated reason: ${reasonKey}.` : null,
          revisedShipDate ? `Updated revised ship date: ${revisedShipDate}.` : null
        ]
          .filter(Boolean)
          .join(" ")
      };
    case "shipping_delay_status_updated":
      return {
        title: "Shipping delay status changed",
        body: nextStatus ? `Status moved to ${nextStatus}.` : "The shipping delay status changed."
      };
    case "shipping_delay_resolved":
      return {
        title: "Shipping delay resolved",
        body: "The store marked the delay workflow as resolved."
      };
    case "shipping_delay_customer_approved":
      return {
        title: "Customer approved revised ship date",
        body: revisedShipDate ? `The customer approved the revised ship date of ${revisedShipDate}.` : "The customer approved the revised timing."
      };
    case "shipping_delay_customer_cancel_requested":
      return {
        title: "Customer requested cancellation",
        body: "The customer asked the store to cancel the delayed order or review refund handling."
      };
    default:
      return {
        title: event.action.replaceAll("_", " "),
        body: ""
      };
  }
}

export function OrderActivityTimelinePanel({ events }: OrderActivityTimelinePanelProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Activity timeline</h3>
      <ol className="space-y-3">
        {events.map((event) => {
          const summary = describeTimelineEvent(event);
          return (
            <li key={event.id} className="rounded-xl border border-border/70 bg-background px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{summary.title}</p>
                  {summary.body ? <p className="text-sm text-muted-foreground">{summary.body}</p> : null}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
