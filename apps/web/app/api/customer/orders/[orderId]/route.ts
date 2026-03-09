import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedCustomerUser } from "@/lib/customer/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  orderId: z.string().uuid()
});

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return auth.response;
  }

  const normalizedEmail = (auth.user.email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return NextResponse.json({ error: "No customer email available for this account." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id,store_id,customer_email,customer_first_name,customer_last_name,customer_note,fulfillment_method,fulfillment_label,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone,status,fulfillment_status,created_at,fulfilled_at,shipped_at,delivered_at,subtotal_cents,shipping_fee_cents,discount_cents,total_cents,currency,carrier,tracking_number,tracking_url,shipment_status,stores(id,name,slug)"
    )
    .eq("id", parsedParams.data.orderId)
    .ilike("customer_email", normalizedEmail)
    .maybeSingle<{
      id: string;
      store_id: string;
      customer_email: string;
      customer_first_name: string | null;
      customer_last_name: string | null;
      customer_note: string | null;
      fulfillment_method: "pickup" | "shipping" | null;
      fulfillment_label: string | null;
      pickup_location_snapshot_json: Record<string, unknown> | null;
      pickup_window_start_at: string | null;
      pickup_window_end_at: string | null;
      pickup_timezone: string | null;
      status: "pending" | "paid" | "failed" | "cancelled";
      fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
      created_at: string;
      fulfilled_at: string | null;
      shipped_at: string | null;
      delivered_at: string | null;
      subtotal_cents: number;
      shipping_fee_cents: number;
      discount_cents: number;
      total_cents: number;
      currency: string;
      carrier: string | null;
      tracking_number: string | null;
      tracking_url: string | null;
      shipment_status: string | null;
      stores: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    }>();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id,quantity,unit_price_cents,variant_label,products(id,title)")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true })
    .returns<
      Array<{
        id: string;
        quantity: number;
        unit_price_cents: number;
        variant_label: string | null;
        products: { id: string; title: string } | { id: string; title: string }[] | null;
      }>
    >();

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({
    order,
    items: items ?? []
  });
}
