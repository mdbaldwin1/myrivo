import {
  Cog,
  DollarSign,
  FileText,
  Globe,
  Paintbrush,
  Plug,
  Store,
  Truck,
  Users,
  type LucideIcon
} from "lucide-react";

export type StoreSettingsSectionId =
  | "general"
  | "branding"
  | "legal"
  | "privacy"
  | "billing"
  | "team"
  | "shipping"
  | "pickup"
  | "domains"
  | "integrations";

export type StoreSettingsSection = {
  id: StoreSettingsSectionId;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  ownership: "builder" | "operations";
};

export type StoreSettingsWorkspaceGroup = {
  id: "identity" | "operations" | "access";
  title: string;
  description: string;
  sections: readonly StoreSettingsSection[];
};

export const storeSettingsWorkspaceGroups: readonly StoreSettingsWorkspaceGroup[] = [
  {
    id: "identity",
    title: "Identity & reach",
    description: "Store identity, brand presentation, and customer-facing domain presence.",
    sections: [
      {
        id: "general",
        href: "/store-settings/general",
        label: "General",
        description: "Store identity, billing, and baseline SEO information.",
        icon: Cog,
        ownership: "operations"
      },
      {
        id: "branding",
        href: "/store-settings/branding",
        label: "Branding",
        description: "Theme tokens, logos, and presentation shared across the storefront.",
        icon: Paintbrush,
        ownership: "builder"
      },
      {
        id: "legal",
        href: "/store-settings/legal",
        label: "Legal",
        description: "Formal Privacy Policy and Terms & Conditions.",
        icon: FileText,
        ownership: "operations"
      },
      {
        id: "privacy",
        href: "/store-settings/privacy",
        label: "Privacy",
        description: "Privacy notices, rights controls, and request handling.",
        icon: FileText,
        ownership: "operations"
      },
      {
        id: "domains",
        href: "/store-settings/domains",
        label: "Domains",
        description: "Custom domain verification and storefront address management.",
        icon: Globe,
        ownership: "operations"
      },
      {
        id: "billing",
        href: "/store-settings/billing",
        label: "Billing",
        description: "Assigned plan and platform fee configuration.",
        icon: DollarSign,
        ownership: "operations"
      }
    ]
  },
  {
    id: "operations",
    title: "Operations & fulfillment",
    description: "Checkout, delivery, and pickup controls that affect live order flow.",
    sections: [
      {
        id: "shipping",
        href: "/store-settings/shipping",
        label: "Shipping",
        description: "Delivery offer settings, shipping rules, and fulfillment expectations.",
        icon: Truck,
        ownership: "operations"
      },
      {
        id: "pickup",
        href: "/store-settings/pickup",
        label: "Pickup",
        description: "Pickup availability, scheduling windows, and location rules.",
        icon: Store,
        ownership: "operations"
      },
    ]
  },
  {
    id: "access",
    title: "Access & connections",
    description: "Team permissions and external services that keep operations running.",
    sections: [
      {
        id: "team",
        href: "/store-settings/team",
        label: "Team",
        description: "Membership roles, invites, and operational access control.",
        icon: Users,
        ownership: "operations"
      },
      {
        id: "integrations",
        href: "/store-settings/integrations",
        label: "Integrations",
        description: "Payments and provider connections that support store operations.",
        icon: Plug,
        ownership: "operations"
      }
    ]
  }
] as const;

export const storeSettingsWorkspaceSections = storeSettingsWorkspaceGroups.flatMap((group) => group.sections);

export const storefrontStudioOwnedStoreSettingsSectionIds = [
  "branding"
] as const satisfies readonly StoreSettingsSectionId[];

export const storeSettingsWorkspaceNavigationSectionIds = [
  "general",
  "legal",
  "privacy",
  "billing",
  "shipping",
  "pickup",
  "domains",
  "team",
  "integrations"
] as const satisfies readonly StoreSettingsSectionId[];

export type StoreSettingsWorkspaceStatusInput = {
  storeStatus: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
  hasLogo: boolean;
  hasVerifiedPrimaryDomain: boolean;
  paymentsConnected: boolean;
  shippingEnabled: boolean;
  pickupEnabled: boolean;
  pickupLocationCount: number;
  orderNoteEnabled: boolean;
  activeMemberCount: number;
};

export function buildStoreSettingsWorkspaceStatuses(input: StoreSettingsWorkspaceStatusInput): Record<StoreSettingsSectionId, string> {
  return {
    general: input.storeStatus === "live" ? "Storefront live" : "Core settings and assets",
    branding: input.hasLogo ? "Brand assets configured" : "Needs logo and theme review",
    legal: input.storeStatus === "live" ? "Published documents ready" : "Review legal documents before launch",
    privacy: input.storeStatus === "live" ? "Privacy controls active" : "Complete privacy controls before launch",
    billing: "Billing plan and fee settings",
    team: `${input.activeMemberCount} active ${input.activeMemberCount === 1 ? "member" : "members"}`,
    shipping: input.shippingEnabled ? "Shipping enabled" : "Shipping not configured",
    pickup: input.pickupEnabled ? `${input.pickupLocationCount} active pickup ${input.pickupLocationCount === 1 ? "location" : "locations"}` : "Pickup disabled",
    domains: input.hasVerifiedPrimaryDomain ? "Primary domain verified" : "Using default storefront domain",
    integrations: input.paymentsConnected ? "Payments connected" : "Payments setup needed"
  };
}
