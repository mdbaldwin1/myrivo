import type { StoreStatus } from "@/types/database";

export const STORE_LIFECYCLE_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "rejected",
  "suspended",
  "live",
  "offline",
  "removed"
] as const satisfies readonly StoreStatus[];

export type StoreLifecycleStatus = (typeof STORE_LIFECYCLE_STATUSES)[number];

export type StoreLifecycleMerchantAction = "apply" | "resubmit" | "go_live" | "go_offline";
export type StoreLifecycleAdminAction = "approve" | "request_changes" | "reject" | "suspend" | "restore" | "remove";

export function isStorePubliclyAccessibleStatus(status: string | null | undefined): status is "live" {
  return status === "live";
}

export function hasStoreLaunchedOnce(
  status: string | null | undefined,
  persistedValue?: boolean | null
): boolean {
  if (typeof persistedValue === "boolean") {
    return persistedValue;
  }

  return status === "live" || status === "offline" || status === "suspended" || status === "removed";
}

export function getStoreLifecycleLabel(status: StoreStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending_review":
      return "Pending review";
    case "changes_requested":
      return "Changes requested";
    case "rejected":
      return "Rejected";
    case "suspended":
      return "Suspended";
    case "live":
      return "Live";
    case "offline":
      return "Offline";
    case "removed":
      return "Removed";
  }
}

export function getStoreLifecycleTone(status: StoreStatus): "neutral" | "warning" | "danger" | "success" | "info" {
  switch (status) {
    case "live":
      return "success";
    case "pending_review":
    case "changes_requested":
    case "offline":
      return "warning";
    case "rejected":
    case "suspended":
    case "removed":
      return "danger";
    case "draft":
    default:
      return "neutral";
  }
}

export function getStoreLifecycleDescription(status: StoreStatus): string {
  switch (status) {
    case "draft":
      return "Your storefront stays private until you apply to go live.";
    case "pending_review":
      return "Your go-live application is with the platform review team.";
    case "changes_requested":
      return "The platform review team requested updates before your store can go live.";
    case "rejected":
      return "Your last go-live application was rejected. Fix the issues and resubmit when ready.";
    case "suspended":
      return "Your storefront is unavailable because the platform suspended it.";
    case "live":
      return "Your storefront is public and accepting shoppers.";
    case "offline":
      return "Your storefront is hidden from shoppers until you bring it back online.";
    case "removed":
      return "This storefront has been removed from the platform.";
  }
}

export function getMerchantPrimaryLifecycleAction(status: StoreStatus, launchReady: boolean): {
  action: StoreLifecycleMerchantAction | null;
  label: string;
  disabled: boolean;
} {
  if (status === "removed" || status === "suspended") {
    return { action: null, label: "Unavailable", disabled: true };
  }

  if (status === "live") {
    return { action: "go_offline", label: "Take Offline", disabled: false };
  }

  if (status === "offline") {
    return { action: "go_live", label: "Go Live", disabled: false };
  }

  if (status === "pending_review") {
    return { action: null, label: "Pending Review", disabled: true };
  }

  if (status === "changes_requested" || status === "rejected") {
    return { action: "resubmit", label: "Reapply to Go Live", disabled: !launchReady };
  }

  return { action: "apply", label: "Apply to Go Live", disabled: !launchReady };
}

export function canDeleteStoreFromWorkspace(status: StoreStatus): boolean {
  return status === "draft" || status === "offline" || status === "rejected" || status === "removed";
}

export function canMerchantManageLifecycle(status: StoreStatus): boolean {
  return status !== "removed";
}
