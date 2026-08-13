import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";

const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "../..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
}

function migration(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("digital-products release security contract", () => {
  const ownerMutationRoutes = [
    "app/api/products/digital-assets/upload-url/route.ts",
    "app/api/products/digital-assets/complete/route.ts",
    "app/api/products/digital-assets/reorder/route.ts",
    "app/api/products/digital-preview/route.ts",
  ];

  it.each(ownerMutationRoutes)("enforces origin, authentication, tenancy, and strict UUID input in %s", (route) => {
    const code = source(route);
    expect(code).toContain("enforceTrustedOrigin(request)");
    expect(code).toContain("auth.getUser()");
    expect(code).toContain("getOwnedStoreBundle(user.id");
    expect(code).toMatch(/z\.string\(\)\.uuid\(\)/);
    expect(code).not.toMatch(/request\.json\(\)/);
  });

  it("keeps uploads out of the application request body and verifies stored bytes before finalization", () => {
    const uploadRoute = source("app/api/products/digital-assets/upload-url/route.ts");
    const assetService = source("lib/digital-products/asset-service.ts");
    const validation = source("lib/digital-products/asset-validation.ts");
    expect(uploadRoute).toContain("createAssetUploadIntent");
    expect(assetService).toContain("createSignedUploadUrl");
    expect(assetService).toContain("inspectStoredAssetStream");
    expect(validation).toContain("detectMimeType");
    expect(validation).toContain("content_signature_mismatch");
    expect(validation).toMatch(/contentLength|byteLength|sizeBytes/);
    expect(DIGITAL_PRODUCT_CONFIG.maxFileBytes).toBe(250 * 1024 * 1024);
  });

  it("bounds compressed image work by bytes, pixels, dimensions, and sequential reads", () => {
    const preview = source("lib/digital-products/preview-service.ts");
    expect(preview).toContain("limitInputPixels: maxInputPixels");
    expect(preview).toContain("sequentialRead: true");
    expect(preview).toContain("sourceBytes > maxSourceBytes");
    expect(preview).toContain("withoutEnlargement: true");
    expect(DIGITAL_PRODUCT_CONFIG.previewMaxInputPixels).toBeLessThanOrEqual(40_000_000);
    expect(DIGITAL_PRODUCT_CONFIG.previewMaxEdgePixels).toBeLessThanOrEqual(1_400);
  });

  it("rate limits list and grant requests and hardens every bearer response", () => {
    for (const route of [
      "app/api/digital-downloads/[token]/route.ts",
      "app/api/digital-downloads/[token]/[entitlementId]/route.ts",
    ]) {
      const code = source(route);
      expect(code).toContain("enforceDigitalDownloadRateLimits");
      expect(code).toContain("hardenDigitalDownloadResponse");
      expect(code).toContain('"Retry-After"');
      expect(code).not.toContain("storage_path:");
    }
    const service = source("lib/digital-products/download-service.ts");
    expect(service).toMatch(/Cache-Control[^\n]+no-store/i);
    expect(service).toContain("hashDigitalAccessToken");
  });

  it("keeps recovery neutral, no-store, bounded, and free of raw customer identifiers in rate keys", () => {
    const handler = source("lib/digital-products/customer-recovery-handler.ts");
    const access = source("lib/digital-products/customer-access.ts");
    expect(handler).toContain("hardenedJson");
    expect(handler).toContain("NEUTRAL_RESPONSE");
    expect(handler).toMatch(/Cache-Control[^\n]+no-store/i);
    expect(access).toContain("keyedSubjectHash");
    expect(access).toMatch(/authorization\|bearer\|downloads\\\/\|@\|secret/i);
    expect(DIGITAL_PRODUCT_CONFIG.recoveryWorkTimeoutMs).toBeLessThan(
      DIGITAL_PRODUCT_CONFIG.recoveryResponseBaseMs,
    );
  });

  it("stores only token hashes and provides indexed access, grant, delivery, and operations queries", () => {
    const native = migration("supabase/migrations/20260812170000_native_digital_products.sql");
    const grants = migration("supabase/migrations/20260813010000_atomic_digital_download_grants.sql");
    const delivery = migration("supabase/migrations/20260813009000_reliable_digital_delivery_notifications.sql");
    const operations = migration("supabase/migrations/20260813018000_digital_product_rollout_operations.sql");
    expect(native).toContain("token_hash");
    expect(native).not.toMatch(/create table[\s\S]+\baccess_token\s+text/i);
    expect(native).toContain("idx_digital_access_tokens_order");
    expect(native).toContain("idx_digital_entitlements_order");
    expect(grants).toContain("digital_download_grants_active_reservation_idx");
    expect(grants).toContain("digital_download_grants_grace_reuse_idx");
    expect(delivery).toContain("digital_delivery_notifications_claim_idx");
    expect(operations).toContain("digital_product_events_store_created_idx");
  });
});
