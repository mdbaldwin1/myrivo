import type {
  OrderShippingDelayCustomerPath,
  OrderShippingDelayReasonKey,
  OrderShippingDelayStatus,
} from "@/types/database";

export type { OrderShippingDelayCustomerPath, OrderShippingDelayReasonKey, OrderShippingDelayStatus } from "@/types/database";

export const ORDER_SHIPPING_DELAY_REASON_OPTIONS: ReadonlyArray<{
  value: OrderShippingDelayReasonKey;
  label: string;
}> = [
  { value: "inventory_shortfall", label: "Inventory shortfall" },
  { value: "supplier_delay", label: "Supplier delay" },
  { value: "production_delay", label: "Production delay" },
  { value: "carrier_disruption", label: "Carrier disruption" },
  { value: "weather_or_emergency", label: "Weather or emergency" },
  { value: "address_or_verification_issue", label: "Address or verification issue" },
  { value: "fulfillment_capacity_issue", label: "Fulfillment capacity issue" },
  { value: "other", label: "Other" },
] as const;

export const ORDER_SHIPPING_DELAY_CUSTOMER_PATH_OPTIONS: ReadonlyArray<{
  value: OrderShippingDelayCustomerPath;
  label: string;
  description: string;
}> = [
  {
    value: "notify_only",
    label: "Notify only",
    description: "Use when the store just needs to communicate a revised date."
  },
  {
    value: "request_delay_approval",
    label: "Request delay approval",
    description: "Use when the customer should explicitly approve the revised timing."
  },
  {
    value: "offer_cancel_or_refund",
    label: "Offer cancel or refund",
    description: "Use when the delay is material enough that the customer should be offered a way out."
  }
] as const;

export const ORDER_SHIPPING_DELAY_STATUS_OPTIONS: ReadonlyArray<{
  value: OrderShippingDelayStatus;
  label: string;
}> = [
  { value: "delay_detected", label: "Delay detected" },
  { value: "customer_contact_required", label: "Customer contact required" },
  { value: "awaiting_customer_response", label: "Awaiting customer response" },
  { value: "delay_approved", label: "Delay approved" },
  { value: "delay_rejected", label: "Delay rejected" },
  { value: "cancel_requested", label: "Cancel requested" },
  { value: "refund_required", label: "Refund required" },
  { value: "resolved", label: "Resolved" },
] as const;

export function getShippingDelayReasonLabel(value: OrderShippingDelayReasonKey) {
  return ORDER_SHIPPING_DELAY_REASON_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getShippingDelayCustomerPathLabel(value: OrderShippingDelayCustomerPath) {
  return ORDER_SHIPPING_DELAY_CUSTOMER_PATH_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getShippingDelayStatusLabel(value: OrderShippingDelayStatus) {
  return ORDER_SHIPPING_DELAY_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getShippingDelayInitialStatus(customerPath: OrderShippingDelayCustomerPath): OrderShippingDelayStatus {
  switch (customerPath) {
    case "notify_only":
      return "customer_contact_required";
    case "request_delay_approval":
      return "awaiting_customer_response";
    case "offer_cancel_or_refund":
      return "refund_required";
    default:
      return "delay_detected";
  }
}
