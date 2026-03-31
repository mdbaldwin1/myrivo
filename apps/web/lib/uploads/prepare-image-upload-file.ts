"use client";

import {
  BRANDING_IMAGE_UPLOAD_MAX_BYTES,
  FUNCTION_SAFE_IMAGE_UPLOAD_MAX_BYTES
} from "@/lib/uploads/image-upload-limits";

const MAX_OPTIMIZED_DIMENSION_PX = 2400;
const OPTIMIZABLE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImageDimensions(file: File): Promise<{ image: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        image,
        revoke: () => URL.revokeObjectURL(objectUrl)
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image for upload."));
    };
    image.src = objectUrl;
  });
}

function blobFromCanvas(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to optimize image for upload."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

export function canOptimizeImageBeforeUpload(mimeType: string) {
  return OPTIMIZABLE_MIME_TYPES.has(mimeType);
}

export function getOptimizedUploadMimeType(mimeType: string) {
  if (mimeType === "image/png") {
    return "image/webp";
  }

  if (mimeType === "image/webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

export function getOptimizedUploadFileName(name: string, mimeType: string) {
  const baseName = name.replace(/\.[^.]+$/, "") || "upload";

  if (mimeType === "image/webp") {
    return `${baseName}.webp`;
  }

  if (mimeType === "image/jpeg") {
    return `${baseName}.jpg`;
  }

  return name;
}

export async function prepareImageUploadFile(
  file: File,
  {
    maxBytes = FUNCTION_SAFE_IMAGE_UPLOAD_MAX_BYTES
  }: {
    maxBytes?: number;
  } = {}
) {
  if (file.size <= maxBytes) {
    return file;
  }

  if (!canOptimizeImageBeforeUpload(file.type)) {
    throw new Error(`This file is too large to upload. Please choose a file smaller than ${formatUploadLimit(maxBytes)}.`);
  }

  const { image, revoke } = await loadImageDimensions(file);

  try {
    const longestSide = Math.max(image.naturalWidth || 1, image.naturalHeight || 1);
    const baseScale = Math.min(1, MAX_OPTIMIZED_DIMENSION_PX / longestSide);
    const targetMimeType = getOptimizedUploadMimeType(file.type);
    const qualitySteps = [0.86, 0.78, 0.7, 0.62, 0.54];
    const scaleSteps = [1, 0.92, 0.84, 0.76, 0.68];

    for (const scaleStep of scaleSteps) {
      const scale = Math.min(1, baseScale * scaleStep);
      const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Unable to optimize image for upload.");
      }

      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualitySteps) {
        const blob = await blobFromCanvas(canvas, targetMimeType, quality);

        if (blob.size <= maxBytes) {
          return new File([blob], getOptimizedUploadFileName(file.name, targetMimeType), {
            type: targetMimeType,
            lastModified: file.lastModified
          });
        }
      }
    }
  } finally {
    revoke();
  }

  throw new Error(`This image is still too large after optimization. Please choose a file smaller than ${formatUploadLimit(maxBytes)}.`);
}

function formatUploadLimit(maxBytes: number) {
  if (maxBytes === FUNCTION_SAFE_IMAGE_UPLOAD_MAX_BYTES) {
    return "4MB";
  }

  if (maxBytes === BRANDING_IMAGE_UPLOAD_MAX_BYTES) {
    return "2MB";
  }

  const megabytes = maxBytes / (1024 * 1024);
  return `${Number(megabytes.toFixed(1))}MB`;
}
