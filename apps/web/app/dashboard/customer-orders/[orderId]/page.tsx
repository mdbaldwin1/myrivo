import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { CustomerOrderDetailView } from "@/components/customer/customer-order-detail-view";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { resolveCustomerStorefrontLinksBySlug } from "@/lib/customer/storefront-links";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  orderId: z.string().uuid()
});

type DashboardCustomerOrderPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardCustomerOrderPage({ params, searchParams }: DashboardCustomerOrderPageProps) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null;
  const backHref = sanitizeReturnTo(requestedReturnTo, "/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const normalizedEmail = (user.email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    notFound();
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
    throw new Error(orderError.message);
  }

  if (!order) {
    notFound();
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
    throw new Error(itemsError.message);
  }

  const store = Array.isArray(order.stores) ? order.stores[0] : order.stores;
  const storefrontLinksBySlug = await resolveCustomerStorefrontLinksBySlug(store?.slug ? [store.slug] : []);
  const storefrontHref = store?.slug ? storefrontLinksBySlug[store.slug]?.storefrontHref ?? null : null;

  return <CustomerOrderDetailView order={order} items={items ?? []} backHref={backHref} storefrontHref={storefrontHref} />;
}
