export type StoreStatus = "draft" | "pending_review" | "active" | "suspended";
export type GlobalUserRole = "user" | "admin" | "support";
export type StoreMemberRole = "owner" | "admin" | "staff" | "customer";

export type StoreRecord = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  default_pickup_radius_miles: number;
  white_label_enabled: boolean;
  stripe_account_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StoreMembershipRecord = {
  id: string;
  store_id: string;
  user_id: string;
  role: StoreMemberRole;
  status: "active" | "invited" | "suspended";
  permissions_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserProfileRecord = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  global_role: GlobalUserRole;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProductStatus = "draft" | "active" | "archived";

export type ProductRecord = {
  id: string;
  store_id: string;
  title: string;
  description: string;
  slug: string;
  sku: string | null;
  image_urls: string[];
  image_alt_text: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_featured: boolean;
  price_cents: number;
  inventory_qty: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

export type ProductVariantStatus = "active" | "archived";
export type ProductVariantSkuMode = "auto" | "manual";

export type ProductVariantRecord = {
  id: string;
  store_id: string;
  product_id: string;
  title: string | null;
  sku: string | null;
  sku_mode: ProductVariantSkuMode;
  image_urls: string[];
  group_image_urls: string[];
  option_values: Record<string, string>;
  price_cents: number;
  inventory_qty: number;
  is_made_to_order: boolean;
  is_default: boolean;
  status: ProductVariantStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductOptionAxisRecord = {
  id: string;
  store_id: string;
  product_id: string;
  name: string;
  sort_order: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductOptionValueRecord = {
  id: string;
  store_id: string;
  product_id: string;
  axis_id: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreBrandingRecord = {
  store_id: string;
  logo_path: string | null;
  favicon_path: string | null;
  apple_touch_icon_path: string | null;
  og_image_path: string | null;
  twitter_image_path: string | null;
  primary_color: string | null;
  accent_color: string | null;
  theme_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StoreSettingsRecord = {
  store_id: string;
  support_email: string | null;
  fulfillment_message: string | null;
  shipping_policy: string | null;
  return_policy: string | null;
  announcement: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_noindex: boolean;
  seo_location_city: string | null;
  seo_location_region: string | null;
  seo_location_state: string | null;
  seo_location_postal_code: string | null;
  seo_location_country_code: string | null;
  seo_location_address_line1: string | null;
  seo_location_address_line2: string | null;
  seo_location_show_full_address: boolean;
  footer_tagline: string | null;
  footer_note: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  policy_faqs: Record<string, unknown>[];
  about_article_html: string | null;
  about_sections: Record<string, unknown>[];
  storefront_copy_json: Record<string, unknown>;
  email_capture_enabled: boolean;
  email_capture_heading: string | null;
  email_capture_description: string | null;
  email_capture_success_message: string | null;
  welcome_popup_enabled: boolean;
  welcome_popup_eyebrow: string | null;
  welcome_popup_headline: string | null;
  welcome_popup_body: string | null;
  welcome_popup_email_placeholder: string | null;
  welcome_popup_cta_label: string | null;
  welcome_popup_decline_label: string | null;
  welcome_popup_image_layout: string | null;
  welcome_popup_delay_seconds: number;
  welcome_popup_dismiss_days: number;
  welcome_popup_image_path: string | null;
  welcome_popup_promotion_id: string | null;
  checkout_enable_local_pickup: boolean;
  checkout_local_pickup_label: string | null;
  checkout_local_pickup_fee_cents: number;
  checkout_enable_flat_rate_shipping: boolean;
  checkout_flat_rate_shipping_label: string | null;
  checkout_flat_rate_shipping_fee_cents: number;
  checkout_allow_order_note: boolean;
  checkout_order_note_prompt: string | null;
  created_at: string;
  updated_at: string;
};

export type StoreLegalDocumentKey = "privacy" | "terms";
export type StoreLegalDocumentSourceMode = "template" | "custom";

export type StoreLegalDocumentRecord = {
  id: string;
  store_id: string;
  key: StoreLegalDocumentKey;
  source_mode: StoreLegalDocumentSourceMode;
  template_version: string;
  title_override: string | null;
  body_markdown: string;
  variables_json: Record<string, unknown>;
  published_source_mode: StoreLegalDocumentSourceMode;
  published_template_version: string;
  published_title: string | null;
  published_body_markdown: string;
  published_variables_json: Record<string, unknown>;
  published_version: number;
  published_change_summary: string | null;
  effective_at: string | null;
  published_at: string | null;
  published_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StorePrivacyRequestType = "access" | "deletion" | "correction" | "know" | "opt_out_sale_share";
export type StorePrivacyRequestStatus = "open" | "in_progress" | "completed" | "closed";
export type StorePrivacyOptOutState = "active" | "revoked";
export type AccessibilityReportStatus = "new" | "triaged" | "in_progress" | "resolved" | "dismissed";
export type AccessibilityReportPriority = "low" | "medium" | "high" | "critical";

export type StorePrivacyProfileRecord = {
  store_id: string;
  notice_at_collection_enabled: boolean;
  checkout_notice_enabled: boolean;
  newsletter_notice_enabled: boolean;
  review_notice_enabled: boolean;
  show_california_notice: boolean;
  show_do_not_sell_link: boolean;
  privacy_contact_email: string | null;
  privacy_rights_email: string | null;
  privacy_contact_name: string | null;
  collection_notice_addendum_markdown: string;
  california_notice_markdown: string;
  do_not_sell_markdown: string;
  request_page_intro_markdown: string;
  created_at: string;
  updated_at: string;
};

export type StorePrivacyRequestRecord = {
  id: string;
  store_id: string;
  email: string;
  full_name: string | null;
  request_type: StorePrivacyRequestType;
  status: StorePrivacyRequestStatus;
  source: "privacy_page" | "support" | "manual";
  details: string | null;
  metadata_json: Record<string, unknown>;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StorePrivacyOptOutRecord = {
  id: string;
  store_id: string;
  email: string;
  full_name: string | null;
  state: StorePrivacyOptOutState;
  source: "privacy_page" | "browser_signal" | "support" | "manual";
  latest_request_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AccessibilityReportRecord = {
  id: string;
  reporter_name: string | null;
  reporter_email: string;
  page_url: string | null;
  feature_area: string;
  issue_summary: string;
  expected_behavior: string | null;
  actual_behavior: string;
  assistive_technology: string | null;
  browser: string | null;
  device: string | null;
  blocks_critical_flow: boolean;
  status: AccessibilityReportStatus;
  priority: AccessibilityReportPriority;
  owner_notes: string | null;
  remediation_notes: string | null;
  source: "public_form" | "support" | "manual";
  triaged_at: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StoreEmailSubscriberStatus = "subscribed" | "unsubscribed";

export type StoreEmailSubscriberRecord = {
  id: string;
  store_id: string;
  email: string;
  status: StoreEmailSubscriberStatus;
  source: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StoreContentBlockRecord = {
  id: string;
  store_id: string;
  sort_order: number;
  eyebrow: string | null;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";

export type OrderRefundStatus = "requested" | "processing" | "succeeded" | "failed" | "cancelled";

export type OrderRecord = {
  id: string;
  store_id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  customer_email: string;
  customer_note: string | null;
  fulfillment_method: "pickup" | "shipping" | null;
  fulfillment_label: string | null;
  pickup_location_id: string | null;
  pickup_location_snapshot_json: Record<string, unknown> | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
  pickup_timezone: string | null;
  shipping_fee_cents: number;
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  status: OrderStatus;
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  fulfilled_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  stripe_payment_intent_id: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipment_provider: string | null;
  shipment_tracker_id: string | null;
  shipment_status: string | null;
  last_tracking_sync_at: string | null;
  discount_cents: number;
  promo_code: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderRefundRecord = {
  id: string;
  order_id: string;
  store_id: string;
  requested_by_user_id: string | null;
  processed_by_user_id: string | null;
  amount_cents: number;
  reason_key: string;
  reason_note: string | null;
  customer_message: string | null;
  status: OrderRefundStatus;
  stripe_refund_id: string | null;
  metadata_json: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderDisputeStatus =
  | "warning_needs_response"
  | "warning_under_review"
  | "warning_closed"
  | "needs_response"
  | "under_review"
  | "won"
  | "lost"
  | "prevented";

export type OrderDisputeRecord = {
  id: string;
  order_id: string;
  store_id: string;
  stripe_dispute_id: string;
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_cents: number;
  currency: string;
  reason: string;
  status: OrderDisputeStatus;
  is_charge_refundable: boolean;
  response_due_by: string | null;
  metadata_json: Record<string, unknown>;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderShippingDelayStatus =
  | "delay_detected"
  | "customer_contact_required"
  | "awaiting_customer_response"
  | "delay_approved"
  | "delay_rejected"
  | "cancel_requested"
  | "refund_required"
  | "resolved";

export type OrderShippingDelayReasonKey =
  | "inventory_shortfall"
  | "supplier_delay"
  | "production_delay"
  | "carrier_disruption"
  | "weather_or_emergency"
  | "address_or_verification_issue"
  | "fulfillment_capacity_issue"
  | "other";

export type OrderShippingDelayCustomerPath =
  | "notify_only"
  | "request_delay_approval"
  | "offer_cancel_or_refund";

export type OrderShippingDelayRecord = {
  id: string;
  order_id: string;
  store_id: string;
  created_by_user_id: string | null;
  resolved_by_user_id: string | null;
  status: OrderShippingDelayStatus;
  reason_key: OrderShippingDelayReasonKey;
  customer_path: OrderShippingDelayCustomerPath;
  original_ship_promise: string | null;
  revised_ship_date: string | null;
  internal_note: string | null;
  resolution_note: string | null;
  metadata_json: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PickupSelectionMode = "buyer_select" | "hidden_nearest";
export type PickupGeolocationFallbackMode = "allow_without_distance" | "disable_pickup";
export type PickupOutOfRadiusBehavior = "disable_pickup" | "allow_all_locations";

export type StorePickupSettingsRecord = {
  store_id: string;
  pickup_enabled: boolean;
  selection_mode: PickupSelectionMode;
  geolocation_fallback_mode: PickupGeolocationFallbackMode;
  out_of_radius_behavior: PickupOutOfRadiusBehavior;
  eligibility_radius_miles: number;
  lead_time_hours: number;
  slot_interval_minutes: 15 | 30 | 60 | 120;
  show_pickup_times: boolean;
  timezone: string;
  instructions: string | null;
  created_at: string;
  updated_at: string;
};

export type PickupLocationRecord = {
  id: string;
  store_id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_region: string;
  postal_code: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PickupLocationHoursRecord = {
  id: string;
  pickup_location_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  created_at: string;
  updated_at: string;
};

export type PickupBlackoutDateRecord = {
  id: string;
  store_id: string;
  pickup_location_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerProfileRecord = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  default_shipping_address_json: Record<string, unknown>;
  preferences_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CustomerSavedStoreRecord = {
  id: string;
  user_id: string;
  store_id: string;
  created_at: string;
};

export type CustomerSavedItemRecord = {
  id: string;
  user_id: string;
  store_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type CustomerCartRecord = {
  id: string;
  user_id: string;
  store_id: string;
  status: "active" | "ordered" | "abandoned";
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CustomerCartItemRecord = {
  id: string;
  cart_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  quantity: number;
  unit_price_snapshot_cents: number;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BillingPlanRecord = {
  id: string;
  key: string;
  name: string;
  monthly_price_cents: number;
  transaction_fee_bps: number;
  transaction_fee_fixed_cents: number;
  feature_flags_json: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreBillingProfileRecord = {
  store_id: string;
  billing_plan_id: string | null;
  test_mode_enabled: boolean;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OrderFeeBreakdownRecord = {
  id: string;
  order_id: string;
  store_id: string;
  plan_key: string | null;
  fee_bps: number;
  fee_fixed_cents: number;
  subtotal_cents: number;
  platform_fee_cents: number;
  net_payout_cents: number;
  created_at: string;
};

export type BillingEventRecord = {
  id: string;
  store_id: string;
  event_type: string;
  source: string | null;
  payload_json: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

export type StoreDomainRecord = {
  id: string;
  store_id: string;
  domain: string;
  is_primary: boolean;
  verification_status: "pending" | "verified" | "failed";
  verification_token: string | null;
  last_verification_at: string | null;
  verified_at: string | null;
  hosting_provider: "vercel";
  hosting_status: "pending" | "provisioning" | "ready" | "failed" | "not_configured";
  hosting_last_checked_at: string | null;
  hosting_ready_at: string | null;
  hosting_error: string | null;
  hosting_metadata_json: Record<string, unknown>;
  email_provider: "resend";
  email_sender_enabled: boolean;
  email_status: "pending" | "provisioning" | "ready" | "failed" | "not_configured";
  email_domain_id: string | null;
  email_last_checked_at: string | null;
  email_ready_at: string | null;
  email_error: string | null;
  email_metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OrderItemRecord = {
  id: string;
  order_id: string;
  product_id: string;
  product_variant_id: string | null;
  quantity: number;
  unit_price_cents: number;
  variant_label: string | null;
  variant_snapshot: Record<string, unknown>;
  created_at: string;
};

export type InventoryMovementReason = "sale" | "restock" | "adjustment";

export type InventoryMovementRecord = {
  id: string;
  store_id: string;
  product_id: string;
  product_variant_id: string | null;
  order_id: string | null;
  delta_qty: number;
  reason: InventoryMovementReason;
  note: string | null;
  created_at: string;
};

export type PromotionDiscountType = "percent" | "fixed";

export type PromotionRecord = {
  id: string;
  store_id: string;
  code: string;
  discount_type: PromotionDiscountType;
  discount_value: number;
  min_subtotal_cents: number;
  max_redemptions: number | null;
  per_customer_redemption_limit: number | null;
  times_redeemed: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PromotionRedemptionRecord = {
  id: string;
  store_id: string;
  promotion_id: string;
  order_id: string;
  customer_user_id: string | null;
  customer_email_normalized: string;
  created_at: string;
};

export type AuditEventRecord = {
  id: string;
  store_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationStatus = "pending" | "sent" | "failed" | "dismissed" | "read";
export type NotificationChannel = "in_app" | "email";
export type NotificationDeliveryStatus = "sent" | "failed";

export type NotificationRecord = {
  id: string;
  store_id: string | null;
  recipient_user_id: string;
  recipient_email: string | null;
  event_type: string;
  title: string;
  body: string;
  action_url: string | null;
  severity: NotificationSeverity;
  channel_targets: Record<string, unknown>;
  status: NotificationStatus;
  read_at: string | null;
  sent_at: string | null;
  dedupe_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NotificationDeliveryAttemptRecord = {
  id: string;
  notification_id: string;
  channel: NotificationChannel;
  provider: string | null;
  status: NotificationDeliveryStatus;
  error: string | null;
  response_json: Record<string, unknown>;
  created_at: string;
};
