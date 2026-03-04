import { ProductManager, type ProductListItem } from "@/components/dashboard/product-manager";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function normalizeProducts(products: ProductListItem[] | null): ProductListItem[] {
  return (products ?? []).map((product) => ({
    ...product,
    image_urls: product.image_urls ?? [],
    product_variants: (product.product_variants ?? []).map((variant) => ({
      ...variant,
      is_made_to_order: variant.is_made_to_order ?? false,
      image_urls: variant.image_urls ?? [],
      group_image_urls: variant.group_image_urls ?? []
    }))
  }));
}

export default async function DashboardCatalogPage() {
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

  const selectWithVariantImages =
    "id,title,description,sku,image_urls,is_featured,price_cents,inventory_qty,status,created_at,product_variants(id,title,sku,sku_mode,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_made_to_order,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))";
  const selectWithVariantImagesLegacy =
    "id,title,description,sku,image_urls,is_featured,price_cents,inventory_qty,status,created_at,product_variants(id,title,sku,sku_mode,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))";

  const primary = await supabase
    .from("products")
    .select(selectWithVariantImages)
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });
  let products = primary.data as ProductListItem[] | null;
  let productsError = primary.error;

  if (isMissingColumnInSchemaCache(productsError, "is_made_to_order")) {
    const legacy = await supabase
      .from("products")
      .select(selectWithVariantImagesLegacy)
      .eq("store_id", bundle.store.id)
      .order("created_at", { ascending: false });
    products = legacy.data as ProductListItem[] | null;
    productsError = legacy.error;
  }

  if (productsError) {
    throw new Error(productsError.message);
  }

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Catalog" description="Manage products, stock, and publishing status." />
      <ProductManager initialProducts={normalizeProducts(products)} />
    </section>
  );
}
