import type { StoreLegalDocumentKey } from "@/types/database";

export type PlatformLegalDocumentKey = "platform_terms" | "platform_privacy";
export type StoreBaseLegalDocumentKey = "store_terms_base" | "store_privacy_base";
export type ManagedLegalDocumentKey = PlatformLegalDocumentKey | StoreBaseLegalDocumentKey;

export function isPlatformLegalDocumentKey(key: string): key is PlatformLegalDocumentKey {
  return key === "platform_terms" || key === "platform_privacy";
}

export function isStoreBaseLegalDocumentKey(key: string): key is StoreBaseLegalDocumentKey {
  return key === "store_terms_base" || key === "store_privacy_base";
}

export function getPlatformLegalDocumentKey(key: "terms" | "privacy"): PlatformLegalDocumentKey {
  return key === "terms" ? "platform_terms" : "platform_privacy";
}

export function getStoreBaseLegalDocumentKey(key: StoreLegalDocumentKey): StoreBaseLegalDocumentKey {
  return key === "terms" ? "store_terms_base" : "store_privacy_base";
}

export function getStoreLegalDocumentKeyFromBase(key: StoreBaseLegalDocumentKey): StoreLegalDocumentKey {
  return key === "store_terms_base" ? "terms" : "privacy";
}

export function getManagedLegalDocumentLabel(key: ManagedLegalDocumentKey) {
  switch (key) {
    case "platform_privacy":
      return "Myrivo Privacy Policy";
    case "platform_terms":
      return "Myrivo Terms and Conditions";
    case "store_privacy_base":
      return "Storefront Privacy Policy Base";
    case "store_terms_base":
      return "Storefront Terms & Conditions Base";
  }
}

export function getManagedLegalDocumentScope(key: ManagedLegalDocumentKey) {
  if (isPlatformLegalDocumentKey(key)) {
    return "platform";
  }
  return "storefront";
}
