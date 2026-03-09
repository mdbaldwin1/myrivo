import { NextResponse } from "next/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("inventory_movements")
    .select("id,product_id,order_id,delta_qty,reason,note,created_at,products(title)")
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ movements: data ?? [] });
}
