"use client";

import * as React from "react";
import { StorefrontStudioStorefrontEditorAboutTab } from "@/components/dashboard/storefront-studio-storefront-editor-about-tab";
import { StorefrontStudioStorefrontEditorBrandTab } from "@/components/dashboard/storefront-studio-storefront-editor-brand-tab";
import { StorefrontStudioStorefrontEditorCartTab } from "@/components/dashboard/storefront-studio-storefront-editor-cart-tab";
import { StorefrontStudioStorefrontEditorFooterTab } from "@/components/dashboard/storefront-studio-storefront-editor-footer-tab";
import { StorefrontStudioStorefrontEditorHeaderTab } from "@/components/dashboard/storefront-studio-storefront-editor-header-tab";
import { StorefrontStudioStorefrontEditorHomeTab } from "@/components/dashboard/storefront-studio-storefront-editor-home-tab";
import { StorefrontStudioStorefrontEditorOrderSummaryTab } from "@/components/dashboard/storefront-studio-storefront-editor-order-summary-tab";
import { StorefrontStudioStorefrontEditorPoliciesTab } from "@/components/dashboard/storefront-studio-storefront-editor-policies-tab";
import { StorefrontStudioStorefrontEditorProductDetailTab } from "@/components/dashboard/storefront-studio-storefront-editor-product-detail-tab";
import { StorefrontStudioStorefrontEditorProductsTab } from "@/components/dashboard/storefront-studio-storefront-editor-products-tab";
import { StorefrontStudioStorefrontEditorStoreAlertTab } from "@/components/dashboard/storefront-studio-storefront-editor-store-alert-tab";
import { StorefrontStudioStorefrontEditorWelcomePopupTab } from "@/components/dashboard/storefront-studio-storefront-editor-welcome-popup-tab";
import type { StorefrontStudioSurfaceId } from "@/lib/store-editor/storefront-studio";

type PageSurfaceId = Exclude<StorefrontStudioSurfaceId, "emails">;

export type StorefrontStudioStorefrontEditorTarget =
  | "brand"
  | "header"
  | "footer"
  | PageSurfaceId
  | "productDetail"
  | "welcomePopup"
  | "storeAlert";

type StorefrontStudioStorefrontEditorPanelProps = {
  editorTarget: StorefrontStudioStorefrontEditorTarget;
};

export function StorefrontStudioStorefrontEditorPanel({ editorTarget }: StorefrontStudioStorefrontEditorPanelProps) {
  switch (editorTarget) {
    case "brand":
      return <StorefrontStudioStorefrontEditorBrandTab />;
    case "header":
      return <StorefrontStudioStorefrontEditorHeaderTab />;
    case "footer":
      return <StorefrontStudioStorefrontEditorFooterTab />;
    case "home":
      return <StorefrontStudioStorefrontEditorHomeTab />;
    case "products":
      return <StorefrontStudioStorefrontEditorProductsTab />;
    case "productDetail":
      return <StorefrontStudioStorefrontEditorProductDetailTab />;
    case "welcomePopup":
      return <StorefrontStudioStorefrontEditorWelcomePopupTab />;
    case "storeAlert":
      return <StorefrontStudioStorefrontEditorStoreAlertTab />;
    case "about":
      return <StorefrontStudioStorefrontEditorAboutTab />;
    case "policies":
      return <StorefrontStudioStorefrontEditorPoliciesTab />;
    case "cart":
      return <StorefrontStudioStorefrontEditorCartTab />;
    case "orderSummary":
      return <StorefrontStudioStorefrontEditorOrderSummaryTab />;
    default:
      return null;
  }
}
