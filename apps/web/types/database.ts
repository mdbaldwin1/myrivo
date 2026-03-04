export type StoreStatus = "draft" | "active" | "suspended";
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
  sku: string | null;
  image_urls: string[];
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
  times_redeemed: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
