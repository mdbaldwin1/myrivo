export type DocSection = {
    heading: string;
    paragraphs: string[];
    bullets?: string[];
};

export type OwnerDoc = {
    slug: string;
    title: string;
    summary: string;
    category:
        | "Getting Started"
        | "Operations"
        | "Storefront"
        | "Team"
        | "Reporting";
    audience: string;
    lastUpdated: string;
    sections: DocSection[];
};

export const OWNER_DOCS: OwnerDoc[] = [
    {
        slug: "getting-started",
        title: "Getting Started",
        summary:
            "Set up your account, create your first store, and establish operating defaults before launch.",
        category: "Getting Started",
        audience: "Store owners and admins",
        lastUpdated: "March 2026",
        sections: [
            {
                heading: "Create Your Workspace",
                paragraphs: [
                    "Use the account dashboard to create a store, then open the store workspace from /dashboard/stores.",
                    "Confirm your store slug early. This slug powers workspace routes and storefront links.",
                ],
            },
            {
                heading: "Configure Launch Settings",
                paragraphs: [
                    "Complete general settings, branding, shipping or pickup, and checkout experience before sharing the storefront.",
                ],
                bullets: [
                    "General profile and support email",
                    "Brand colors and logo",
                    "Shipping and pickup defaults",
                    "Checkout rules and order note behavior",
                ],
            },
            {
                heading: "Production Readiness",
                paragraphs: [
                    "Before launch, test a full cart and order flow in your storefront at /s/:storeSlug.",
                ],
            },
        ],
    },
    {
        slug: "catalog-and-orders",
        title: "Catalog and Orders",
        summary:
            "Manage products, inventory behavior, and order fulfillment in a single store workspace.",
        category: "Operations",
        audience: "Store owners, admins, and operations staff",
        lastUpdated: "March 2026",
        sections: [
            {
                heading: "Catalog Workflow",
                paragraphs: [
                    "Use Catalog to create products and variants, then validate storefront product cards and pricing.",
                    "Keep inventory synchronized before promotions to avoid overselling.",
                ],
            },
            {
                heading: "Order Fulfillment",
                paragraphs: [
                    "Use Orders to review status, print pick/pack assets, and complete shipment or pickup handling.",
                ],
            },
            {
                heading: "Operational Guardrails",
                paragraphs: [
                    "When changing product structure after orders exist, verify downstream reporting and export behavior.",
                ],
                bullets: [
                    "Review order totals",
                    "Confirm inventory ledger movements",
                    "Test shipping labels and tracking updates",
                ],
            },
        ],
    },
    {
        slug: "promotions-and-subscribers",
        title: "Promotions and Subscribers",
        summary:
            "Launch discount campaigns and grow your audience with repeatable promotion workflows.",
        category: "Operations",
        audience: "Marketing and growth teams",
        lastUpdated: "March 2026",
        sections: [
            {
                heading: "Promotion Setup",
                paragraphs: [
                    "Create promotions with clear start/end windows and test with representative carts before activation.",
                ],
            },
            {
                heading: "Subscriber Growth",
                paragraphs: [
                    "Use subscriber tools for list growth and segmentation.",
                    "Coordinate subscriber messaging with your Content Workspace email capture copy.",
                ],
            },
        ],
    },
    {
        slug: "content-workspace-and-branding",
        title: "Content Workspace and Branding",
        summary:
            "Control storefront messaging, structure, and visual system across all customer-facing pages.",
        category: "Storefront",
        audience: "Brand and content teams",
        lastUpdated: "March 2026",
        sections: [
            {
                heading: "Content Workspace Surfaces",
                paragraphs: [
                    "Maintain Home, Products, About, Policies, Cart, Order Summary, and Emails content from one workspace section.",
                ],
            },
            {
                heading: "Brand Consistency",
                paragraphs: [
                    "Use Store Settings > Branding to control reusable color and visual tokens applied across storefront components.",
                ],
            },
            {
                heading: "Publishing Workflow",
                paragraphs: [
                    "After major copy changes, run a mobile and desktop storefront review before campaign sends.",
                ],
            },
        ],
    },
    {
        slug: "team-access-and-invites",
        title: "Team Access and Invites",
        summary:
            "Invite staff safely and manage store-level roles without losing owner control.",
        category: "Team",
        audience: "Store owners and admins",
        lastUpdated: "March 2026",
        sections: [
            {
                heading: "Role Model",
                paragraphs: [
                    "Use Team settings to assign admin, staff, and customer access by store workspace.",
                ],
                bullets: [
                    "Owner access remains unique and non-transferable",
                    "Admins can manage store operations",
                    "Staff supports daily fulfillment and catalog work",
                ],
            },
            {
                heading: "Invite Lifecycle",
                paragraphs: [
                    "Send invites from Team settings and share the generated /invite/:token link securely.",
                    "Invites are enforced against the invited email account at acceptance time.",
                ],
            },
        ],
    },
    {
        slug: "reports-and-billing",
        title: "Reports and Billing",
        summary:
            "Use insights, inventory ledger, and billing events to monitor store performance and platform fees.",
        category: "Reporting",
        audience: "Owners and finance stakeholders",
        lastUpdated: "March 2026",
        sections: [
            {
                heading: "Reporting Surfaces",
                paragraphs: [
                    "Use Reports > Insights for top-line performance.",
                    "Use Inventory Ledger for movement-level diagnostics and reconciliation.",
                    "Use Billing Events for fee and settlement visibility.",
                ],
            },
            {
                heading: "Review Cadence",
                paragraphs: [
                    "Run a weekly reporting review and tie outcomes to promotion, catalog, and fulfillment decisions.",
                ],
            },
        ],
    },
];

export const DOC_CATEGORY_ORDER: OwnerDoc["category"][] = [
    "Getting Started",
    "Operations",
    "Storefront",
    "Team",
    "Reporting",
];

export function getOwnerDocBySlug(slug: string) {
    return OWNER_DOCS.find((doc) => doc.slug === slug) ?? null;
}

export function getOwnerDocsByCategory() {
    return DOC_CATEGORY_ORDER.map((category) => ({
        category,
        docs: OWNER_DOCS.filter((doc) => doc.category === category),
    })).filter((entry) => entry.docs.length > 0);
}
