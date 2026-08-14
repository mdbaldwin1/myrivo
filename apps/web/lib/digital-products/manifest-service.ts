import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import type { DigitalPurchaseManifest } from "./types";

const uuidSchema = z.string().uuid();

const checkoutItemSchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema,
  quantity: z.number().int().positive()
}).passthrough();

const manifestItemSchema = z.object({
  orderItemId: uuidSchema.nullable(),
  productId: uuidSchema,
  productVariantId: uuidSchema.nullable(),
  assetId: uuidSchema,
  assetVersionId: uuidSchema,
  customerFilename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  byteSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  label: z.string().trim().min(1).max(160),
  sortOrder: z.number().int().nonnegative()
});

const manifestSchema = z.object({
  manifestId: uuidSchema,
  orderId: uuidSchema.nullable(),
  checkoutSessionId: uuidSchema.nullable(),
  storeId: uuidSchema,
  consentVersion: z.string().trim().min(1),
  licenseVersion: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  items: z.array(manifestItemSchema).min(1)
});

export type CheckoutManifestItem = z.infer<typeof checkoutItemSchema>;

export type CheckoutManifestConsent = {
  readonly version: string;
  readonly acceptedAt: string;
};

export type CreateOrReuseCheckoutManifestInput = {
  readonly checkoutSessionId: string;
  readonly storeId: string;
  readonly items: ReadonlyArray<CheckoutManifestItem>;
  readonly consent: CheckoutManifestConsent;
};

export type DigitalPurchaseManifestErrorCode =
  | "digital_bundle_not_ready"
  | "digital_manifest_conflict"
  | "digital_manifest_unavailable";

export class DigitalPurchaseManifestError extends Error {
  readonly code: DigitalPurchaseManifestErrorCode;

  constructor(code: DigitalPurchaseManifestErrorCode, message: string) {
    super(message);
    this.name = "DigitalPurchaseManifestError";
    this.code = code;
  }
}

function freezeManifest(manifest: DigitalPurchaseManifest): DigitalPurchaseManifest {
  for (const item of manifest.items) {
    Object.freeze(item);
  }
  Object.freeze(manifest.items);
  return Object.freeze(manifest);
}

function parseManifest(value: unknown): DigitalPurchaseManifest {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new DigitalPurchaseManifestError(
      "digital_manifest_unavailable",
      "Digital checkout could not be prepared."
    );
  }
  return freezeManifest(parsed.data);
}

function mapCreateError(message: string | undefined): DigitalPurchaseManifestError {
  if (message?.toLowerCase().includes("fingerprint")) {
    return new DigitalPurchaseManifestError(
      "digital_manifest_conflict",
      "This checkout attempt no longer matches the cart."
    );
  }
  return new DigitalPurchaseManifestError(
    "digital_bundle_not_ready",
    "Digital files are not ready for checkout."
  );
}

export async function createOrReuseCheckoutManifest(
  input: CreateOrReuseCheckoutManifestInput
): Promise<DigitalPurchaseManifest> {
  const checkoutSessionId = uuidSchema.parse(input.checkoutSessionId);
  const storeId = uuidSchema.parse(input.storeId);
  const items = z.array(checkoutItemSchema).min(1).parse(input.items);
  const acceptedAt = z.string().datetime().parse(input.consent.acceptedAt);

  if (input.consent.version !== DIGITAL_PRODUCT_CONFIG.consentVersion) {
    throw new DigitalPurchaseManifestError(
      "digital_manifest_conflict",
      "This checkout attempt no longer matches the cart."
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "create_or_reuse_digital_checkout_manifest",
    {
      p_checkout_session_id: checkoutSessionId,
      p_store_id: storeId,
      p_items: items,
      p_consent_version: DIGITAL_PRODUCT_CONFIG.consentVersion,
      p_consent_accepted_at: acceptedAt,
      p_license_version: DIGITAL_PRODUCT_CONFIG.licenseVersion
    }
  );

  if (error) {
    throw mapCreateError(error.message);
  }

  return parseManifest(data);
}

export async function lockManifestToOrder(
  manifestId: string,
  orderId: string
): Promise<DigitalPurchaseManifest> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("lock_digital_checkout_manifest", {
    p_manifest_id: uuidSchema.parse(manifestId),
    p_order_id: uuidSchema.parse(orderId)
  });

  if (error) {
    throw new DigitalPurchaseManifestError(
      "digital_manifest_unavailable",
      "Digital checkout could not be finalized."
    );
  }

  return parseManifest(data);
}

export function buildDigitalManifestStripeMetadata(manifestId: string) {
  return { digital_manifest_id: uuidSchema.parse(manifestId) } as const;
}
