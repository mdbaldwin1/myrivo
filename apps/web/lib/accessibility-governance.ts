export const ACCESSIBILITY_TARGET_FLOWS = [
  "storefront browse-to-buy and product discovery",
  "cart and checkout completion",
  "customer account and order lookup",
  "dashboard navigation and store management",
  "privacy, legal, and consent workflows"
] as const;

export const ACCESSIBILITY_HIGH_PRIORITY_BLOCKERS = [
  "checkout completion is blocked with keyboard or assistive technology",
  "authentication or account access is blocked",
  "store-management tasks are blocked for keyboard-only users",
  "critical legal or privacy choices cannot be completed accessibly"
] as const;

export const ACCESSIBILITY_RELEASE_GATES = [
  "verify skip-link and main-content focus flow on shared shells",
  "verify keyboard access and visible focus on changed controls",
  "verify reduced-motion behavior on animated or skeleton-heavy surfaces",
  "verify form labels, descriptions, and error messaging on changed forms",
  "verify chart and dashboard modules keep a readable fallback when visual cues are limited"
] as const;

export const ACCESSIBILITY_CONFORMANCE_NOTE =
  "We are improving accessibility continuously and maintaining release evidence for key flows, but we are not making a formal WCAG conformance claim right now." as const;

export const ACCESSIBILITY_EVIDENCE_MATRIX = [
  {
    flow: "storefront browse-to-buy and product discovery",
    evidence: ["axe audit coverage on key public flows", "manual keyboard and focus review on changed storefront surfaces"],
    owner: "Engineering + QA"
  },
  {
    flow: "cart and checkout completion",
    evidence: ["axe audit coverage for cart and checkout", "manual checkout walkthrough for keyboard and assistive-technology blockers"],
    owner: "Engineering + Support"
  },
  {
    flow: "customer account and order lookup",
    evidence: ["manual label and focus review", "support triage for account and order-access barriers"],
    owner: "Engineering + Support"
  },
  {
    flow: "dashboard navigation and store management",
    evidence: ["axe audit coverage for dashboard shell", "manual navigation and form review on changed store-management flows"],
    owner: "Engineering + Product"
  },
  {
    flow: "privacy, legal, and consent workflows",
    evidence: ["manual review of legal and consent forms", "operator verification of public intake and support handoff paths"],
    owner: "Engineering + Support"
  }
] as const;

export const ACCESSIBILITY_PROGRAM_OWNERSHIP = {
  engineering: [
    "fix shared primitive regressions at the component level",
    "keep release checks and automated coverage current",
    "treat high-severity accessibility blockers as release issues"
  ],
  productAndDesign: [
    "review changed flows against the target accessibility journey list",
    "avoid interactions that rely only on hover, color, or motion",
    "keep copy and layouts understandable at zoom and with assistive technology"
  ],
  supportAndOps: [
    "capture assistive-technology context and reproduction details in reports",
    "route checkout, auth, and store-management blockers as urgent issues",
    "confirm customer-facing follow-up when a barrier is mitigated or fixed"
  ]
} as const;
