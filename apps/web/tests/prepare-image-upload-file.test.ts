import { describe, expect, it } from "vitest";
import {
  canOptimizeImageBeforeUpload,
  getOptimizedUploadFileName,
  getOptimizedUploadMimeType
} from "@/lib/uploads/prepare-image-upload-file";

describe("prepare-image-upload-file helpers", () => {
  it("marks raster photo formats as client-optimizable", () => {
    expect(canOptimizeImageBeforeUpload("image/jpeg")).toBe(true);
    expect(canOptimizeImageBeforeUpload("image/png")).toBe(true);
    expect(canOptimizeImageBeforeUpload("image/webp")).toBe(true);
    expect(canOptimizeImageBeforeUpload("image/svg+xml")).toBe(false);
    expect(canOptimizeImageBeforeUpload("image/gif")).toBe(false);
  });

  it("picks a safe output mime type for oversized images", () => {
    expect(getOptimizedUploadMimeType("image/jpeg")).toBe("image/jpeg");
    expect(getOptimizedUploadMimeType("image/webp")).toBe("image/webp");
    expect(getOptimizedUploadMimeType("image/png")).toBe("image/webp");
  });

  it("updates file extensions when the optimized mime changes", () => {
    expect(getOptimizedUploadFileName("hero.png", "image/webp")).toBe("hero.webp");
    expect(getOptimizedUploadFileName("catalog.photo.jpeg", "image/jpeg")).toBe("catalog.photo.jpg");
    expect(getOptimizedUploadFileName("upload", "image/webp")).toBe("upload.webp");
  });
});
