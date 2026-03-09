import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  pickupLocationId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().max(240).nullable().optional()
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
    .from("pickup_blackout_dates")
    .select("id,store_id,pickup_location_id,starts_at,ends_at,reason")
    .eq("store_id", auth.context.storeId)
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blackouts: data ?? [] });
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

  const startsAt = new Date(payload.data.startsAt);
  const endsAt = new Date(payload.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    return NextResponse.json({ error: "Blackout window is invalid" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (payload.data.pickupLocationId) {
    const { data: location, error: locationError } = await supabase
      .from("pickup_locations")
      .select("id")
      .eq("id", payload.data.pickupLocationId)
      .eq("store_id", auth.context.storeId)
      .maybeSingle<{ id: string }>();

    if (locationError) {
      return NextResponse.json({ error: locationError.message }, { status: 500 });
    }

    if (!location) {
      return NextResponse.json({ error: "Pickup location not found" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("pickup_blackout_dates")
    .insert({
      store_id: auth.context.storeId,
      pickup_location_id: payload.data.pickupLocationId ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reason: payload.data.reason ?? null
    })
    .select("id,store_id,pickup_location_id,starts_at,ends_at,reason")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blackout: data }, { status: 201 });
}
