import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const promoCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((value) => value.toUpperCase());

const promotionFields = {
  code: promoCodeSchema,
  discountType: z.enum(["percent", "fixed", "free_shipping"]),
  discountValue: z.number().int().nonnegative(),
  minSubtotalCents: z.number().int().nonnegative().default(0),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  perCustomerRedemptionLimit: z.number().int().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
  isStackable: z.boolean().default(false)
} as const;

const createSchema = z.object(promotionFields).superRefine((value, ctx) => {
  if (value.discountType !== "free_shipping" && value.discountValue <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount value must be greater than 0 for percent and fixed promotions.",
      path: ["discountValue"]
    });
  }
});

const updateSchema = z.object({
  code: promoCodeSchema.optional(),
  discountType: z.enum(["percent", "fixed", "free_shipping"]).optional(),
  discountValue: z.number().int().nonnegative().optional(),
  minSubtotalCents: z.number().int().nonnegative().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  perCustomerRedemptionLimit: z.number().int().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  isStackable: z.boolean().optional(),
  promotionId: z.string().uuid()
}).superRefine((payload, ctx) => {
  if (Object.keys(payload).every((key) => key === "promotionId")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "No updates provided"
    });
  }

  if (
    payload.discountType !== undefined &&
    payload.discountValue !== undefined &&
    payload.discountType !== "free_shipping" &&
    payload.discountValue <= 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount value must be greater than 0 for percent and fixed promotions.",
      path: ["discountValue"]
    });
  }
});

const deleteSchema = z.object({
  promotionId: z.string().uuid()
});

async function getStoreId(storeSlug: string | null) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, storeSlug, "staff");

  if (!bundle) {
    return { error: NextResponse.json({ error: "No store found for account" }, { status: 404 }) } as const;
  }

  return { supabase, storeId: bundle.store.id, userId: user.id } as const;
}

export async function GET() {
  const resolved = await getStoreId(null);

  if ("error" in resolved) {
    return resolved.error;
  }

  const { data, error } = await resolved.supabase
    .from("promotions")
    .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,per_customer_redemption_limit,times_redeemed,starts_at,ends_at,is_active,is_stackable,created_at")
    .eq("store_id", resolved.storeId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ promotions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, createSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await getStoreId(request.nextUrl.searchParams.get("storeSlug"));

  if ("error" in resolved) {
    return resolved.error;
  }

  const { data, error } = await resolved.supabase
    .from("promotions")
    .insert({
      store_id: resolved.storeId,
      code: payload.data.code,
      discount_type: payload.data.discountType,
      discount_value: payload.data.discountValue,
      min_subtotal_cents: payload.data.minSubtotalCents,
      max_redemptions: payload.data.maxRedemptions ?? null,
      per_customer_redemption_limit: payload.data.perCustomerRedemptionLimit ?? null,
      starts_at: payload.data.startsAt ?? null,
      ends_at: payload.data.endsAt ?? null,
      is_active: payload.data.isActive,
      is_stackable: payload.data.isStackable
    })
    .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,per_customer_redemption_limit,times_redeemed,starts_at,ends_at,is_active,is_stackable,created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Promo code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: resolved.storeId,
    actorUserId: resolved.userId,
    action: "create",
    entity: "promotion",
    entityId: data.id,
    metadata: {
      code: data.code,
      discountType: data.discount_type,
      discountValue: data.discount_value
    }
  });

  return NextResponse.json({ promotion: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, updateSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await getStoreId(request.nextUrl.searchParams.get("storeSlug"));

  if ("error" in resolved) {
    return resolved.error;
  }

  const updates: Record<string, unknown> = {};
  if (payload.data.code !== undefined) updates.code = payload.data.code;
  if (payload.data.discountType !== undefined) updates.discount_type = payload.data.discountType;
  if (payload.data.discountValue !== undefined) updates.discount_value = payload.data.discountValue;
  if (payload.data.minSubtotalCents !== undefined) updates.min_subtotal_cents = payload.data.minSubtotalCents;
  if (payload.data.maxRedemptions !== undefined) updates.max_redemptions = payload.data.maxRedemptions;
  if (payload.data.perCustomerRedemptionLimit !== undefined) updates.per_customer_redemption_limit = payload.data.perCustomerRedemptionLimit;
  if (payload.data.startsAt !== undefined) updates.starts_at = payload.data.startsAt;
  if (payload.data.endsAt !== undefined) updates.ends_at = payload.data.endsAt;
  if (payload.data.isActive !== undefined) updates.is_active = payload.data.isActive;
  if (payload.data.isStackable !== undefined) updates.is_stackable = payload.data.isStackable;

  const { data, error } = await resolved.supabase
    .from("promotions")
    .update(updates)
    .eq("id", payload.data.promotionId)
    .eq("store_id", resolved.storeId)
    .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,per_customer_redemption_limit,times_redeemed,starts_at,ends_at,is_active,is_stackable,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: resolved.storeId,
    actorUserId: resolved.userId,
    action: "update",
    entity: "promotion",
    entityId: payload.data.promotionId,
    metadata: updates
  });

  return NextResponse.json({ promotion: data });
}

export async function DELETE(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, deleteSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await getStoreId(request.nextUrl.searchParams.get("storeSlug"));

  if ("error" in resolved) {
    return resolved.error;
  }

  const { error } = await resolved.supabase
    .from("promotions")
    .delete()
    .eq("id", payload.data.promotionId)
    .eq("store_id", resolved.storeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: resolved.storeId,
    actorUserId: resolved.userId,
    action: "delete",
    entity: "promotion",
    entityId: payload.data.promotionId
  });

  return NextResponse.json({ deleted: true });
}
