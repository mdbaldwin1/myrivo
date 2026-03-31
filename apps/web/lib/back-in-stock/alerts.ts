import { sendBackInStockEmail } from "@/lib/marketing-email/back-in-stock";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type VariantRestockInput = {
  storeId: string;
  productId: string;
  variantId: string;
};

type VariantAlertRow = {
  id: string;
  email: string;
  alert_count: number;
};

export function findRestockedVariantIds(
  previousVariants: Array<{ id: string; inventory_qty: number; status: "active" | "archived" }>,
  nextVariants: Array<{ id: string; inventory_qty: number; status: "active" | "archived" }>
) {
  const previousById = new Map(previousVariants.map((variant) => [variant.id, variant]));
  return nextVariants
    .filter((variant) => {
      if (variant.status !== "active" || variant.inventory_qty <= 0) {
        return false;
      }
      const previous = previousById.get(variant.id);
      return previous ? previous.inventory_qty <= 0 : false;
    })
    .map((variant) => variant.id);
}

export async function processBackInStockAlertsForVariants(variants: VariantRestockInput[]) {
  if (variants.length === 0) {
    return;
  }

  const admin = createSupabaseAdminClient();
  for (const variantInput of variants) {
    const { data: variant, error: variantError } = await admin
      .from("product_variants")
      .select("id,title,inventory_qty,status,products!inner(id,title,slug),stores!inner(id,name,slug),store_settings(support_email)")
      .eq("id", variantInput.variantId)
      .eq("store_id", variantInput.storeId)
      .eq("product_id", variantInput.productId)
      .maybeSingle<{
        id: string;
        title: string | null;
        inventory_qty: number;
        status: "active" | "archived";
        products: { id: string; title: string; slug: string } | { id: string; title: string; slug: string }[] | null;
        stores: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
        store_settings: { support_email: string | null } | { support_email: string | null }[] | null;
      }>();

    if (variantError || !variant || variant.status !== "active" || variant.inventory_qty <= 0) {
      continue;
    }

    const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
    const store = Array.isArray(variant.stores) ? variant.stores[0] : variant.stores;
    const settings = Array.isArray(variant.store_settings) ? variant.store_settings[0] : variant.store_settings;
    if (!product || !store) {
      continue;
    }

    const { data: alerts, error: alertsError } = await admin
      .from("back_in_stock_alerts")
      .select("id,email,alert_count")
      .eq("store_id", variantInput.storeId)
      .eq("product_id", variantInput.productId)
      .eq("product_variant_id", variantInput.variantId)
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .returns<VariantAlertRow[]>();

    if (alertsError || !alerts || alerts.length === 0) {
      continue;
    }

    for (const alert of alerts) {
      const sendResult = await sendBackInStockEmail({
        store: {
          name: store.name,
          slug: store.slug,
          supportEmail: settings?.support_email ?? null
        },
        product: {
          title: product.title,
          slug: product.slug || product.id
        },
        variant: {
          title: variant.title
        },
        recipientEmail: alert.email
      });

      if (!sendResult.ok) {
        console.error("back-in-stock email send failed", {
          alertId: alert.id,
          variantId: variantInput.variantId,
          error: sendResult.error
        });
        continue;
      }

      const sentAt = new Date().toISOString();
      await admin
        .from("back_in_stock_alerts")
        .update({
          status: "sent",
          alert_count: (alert.alert_count ?? 0) + 1,
          sent_at: sentAt,
          last_alert_sent_at: sentAt
        })
        .eq("id", alert.id);
    }
  }
}
