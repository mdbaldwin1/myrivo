import { NextResponse } from "next/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id);

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id,customer_email,currency,subtotal_cents,discount_cents,total_cents,status,fulfillment_status,promo_code,carrier,tracking_number,tracking_url,shipment_status,created_at"
    )
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "order_id",
    "created_at",
    "customer_email",
    "currency",
    "subtotal_cents",
    "discount_cents",
    "total_cents",
    "status",
    "fulfillment_status",
    "promo_code",
    "carrier",
    "tracking_number",
    "tracking_url",
    "shipment_status"
  ];

  const rows = (orders ?? []).map((order) =>
    [
      order.id,
      order.created_at,
      order.customer_email,
      order.currency,
      order.subtotal_cents,
      order.discount_cents,
      order.total_cents,
      order.status,
      order.fulfillment_status,
      order.promo_code,
      order.carrier,
      order.tracking_number,
      order.tracking_url,
      order.shipment_status
    ]
      .map((value) => escapeCsv(value))
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=orders-${bundle.store.slug}.csv`
    }
  });
}
