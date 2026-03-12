import { ProductManager, type ProductListItem } from "@/components/dashboard/product-manager";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

function normalizeProducts(products: ProductListItem[] | null): ProductListItem[] {
  return (products ?? []).map((product) => ({
    ...product,
    slug: product.slug || product.id,
    image_alt_text: product.image_alt_text ?? null,
    seo_title: product.seo_title ?? null,
    seo_description: product.seo_description ?? null,
    image_urls: product.image_urls ?? [],
    product_variants: (product.product_variants ?? []).map((variant) => ({
      ...variant,
      is_made_to_order: variant.is_made_to_order ?? false,
      image_urls: variant.image_urls ?? [],
      group_image_urls: variant.group_image_urls ?? []
    }))
  }));
}

export default async function StoreWorkspaceCatalogPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug);
  if (!bundle) {
    return null;
  }

  const selectWithVariantImages =
    "id,title,description,slug,sku,image_urls,image_alt_text,seo_title,seo_description,is_featured,price_cents,inventory_qty,status,created_at,product_variants(id,title,sku,sku_mode,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_made_to_order,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))";
  const selectWithVariantImagesLegacy =
    "id,title,description,sku,image_urls,is_featured,price_cents,inventory_qty,status,created_at,product_variants(id,title,sku,sku_mode,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))";

  const primary = await supabase
    .from("products")
    .select(selectWithVariantImages)
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  let products = primary.data as ProductListItem[] | null;
  let productsError = primary.error;

  if (
    isMissingColumnInSchemaCache(productsError, "is_made_to_order") ||
    isMissingColumnInSchemaCache(productsError, "slug") ||
    isMissingColumnInSchemaCache(productsError, "image_alt_text") ||
    isMissingColumnInSchemaCache(productsError, "seo_title") ||
    isMissingColumnInSchemaCache(productsError, "seo_description")
  ) {
    const legacy = await supabase
      .from("products")
      .select(selectWithVariantImagesLegacy)
      .eq("store_id", bundle.store.id)
      .order("created_at", { ascending: false });
    products = (legacy.data ?? []).map((product) => ({
      ...product,
      slug: product.id,
      image_alt_text: null,
      seo_title: null,
      seo_description: null
    })) as ProductListItem[] | null;
    productsError = legacy.error;
  }

  if (productsError) {
    throw new Error(productsError.message);
  }

  return (
    <DashboardPageScaffold title="Catalog" description="Manage products, stock, and publishing status." className="p-3">
      <ProductManager initialProducts={normalizeProducts(products)} />
    </DashboardPageScaffold>
  );
}
