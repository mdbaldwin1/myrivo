import { z } from "zod";

const digitalProductConfigSchema = z
  .object({
    accessLinkTtlHours: z.number().int().positive(),
    grantsPerFile: z.number().int().positive(),
    grantReuseGraceSeconds: z.number().int().nonnegative(),
    signedDownloadTtlSeconds: z.number().int().positive(),
    downloadInitiationTimeoutMs: z.number().int().positive(),
    downloadGrantRateLimitPerMinute: z.number().int().positive(),
    downloadListRateLimitPerMinute: z.number().int().positive(),
    downloadSessionExchangeRateLimitPerMinute: z.number().int().positive(),
    downloadLimitResponse: z.object({
      status: z.literal(409),
      code: z.literal("download_limit_reached"),
      message: z.literal("Download limit reached"),
    }).strict(),
    recoveryClientRateLimitPerHour: z.number().int().positive(),
    recoveryPairRateLimitPerHour: z.number().int().positive(),
    recoveryResponseBaseMs: z.number().int().positive(),
    recoveryResponseQuantumMs: z.number().int().positive(),
    recoveryResponseJitterQuanta: z.number().int().positive(),
    recoveryWorkTimeoutMs: z.number().int().positive(),
    authenticatedAccessRateLimitPerMinute: z.number().int().positive(),
    authenticatedAccessTtlMinutes: z.number().int().positive(),
    maxFilesPerProduct: z.number().int().positive(),
    maxFileBytes: z.number().int().positive(),
    previewMaxEdgePixels: z.number().int().positive(),
    previewMaxInputPixels: z.number().int().positive(),
    previewMaxSourceBytes: z.number().int().positive(),
    previewOverrideMaxSourceBytes: z.number().int().positive(),
    previewJpegQuality: z.number().int().min(1).max(100),
    previewProcessingLeaseSeconds: z.number().int().positive(),
    uploadIntentTtlSeconds: z.number().int().positive(),
    orphanCleanupHours: z.number().int().positive(),
    maxUploadIntentTtlSeconds: z.number().int().positive(),
    deliveryLeaseSeconds: z.number().int().positive(),
    deliveryMaxAttempts: z.number().int().min(2),
    deliveryRetryBaseSeconds: z.number().int().positive(),
    deliveryRetryMaxSeconds: z.number().int().positive(),
    deliveryProcessBatchSize: z.number().int().positive().max(100),
    featureFlagKey: z.string().min(1),
    licenseVersion: z.string().min(1),
    consentVersion: z.string().min(1),
    acceptedFiles: z
      .object({
        ".jpg": z.literal("image/jpeg"),
        ".jpeg": z.literal("image/jpeg"),
        ".png": z.literal("image/png"),
        ".pdf": z.literal("application/pdf"),
        ".zip": z.literal("application/zip"),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, context) => {
    if (config.recoveryWorkTimeoutMs >= config.recoveryResponseBaseMs) {
      context.addIssue({
        code: "custom",
        path: ["recoveryWorkTimeoutMs"],
        message: "Recovery work timeout must be below the response envelope",
      });
    }
  });

type DeepReadonly<T> = T extends object
  ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T;

export type DigitalProductConfig = DeepReadonly<
  z.infer<typeof digitalProductConfigSchema>
>;

const parsedDigitalProductConfig = digitalProductConfigSchema.parse({
  accessLinkTtlHours: 48,
  grantsPerFile: 5,
  grantReuseGraceSeconds: 60,
  signedDownloadTtlSeconds: 300,
  downloadInitiationTimeoutMs: 15_000,
  downloadGrantRateLimitPerMinute: 90,
  downloadListRateLimitPerMinute: 30,
  downloadSessionExchangeRateLimitPerMinute: 20,
  downloadLimitResponse: {
    status: 409,
    code: "download_limit_reached",
    message: "Download limit reached",
  },
  recoveryClientRateLimitPerHour: 20,
  recoveryPairRateLimitPerHour: 5,
  recoveryResponseBaseMs: 2_000,
  recoveryResponseQuantumMs: 250,
  recoveryResponseJitterQuanta: 2,
  recoveryWorkTimeoutMs: 750,
  authenticatedAccessRateLimitPerMinute: 10,
  authenticatedAccessTtlMinutes: 15,
  maxFilesPerProduct: 20,
  maxFileBytes: 250 * 1024 * 1024,
  previewMaxEdgePixels: 1400,
  previewMaxInputPixels: 40_000_000,
  previewMaxSourceBytes: 250 * 1024 * 1024,
  previewOverrideMaxSourceBytes: 10 * 1024 * 1024,
  previewJpegQuality: 78,
  previewProcessingLeaseSeconds: 15 * 60,
  uploadIntentTtlSeconds: 30 * 60,
  orphanCleanupHours: 24,
  maxUploadIntentTtlSeconds: 2 * 60 * 60,
  deliveryLeaseSeconds: 2 * 60,
  deliveryMaxAttempts: 8,
  deliveryRetryBaseSeconds: 60,
  deliveryRetryMaxSeconds: 6 * 60 * 60,
  deliveryProcessBatchSize: 10,
  featureFlagKey: "digitalProducts",
  licenseVersion: "personal-use-v1",
  consentVersion: "immediate-delivery-v1",
  acceptedFiles: {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
  },
});

export const DIGITAL_PRODUCT_CONFIG: DigitalProductConfig = Object.freeze({
  ...parsedDigitalProductConfig,
  acceptedFiles: Object.freeze(parsedDigitalProductConfig.acceptedFiles),
  downloadLimitResponse: Object.freeze(parsedDigitalProductConfig.downloadLimitResponse),
});

export const DIGITAL_PERSONAL_USE_LICENSE_VERSION =
  DIGITAL_PRODUCT_CONFIG.licenseVersion;
export const DIGITAL_DELIVERY_CONSENT_VERSION =
  DIGITAL_PRODUCT_CONFIG.consentVersion;
