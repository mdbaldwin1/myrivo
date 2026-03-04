import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(120),
  stateRegion: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(2).max(20),
  countryCode: z.string().trim().min(2).max(3).default("US"),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().default(true)
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ locationId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStoreRole("staff");
  if (auth.response || !auth.context) {
    return auth.response;
  }

  const payload = updateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const { locationId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pickup_locations")
    .update({
      name: payload.data.name,
      address_line1: payload.data.addressLine1,
      address_line2: payload.data.addressLine2 ?? null,
      city: payload.data.city,
      state_region: payload.data.stateRegion,
      postal_code: payload.data.postalCode,
      country_code: payload.data.countryCode,
      latitude: payload.data.latitude ?? null,
      longitude: payload.data.longitude ?? null,
      notes: payload.data.notes ?? null,
      is_active: payload.data.isActive
    })
    .eq("id", locationId)
    .eq("store_id", auth.context.storeId)
    .select("id,store_id,name,address_line1,address_line2,city,state_region,postal_code,country_code,latitude,longitude,notes,is_active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Pickup location not found" }, { status: 404 });
  }

  return NextResponse.json({ location: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ locationId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStoreRole("staff");
  if (auth.response || !auth.context) {
    return auth.response;
  }

  const { locationId } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("pickup_locations")
    .delete()
    .eq("id", locationId)
    .eq("store_id", auth.context.storeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
