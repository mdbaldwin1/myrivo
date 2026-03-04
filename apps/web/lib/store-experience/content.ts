export const STORE_EXPERIENCE_CONTENT_SECTION_TO_COLUMN = {
  home: "home_json",
  productsPage: "products_page_json",
  aboutPage: "about_page_json",
  policiesPage: "policies_page_json",
  cartPage: "cart_page_json",
  orderSummaryPage: "order_summary_page_json",
  emails: "emails_json"
} as const;

export type StoreExperienceContentSection = keyof typeof STORE_EXPERIENCE_CONTENT_SECTION_TO_COLUMN;
export type StoreExperienceContentColumn = (typeof STORE_EXPERIENCE_CONTENT_SECTION_TO_COLUMN)[StoreExperienceContentSection];

export type StoreExperienceContent = {
  home: Record<string, unknown>;
  productsPage: Record<string, unknown>;
  aboutPage: Record<string, unknown>;
  policiesPage: Record<string, unknown>;
  cartPage: Record<string, unknown>;
  orderSummaryPage: Record<string, unknown>;
  emails: Record<string, unknown>;
};

type StoreExperienceContentRow = {
  store_id: string;
  home_json: Record<string, unknown> | null;
  products_page_json: Record<string, unknown> | null;
  about_page_json: Record<string, unknown> | null;
  policies_page_json: Record<string, unknown> | null;
  cart_page_json: Record<string, unknown> | null;
  order_summary_page_json: Record<string, unknown> | null;
  emails_json: Record<string, unknown> | null;
};

function normalizeSection(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function createDefaultStoreExperienceContent(): StoreExperienceContent {
  return {
    home: {},
    productsPage: {},
    aboutPage: {},
    policiesPage: {},
    cartPage: {},
    orderSummaryPage: {},
    emails: {}
  };
}

export function mapStoreExperienceContentRow(row: StoreExperienceContentRow | null | undefined): StoreExperienceContent {
  if (!row) {
    return createDefaultStoreExperienceContent();
  }

  return {
    home: normalizeSection(row.home_json),
    productsPage: normalizeSection(row.products_page_json),
    aboutPage: normalizeSection(row.about_page_json),
    policiesPage: normalizeSection(row.policies_page_json),
    cartPage: normalizeSection(row.cart_page_json),
    orderSummaryPage: normalizeSection(row.order_summary_page_json),
    emails: normalizeSection(row.emails_json)
  };
}

