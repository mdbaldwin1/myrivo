export type StoreLegalDocumentKey = "privacy" | "terms";

export type StoreLegalDocumentDefinition = {
  key: StoreLegalDocumentKey;
  title: string;
  navigationLabel: string;
  storefrontPath: string;
  defaultBodyMarkdown: string;
  templateVariables: readonly StoreLegalTemplateVariableDefinition[];
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
    defaultBodyMarkdown: `# Privacy Policy

{storeName} respects your privacy. This policy explains what information we collect, how we use it, and how to contact us with questions.

## Information we collect

We may collect information you provide directly when you place an order, contact us, join our email list, or otherwise interact with the storefront. This can include your name, email address, shipping information, and any details you choose to share with us.

## How we use information

We use information to:

- fulfill orders and provide customer support
- communicate about purchases, pickup, shipping, or returns
- operate and improve the storefront experience
- comply with legal and tax obligations

## Third-party services

We may rely on service providers that support payments, checkout, fulfillment, email delivery, analytics, and storefront operations. Those providers process data as needed to perform their services.

## Contact

If you have privacy questions or requests, contact us at {privacyContactEmail}.

{privacyAdditionalDetails}
`,
    templateVariables: [
      {
        key: "privacyContactEmail",
        label: "Privacy contact email",
        description: "Shown as the main contact for privacy questions and requests.",
        placeholder: "privacy@example.com"
      },
      {
        key: "privacyAdditionalDetails",
        label: "Additional privacy details",
        description: "Optional extra markdown appended to the template for store-specific privacy disclosures.",
        placeholder: "## Additional privacy details\n\nAdd any store-specific privacy disclosures here.",
        multiline: true
      }
    ],
    summaryFieldOwner: "storefront-studio",
    formalDocumentOwner: "store-settings-legal"
  },
  {
    key: "terms",
    title: "Terms & Conditions",
    navigationLabel: "Terms",
    storefrontPath: "/terms",
    defaultBodyMarkdown: `# Terms & Conditions

These Terms & Conditions govern your use of the {storeName} storefront and any purchases you make from us.

## Orders

By placing an order, you agree that the information you provide is accurate and that you are authorized to use the selected payment method.

## Pricing and availability

Product availability, pricing, and fulfillment timing may change without notice. We reserve the right to correct errors, limit quantities, or cancel orders when necessary.

## Fulfillment

Shipping, pickup, returns, and support expectations are described throughout the storefront and in our policy pages. Please review those details before completing a purchase.

## Governing law

These terms are governed by the laws of {governingLawRegion}.

## Contact

If you have questions about these terms, contact us at {termsContactEmail}.

{termsAdditionalDetails}
`,
    templateVariables: [
      {
        key: "termsContactEmail",
        label: "Terms contact email",
        description: "Shown as the contact for terms and order questions.",
        placeholder: "support@example.com"
      },
      {
        key: "governingLawRegion",
        label: "Governing law region",
        description: "Used in the governing law clause for the template-backed Terms document.",
        placeholder: "the jurisdiction where the store operates"
      },
      {
        key: "termsAdditionalDetails",
        label: "Additional terms",
        description: "Optional extra markdown appended to the template for store-specific conditions.",
        placeholder: "## Additional terms\n\nAdd any store-specific conditions here.",
        multiline: true
      }
    ],
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
