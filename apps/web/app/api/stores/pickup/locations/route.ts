import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { resolvePickupCoordinatesFromAddress } from "@/lib/pickup/geocode";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
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

export async function GET(request: NextRequest) {
  const auth = await requireStoreRole("staff", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pickup_locations")
    .select("id,store_id,name,address_line1,address_line2,city,state_region,postal_code,country_code,latitude,longitude,notes,is_active")
    .eq("store_id", auth.context.storeId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ locations: data ?? [] });
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStoreRole("staff", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseJsonRequest(request, createSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolvedCoordinates =
    payload.data.latitude === null || payload.data.longitude === null
      ? await resolvePickupCoordinatesFromAddress({
          addressLine1: payload.data.addressLine1,
          city: payload.data.city,
          stateRegion: payload.data.stateRegion,
          postalCode: payload.data.postalCode,
          countryCode: payload.data.countryCode
        })
      : null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pickup_locations")
    .insert({
      store_id: auth.context.storeId,
      name: payload.data.name,
      address_line1: payload.data.addressLine1,
      address_line2: payload.data.addressLine2 ?? null,
      city: payload.data.city,
      state_region: payload.data.stateRegion,
      postal_code: payload.data.postalCode,
      country_code: payload.data.countryCode,
      latitude: payload.data.latitude ?? resolvedCoordinates?.latitude ?? null,
      longitude: payload.data.longitude ?? resolvedCoordinates?.longitude ?? null,
      notes: payload.data.notes ?? null,
      is_active: payload.data.isActive
    })
    .select("id,store_id,name,address_line1,address_line2,city,state_region,postal_code,country_code,latitude,longitude,notes,is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ location: data }, { status: 201 });
}
