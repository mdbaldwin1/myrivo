export const DIGITAL_PRODUCT_CONFIG = {
  accessLinkTtlHours: 48,
  grantsPerFile: 5,
  grantReuseGraceSeconds: 60,
  signedDownloadTtlSeconds: 300,
  maxFilesPerProduct: 20,
  maxFileBytes: 250 * 1024 * 1024,
  acceptedFiles: {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".zip": "application/zip"
  }
} as const;

export const DIGITAL_PERSONAL_USE_LICENSE_VERSION = "personal-use-v1";
export const DIGITAL_DELIVERY_CONSENT_VERSION = "immediate-delivery-v1";
