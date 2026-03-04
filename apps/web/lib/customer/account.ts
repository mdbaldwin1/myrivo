import { NextResponse } from "next/server";

type SupabaseSingleResult = Promise<{ data: unknown; error: { message: string } | null }>;
type SupabaseQuery = { eq: (column: string, value: unknown) => SupabaseQuery; maybeSingle: () => SupabaseSingleResult };
type SupabaseCustomerClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string | null } | null } }>;
  };
  from: (table: string) => {
    select: (columns: string) => SupabaseQuery;
  };
};

type StoreLookup = { id: string; slug: string; status: "draft" | "active" | "suspended" };
type ProductLookup = { id: string; store_id: string; status: "draft" | "active" | "archived"; price_cents: number };
type VariantLookup = {
  id: string;
  store_id: string;
  product_id: string;
  status: "active" | "archived";
  price_cents: number;
};

export async function requireAuthenticatedCustomerUser(supabase: unknown) {
  const client = supabase as SupabaseCustomerClient;
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    } as const;
  }

  return { user, response: null } as const;
}

export async function requireStoreById(supabase: unknown, storeId: string) {
  const client = supabase as SupabaseCustomerClient;
  const { data, error } = await client
    .from("stores")
    .select("id,slug,status")
    .eq("id", storeId)
    .maybeSingle();

  if (error) {
    return { store: null, response: NextResponse.json({ error: error.message }, { status: 500 }) } as const;
  }

  const store = data as StoreLookup | null;
  if (!store || store.status !== "active") {
    return { store: null, response: NextResponse.json({ error: "Store not found or inactive." }, { status: 404 }) } as const;
  }

  return { store, response: null } as const;
}

export async function requireStoreBySlug(supabase: unknown, slug: string) {
  const client = supabase as SupabaseCustomerClient;
  const { data, error } = await client
    .from("stores")
    .select("id,slug,status")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { store: null, response: NextResponse.json({ error: error.message }, { status: 500 }) } as const;
  }

  const store = data as StoreLookup | null;
  if (!store || store.status !== "active") {
    return { store: null, response: NextResponse.json({ error: "Store not found or inactive." }, { status: 404 }) } as const;
  }

  return { store, response: null } as const;
}

export async function validateStoreItemSelection(
  supabase: unknown,
  params: { storeId: string; productId?: string; variantId?: string }
) {
  const client = supabase as SupabaseCustomerClient;
  if (!params.productId && !params.variantId) {
    return { selection: null, response: NextResponse.json({ error: "productId or variantId is required" }, { status: 400 }) } as const;
  }

  let product: ProductLookup | null = null;
  if (params.productId) {
    const { data, error } = await client
      .from("products")
      .select("id,store_id,status,price_cents")
      .eq("id", params.productId)
      .maybeSingle();
    if (error) {
      return { selection: null, response: NextResponse.json({ error: error.message }, { status: 500 }) } as const;
    }
    const productData = data as ProductLookup | null;
    if (!productData || productData.store_id !== params.storeId || productData.status !== "active") {
      return { selection: null, response: NextResponse.json({ error: "Product is unavailable for this store." }, { status: 400 }) } as const;
    }
    product = productData;
  }

  let variant: VariantLookup | null = null;
  if (params.variantId) {
    const { data, error } = await client
      .from("product_variants")
      .select("id,store_id,product_id,status,price_cents")
      .eq("id", params.variantId)
      .maybeSingle();
    if (error) {
      return { selection: null, response: NextResponse.json({ error: error.message }, { status: 500 }) } as const;
    }
    const variantData = data as VariantLookup | null;
    if (!variantData || variantData.store_id !== params.storeId || variantData.status !== "active") {
      return { selection: null, response: NextResponse.json({ error: "Variant is unavailable for this store." }, { status: 400 }) } as const;
    }
    variant = variantData;
  }

  const resolvedProductId = params.productId ?? variant?.product_id ?? null;
  if (variant && resolvedProductId && variant.product_id !== resolvedProductId) {
    return { selection: null, response: NextResponse.json({ error: "Variant does not belong to the selected product." }, { status: 400 }) } as const;
  }

  return {
    selection: {
      productId: resolvedProductId,
      variantId: params.variantId ?? null,
      unitPriceSnapshotCents: variant?.price_cents ?? product?.price_cents ?? 0
    },
    response: null
  } as const;
}
