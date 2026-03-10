import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const replaceSchema = z.object({
  locationId: z.string().uuid(),
  hours: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      opensAt: z.string().regex(/^\d{2}:\d{2}$/),
      closesAt: z.string().regex(/^\d{2}:\d{2}$/)
    })
  )
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

  const { data: rows, error } = await supabase
    .from("pickup_location_hours")
    .select("id,pickup_location_id,day_of_week,opens_at,closes_at,pickup_locations!inner(store_id)")
    .eq("pickup_locations.store_id", auth.context.storeId)
    .order("day_of_week", { ascending: true })
    .order("opens_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ hours: rows ?? [] });
}

export async function PUT(request: NextRequest) {
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

  const payload = await parseJsonRequest(request, replaceSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();

  const { data: location, error: locationError } = await supabase
    .from("pickup_locations")
    .select("id")
    .eq("id", payload.data.locationId)
    .eq("store_id", auth.context.storeId)
    .maybeSingle<{ id: string }>();

  if (locationError) {
    return NextResponse.json({ error: locationError.message }, { status: 500 });
  }

  if (!location) {
    return NextResponse.json({ error: "Pickup location not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("pickup_location_hours").delete().eq("pickup_location_id", payload.data.locationId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (payload.data.hours.length > 0) {
    const { error: insertError } = await supabase.from("pickup_location_hours").insert(
      payload.data.hours.map((entry) => ({
        pickup_location_id: payload.data.locationId,
        day_of_week: entry.dayOfWeek,
        opens_at: entry.opensAt,
        closes_at: entry.closesAt
      }))
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return GET(request);
}
