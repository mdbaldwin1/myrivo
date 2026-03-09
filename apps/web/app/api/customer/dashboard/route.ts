import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: profile }, { data: savedStores }, { data: savedItems }, { data: carts }, { data: orders }] = await Promise.all([
    supabase
      .from("customer_profiles")
      .select("id,user_id,first_name,last_name,phone,default_shipping_address_json,preferences_json")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("customer_saved_stores")
      .select("id,store_id,stores(id,name,slug,status)")
      .eq("user_id", user.id),
    supabase
      .from("customer_saved_items")
      .select("id,store_id,product_id,product_variant_id,products(id,title,status),product_variants(id,title,status),stores(id,name,slug,status)")
      .eq("user_id", user.id),
    supabase
      .from("customer_carts")
      .select("id,store_id,status,metadata_json,stores(id,name,slug,status)")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("orders")
      .select("id,store_id,customer_email,total_cents,status,created_at,stores(id,name,slug)")
      .eq("customer_email", user.email ?? "")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return NextResponse.json({
    profile,
    savedStores: savedStores ?? [],
    savedItems: savedItems ?? [],
    carts: carts ?? [],
    recentOrders: orders ?? []
  });
}
