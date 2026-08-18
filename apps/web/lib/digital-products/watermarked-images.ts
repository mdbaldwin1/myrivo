/**
 * Where a watermarked copy of a storefront image lives.
 *
 * A watermark is burned into the pixels, so it can never be lifted from the
 * copy. The only way back is the original, which is why a copy is written
 * beside its source under a known folder and named after it - a hashed name
 * would be one-way, stranding a merchant on the stamped image.
 *
 * These are pure path rules with no image processing behind them, so the
 * editor can ask them in the browser.
 */

export const WATERMARKED_FOLDER = "watermarked";

export function imageBaseName(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Splits a watermarked copy's path into the folder and name of its source. */
export function splitWatermarkedPath(path: string) {
  const slash = path.lastIndexOf("/");
  if (slash < 0) return null;
  const directory = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const parentSlash = directory.lastIndexOf("/");
  if (parentSlash < 0 || directory.slice(parentSlash + 1) !== WATERMARKED_FOLDER) return null;
  return { sourceDirectory: directory.slice(0, parentSlash), base: imageBaseName(name) };
}

/** Whether this image is a watermarked copy, and so can be reverted. */
export function isWatermarkedProductImage(imageUrl: string) {
  try {
    return new URL(imageUrl).pathname.includes(`/${WATERMARKED_FOLDER}/`);
  } catch {
    return false;
  }
}
