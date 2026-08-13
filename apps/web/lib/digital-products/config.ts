import { z } from "zod";

const digitalProductConfigSchema = z
  .object({
    accessLinkTtlHours: z.number().int().positive(),
    grantsPerFile: z.number().int().positive(),
    grantReuseGraceSeconds: z.number().int().nonnegative(),
    signedDownloadTtlSeconds: z.number().int().positive(),
    maxFilesPerProduct: z.number().int().positive(),
    maxFileBytes: z.number().int().positive(),
    previewMaxEdgePixels: z.number().int().positive(),
    previewJpegQuality: z.number().int().min(1).max(100),
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
  .strict();

export type DigitalProductConfig = Readonly<
  z.infer<typeof digitalProductConfigSchema>
>;

export const DIGITAL_PRODUCT_CONFIG: DigitalProductConfig = Object.freeze(
  digitalProductConfigSchema.parse({
    accessLinkTtlHours: 48,
    grantsPerFile: 5,
    grantReuseGraceSeconds: 60,
    signedDownloadTtlSeconds: 300,
    maxFilesPerProduct: 20,
    maxFileBytes: 250 * 1024 * 1024,
    previewMaxEdgePixels: 1400,
    previewJpegQuality: 78,
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
  }),
);

export const DIGITAL_PERSONAL_USE_LICENSE_VERSION =
  DIGITAL_PRODUCT_CONFIG.licenseVersion;
export const DIGITAL_DELIVERY_CONSENT_VERSION =
  DIGITAL_PRODUCT_CONFIG.consentVersion;
