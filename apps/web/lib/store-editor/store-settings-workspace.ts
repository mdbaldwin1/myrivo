import {
  Cog,
  Globe,
  Paintbrush,
  Plug,
  ReceiptText,
  Settings,
  Store,
  Truck,
  Users,
  type LucideIcon
} from "lucide-react";

export type StoreSettingsSectionId =
  | "overview"
  | "general"
  | "branding"
  | "team"
  | "shipping"
  | "pickup"
  | "checkout-experience"
  | "domains"
  | "integrations";

export type StoreSettingsSection = {
  id: StoreSettingsSectionId;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
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
        id: "overview",
        href: "/store-settings",
        label: "Overview",
        description: "Workspace summary and current store health.",
        icon: Settings
      },
      {
        id: "general",
        href: "/store-settings/general",
        label: "General",
        description: "Store identity, publish state, and baseline SEO information.",
        icon: Cog
      },
      {
        id: "branding",
        href: "/store-settings/branding",
        label: "Branding",
        description: "Theme tokens, logos, and presentation shared across the storefront.",
        icon: Paintbrush
      },
      {
        id: "domains",
        href: "/store-settings/domains",
        label: "Domains",
        description: "Custom domain verification and storefront address management.",
        icon: Globe
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
        description: "Delivery rules, shipping policies, and fulfillment expectations.",
        icon: Truck
      },
      {
        id: "pickup",
        href: "/store-settings/pickup",
        label: "Pickup",
        description: "Pickup availability, scheduling windows, and location rules.",
        icon: Store
      },
      {
        id: "checkout-experience",
        href: "/store-settings/checkout-experience",
        label: "Checkout Experience",
        description: "Order thresholds, checkout messaging, and cart-to-checkout guardrails.",
        icon: ReceiptText
      }
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
        icon: Users
      },
      {
        id: "integrations",
        href: "/store-settings/integrations",
        label: "Integrations",
        description: "Payments and provider connections that support store operations.",
        icon: Plug
      }
    ]
  }
] as const;

export type StoreSettingsWorkspaceStatusInput = {
  storeStatus: "draft" | "pending_review" | "active" | "suspended";
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
    overview:
      input.storeStatus === "active"
        ? "Live"
        : input.storeStatus === "pending_review"
          ? "Pending review"
          : input.storeStatus === "suspended"
            ? "Suspended"
            : "Draft",
    general: input.storeStatus === "active" ? "Storefront live" : "Needs publish review",
    branding: input.hasLogo ? "Brand assets configured" : "Needs logo and theme review",
    team: `${input.activeMemberCount} active ${input.activeMemberCount === 1 ? "member" : "members"}`,
    shipping: input.shippingEnabled ? "Shipping enabled" : "Shipping not configured",
    pickup: input.pickupEnabled ? `${input.pickupLocationCount} active pickup ${input.pickupLocationCount === 1 ? "location" : "locations"}` : "Pickup disabled",
    "checkout-experience": input.orderNoteEnabled ? "Checkout options customized" : "Default checkout flow",
    domains: input.hasVerifiedPrimaryDomain ? "Primary domain verified" : "Using default storefront domain",
    integrations: input.paymentsConnected ? "Payments connected" : "Payments setup needed"
  };
}
