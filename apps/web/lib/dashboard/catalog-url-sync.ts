export function shouldOpenCatalogProductFromUrl(currentProductIdFromUrl: string | null, lastHandledProductIdFromUrl: string | null) {
  return currentProductIdFromUrl !== null && currentProductIdFromUrl !== lastHandledProductIdFromUrl;
}
