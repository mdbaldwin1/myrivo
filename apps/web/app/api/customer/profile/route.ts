import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedCustomerUser } from "@/lib/customer/account";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const preferencesSchema = z.record(z.string(), z.unknown());

const updateSchema = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  defaultShippingAddress: z.record(z.string(), z.unknown()).optional(),
  preferences: preferencesSchema.optional()
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return auth.response;
  }

  const { data, error } = await supabase
    .from("customer_profiles")
    .select("id,user_id,first_name,last_name,phone,default_shipping_address_json,preferences_json,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      profile: {
        user_id: auth.user.id,
        first_name: null,
        last_name: null,
        phone: null,
        default_shipping_address_json: {},
        preferences_json: {}
      }
    });
  }

  return NextResponse.json({ profile: data });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return auth.response;
  }

  const upsertPayload = {
    user_id: auth.user.id,
    first_name: payload.data.firstName ?? null,
    last_name: payload.data.lastName ?? null,
    phone: payload.data.phone ?? null,
    default_shipping_address_json: payload.data.defaultShippingAddress ?? {},
    preferences_json: payload.data.preferences ?? {}
  };

  const { data, error } = await supabase
    .from("customer_profiles")
    .upsert(upsertPayload, { onConflict: "user_id" })
    .select("id,user_id,first_name,last_name,phone,default_shipping_address_json,preferences_json,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: data });
}
