import type { StoreBaseLegalDocumentKey } from "@/lib/legal/document-keys";

export type StoreLegalDocumentKey = "privacy" | "terms";

export type StoreLegalDocumentDefinition = {
  key: StoreLegalDocumentKey;
  title: string;
  navigationLabel: string;
  storefrontPath: string;
  baseDocumentKey: StoreBaseLegalDocumentKey;
  templateVariables: readonly StoreLegalTemplateVariableDefinition[];
  addendumField: {
    key: string;
    label: string;
    description: string;
    placeholder: string;
  };
  summaryFieldOwner: "storefront-studio";
  formalDocumentOwner: "store-settings-legal";
};

export type StoreLegalTemplateVariableDefinition = {
  key: string;
  label: string;
  description: string;
  placeholder?: string;
  multiline?: boolean;
};

export const STORE_LEGAL_DOCUMENTS: readonly StoreLegalDocumentDefinition[] = [
  {
    key: "privacy",
    title: "Privacy Policy",
    navigationLabel: "Privacy",
    storefrontPath: "/privacy",
    baseDocumentKey: "store_privacy_base",
    templateVariables: [
      {
        key: "privacyContactEmail",
        label: "Privacy contact email",
        description: "Shown in the storefront privacy-policy contact section.",
        placeholder: "privacy@example.com"
      }
    ],
    addendumField: {
      key: "privacy_addendum",
      label: "Store-specific privacy addendum",
      description: "Optional markdown appended after the admin-managed privacy base template.",
      placeholder: "## Store-specific privacy disclosures\n\nAdd any approved store-specific privacy details here."
    },
    summaryFieldOwner: "storefront-studio",
    formalDocumentOwner: "store-settings-legal"
  },
  {
    key: "terms",
    title: "Terms & Conditions",
    navigationLabel: "Terms",
    storefrontPath: "/terms",
    baseDocumentKey: "store_terms_base",
    templateVariables: [
      {
        key: "termsContactEmail",
        label: "Terms contact email",
        description: "Shown in the storefront terms contact section.",
        placeholder: "support@example.com"
      },
      {
        key: "governingLawRegion",
        label: "Governing law region",
        description: "Used in the governing-law clause of the admin-managed terms base template.",
        placeholder: "the jurisdiction where the store operates"
      }
    ],
    addendumField: {
      key: "terms_addendum",
      label: "Store-specific terms addendum",
      description: "Optional markdown appended after the admin-managed terms base template.",
      placeholder: "## Store-specific terms\n\nAdd any approved store-specific conditions here."
    },
    summaryFieldOwner: "storefront-studio",
    formalDocumentOwner: "store-settings-legal"
  }
] as const;

export const STORE_LEGAL_INFORMATION_ARCHITECTURE = {
  storefrontStudioOwns: [
    "shipping and returns summaries",
    "support contact presentation",
    "FAQ content",
    "policy page headings and customer-facing guidance"
  ],
  storeSettingsLegalOwns: [
    "formal Privacy Policy document",
    "formal Terms & Conditions document",
    "template variables and merchant addenda",
    "admin-managed storefront legal base templates",
    "publishing metadata and effective-date state"
  ],
  nonGoals: [
    "a drag-and-drop legal page builder",
    "moving shipping and returns summaries out of Storefront Studio",
    "forcing merchants to author legal text from a blank page"
  ]
} as const;

export function getStoreLegalDocument(key: StoreLegalDocumentKey): StoreLegalDocumentDefinition {
  const document = STORE_LEGAL_DOCUMENTS.find((entry) => entry.key === key);
  if (!document) {
    throw new Error(`Unknown store legal document: ${key}`);
  }
  return document;
}
