export type StorefrontSettingsHome = "general" | "domains" | "storefront_studio" | "legal" | "privacy" | "admin_legal" | "retired";

export type StorefrontSettingsStatus = "active" | "partial" | "stranded" | "legacy" | "intentional";

export type StorefrontSettingsDisposition = "editable" | "rehome" | "retire" | "immutable";

export type StorefrontSettingsStorageModel =
  | "stores"
  | "store_branding"
  | "store_settings"
  | "store_privacy_profile"
  | "platform_storefront_privacy_settings"
  | "custom_domains"
  | "theme_json"
  | "storefront_copy_json";

export type StorefrontSettingsInventoryItem = {
  id: string;
  label: string;
  storageModel: StorefrontSettingsStorageModel;
  storageKey: string;
  runtimeUsage: string[];
  currentEditor: string[];
  targetHome: StorefrontSettingsHome;
  status: StorefrontSettingsStatus;
  disposition: StorefrontSettingsDisposition;
  notes: string;
};

function item(definition: StorefrontSettingsInventoryItem) {
  return definition;
}

export const STOREFRONT_SETTINGS_INVENTORY = [
  item({
    id: "store.name",
    label: "Store name",
    storageModel: "stores",
    storageKey: "name",
    runtimeUsage: ["Storefront header", "Browser/tab title", "Email copy", "Checkout copy"],
    currentEditor: ["Store Settings > General", "Legacy Store Identity form"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "Operational identity field. Keep one primary editor in General."
  }),
  item({
    id: "store.slug",
    label: "Store slug",
    storageModel: "stores",
    storageKey: "slug",
    runtimeUsage: ["Path-based storefront URL", "Canonical storefront links", "Dashboard routing"],
    currentEditor: ["Store bootstrap / onboarding only"],
    targetHome: "retired",
    status: "intentional",
    disposition: "immutable",
    notes: "Treat as immutable after bootstrap unless we design an explicit rename/migration workflow."
  }),
  item({
    id: "store.whiteLabelEnabled",
    label: "White labeling enabled",
    storageModel: "stores",
    storageKey: "white_label_enabled",
    runtimeUsage: ["Custom domain eligibility", "Metadata behavior on custom domains", "Robots/sitemap behavior"],
    currentEditor: ["Store Settings > General", "Store Settings > Domains read dependency"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "This is a store-level operational toggle, not a visual design control."
  }),
  item({
    id: "domains.customDomains",
    label: "Custom domains and primary domain",
    storageModel: "custom_domains",
    storageKey: "store_domains.*",
    runtimeUsage: ["White-labeled storefront routing", "Canonical domain resolution", "Primary domain behavior"],
    currentEditor: ["Store Settings > Domains"],
    targetHome: "domains",
    status: "active",
    disposition: "editable",
    notes: "Domain operations are already intentionally separated from General and Studio."
  }),
  item({
    id: "branding.logoPath",
    label: "Store logo",
    storageModel: "store_branding",
    storageKey: "logo_path",
    runtimeUsage: ["Storefront header", "Legal/storefront pages", "Email and checkout surfaces"],
    currentEditor: ["Store Settings > General", "Legacy Store Identity form", "Storefront Studio canvas inline logo"],
    targetHome: "general",
    status: "active",
    disposition: "rehome",
    notes: "Keep a primary home in General while allowing Studio preview/edit interactions to round-trip safely."
  }),
  item({
    id: "branding.faviconPath",
    label: "Browser favicon",
    storageModel: "store_branding",
    storageKey: "favicon_path",
    runtimeUsage: ["Browser tab icon on /s/<slug>", "Browser tab icon on white-labeled domains"],
    currentEditor: ["Store Settings > General"],
    targetHome: "general",
    status: "partial",
    disposition: "editable",
    notes: "The active editing surface exists, but it was only recently reintroduced and needs to stay part of the canonical inventory."
  }),
  item({
    id: "branding.appleTouchIconPath",
    label: "Apple touch icon",
    storageModel: "store_branding",
    storageKey: "apple_touch_icon_path",
    runtimeUsage: ["Home-screen icon metadata for storefronts"],
    currentEditor: ["Store Settings > General"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "Lives in General with the rest of the browser and sharing metadata assets."
  }),
  item({
    id: "branding.ogImagePath",
    label: "Open Graph image",
    storageModel: "store_branding",
    storageKey: "og_image_path",
    runtimeUsage: ["Open Graph preview image for storefront links"],
    currentEditor: ["Store Settings > General"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "Lives in General as the default storefront link preview image."
  }),
  item({
    id: "branding.twitterImagePath",
    label: "Twitter/X image",
    storageModel: "store_branding",
    storageKey: "twitter_image_path",
    runtimeUsage: ["Twitter/X preview image fallback for storefront links"],
    currentEditor: ["Store Settings > General"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "Lives in General beside the Open Graph image for browser/share metadata."
  }),
  item({
    id: "branding.primaryColor",
    label: "Primary brand color",
    storageModel: "store_branding",
    storageKey: "primary_color",
    runtimeUsage: ["Primary buttons", "Theme variables", "Accent surfaces"],
    currentEditor: ["Storefront Studio > Brand tab", "Legacy Branding form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Visual theme decision best judged in the live storefront canvas."
  }),
  item({
    id: "branding.accentColor",
    label: "Accent brand color",
    storageModel: "store_branding",
    storageKey: "accent_color",
    runtimeUsage: ["Announcement strip", "Accent highlights", "Theme variables"],
    currentEditor: ["Storefront Studio > Brand tab", "Legacy Branding form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Visual theme decision best judged in the live storefront canvas."
  }),
  item({
    id: "settings.seoTitle",
    label: "Store SEO title",
    storageModel: "store_settings",
    storageKey: "seo_title",
    runtimeUsage: ["Search metadata", "Storefront title fallback"],
    currentEditor: ["Store Settings > General", "Legacy SEO form"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "Search/distribution setting, not a Studio concern."
  }),
  item({
    id: "settings.seoDescription",
    label: "Store SEO description",
    storageModel: "store_settings",
    storageKey: "seo_description",
    runtimeUsage: ["Meta description for storefront pages"],
    currentEditor: ["Store Settings > General", "Legacy SEO form"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "Search/distribution setting, not a Studio concern."
  }),
  item({
    id: "settings.seoNoindex",
    label: "Hide storefront from search engines",
    storageModel: "store_settings",
    storageKey: "seo_noindex",
    runtimeUsage: ["Search engine indexing behavior"],
    currentEditor: ["Store Settings > General", "Legacy SEO form"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "Operational visibility setting."
  }),
  item({
    id: "settings.seoLocation",
    label: "Local SEO location fields",
    storageModel: "store_settings",
    storageKey: "seo_location_*",
    runtimeUsage: ["Local SEO metadata", "Structured store location hints"],
    currentEditor: ["Store Settings > General", "Legacy SEO form"],
    targetHome: "general",
    status: "active",
    disposition: "editable",
    notes: "Represents city/region/state/postal/country/address/show_full_address."
  }),
  item({
    id: "settings.supportEmail",
    label: "Support email",
    storageModel: "store_settings",
    storageKey: "support_email",
    runtimeUsage: ["Footer support link", "About page contact area", "Policies page support block"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Displayed directly in the storefront experience, so Studio is the right primary home."
  }),
  item({
    id: "settings.fulfillmentMessage",
    label: "Fulfillment message",
    storageModel: "store_settings",
    storageKey: "fulfillment_message",
    runtimeUsage: ["About page ‘at a glance’ module", "Made-to-order availability copy"],
    currentEditor: ["Storefront Studio canvas inline", "Fulfillment settings panel"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Already behaves like a Studio-owned storefront message."
  }),
  item({
    id: "settings.shippingPolicy",
    label: "Shipping policy storefront copy",
    storageModel: "store_settings",
    storageKey: "shipping_policy",
    runtimeUsage: ["Policies page content", "FAQ lead text", "Support expectations"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Customer-facing policy presentation belongs in Studio; formal legal terms stay in Legal."
  }),
  item({
    id: "settings.returnPolicy",
    label: "Returns policy storefront copy",
    storageModel: "store_settings",
    storageKey: "return_policy",
    runtimeUsage: ["Policies page content", "FAQ lead text", "Return expectations"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Customer-facing policy presentation belongs in Studio; formal legal terms stay in Legal."
  }),
  item({
    id: "settings.announcement",
    label: "Announcement bar text",
    storageModel: "store_settings",
    storageKey: "announcement",
    runtimeUsage: ["Top announcement/policy strip across storefront pages"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Presentation/copy control for a live storefront surface."
  }),
  item({
    id: "settings.footerTagline",
    label: "Footer tagline",
    storageModel: "store_settings",
    storageKey: "footer_tagline",
    runtimeUsage: ["Footer brand text block"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Presentation copy, already naturally edited in Studio."
  }),
  item({
    id: "settings.footerNote",
    label: "Footer note",
    storageModel: "store_settings",
    storageKey: "footer_note",
    runtimeUsage: ["Footer secondary note"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Presentation copy, already naturally edited in Studio."
  }),
  item({
    id: "settings.socialLinks",
    label: "Footer/about social links",
    storageModel: "store_settings",
    storageKey: "instagram_url,facebook_url,tiktok_url",
    runtimeUsage: ["Footer social icons", "About page social icons"],
    currentEditor: ["Storefront Studio > Footer tab", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Current active home should remain Studio; legacy form can be retired after migration."
  }),
  item({
    id: "settings.policyFaqs",
    label: "Policy FAQs",
    storageModel: "store_settings",
    storageKey: "policy_faqs",
    runtimeUsage: ["Policies page FAQ section"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Storefront FAQ presentation belongs in Studio."
  }),
  item({
    id: "settings.aboutArticleHtml",
    label: "About page rich text article",
    storageModel: "store_settings",
    storageKey: "about_article_html",
    runtimeUsage: ["About page primary narrative content"],
    currentEditor: ["Storefront Studio canvas inline rich text", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Presentation content belongs in Studio."
  }),
  item({
    id: "settings.aboutSections",
    label: "About page structured sections",
    storageModel: "store_settings",
    storageKey: "about_sections",
    runtimeUsage: ["About page section blocks"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Presentation content belongs in Studio."
  }),
  item({
    id: "settings.newsletterCaptureEnabled",
    label: "Footer newsletter enabled",
    storageModel: "store_settings",
    storageKey: "email_capture_enabled",
    runtimeUsage: ["Footer newsletter module visibility"],
    currentEditor: ["Storefront Studio > Footer tab", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Presentation/merchandising decision; Studio is the right home."
  }),
  item({
    id: "settings.newsletterCaptureHeading",
    label: "Footer newsletter heading",
    storageModel: "store_settings",
    storageKey: "email_capture_heading",
    runtimeUsage: ["Footer newsletter module heading"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Presentation copy for the live footer module."
  }),
  item({
    id: "settings.newsletterCaptureDescription",
    label: "Footer newsletter description",
    storageModel: "store_settings",
    storageKey: "email_capture_description",
    runtimeUsage: ["Footer newsletter descriptive copy"],
    currentEditor: ["Storefront Studio canvas inline", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Presentation copy for the live footer module."
  }),
  item({
    id: "settings.newsletterCaptureSuccessMessage",
    label: "Footer newsletter success message",
    storageModel: "store_settings",
    storageKey: "email_capture_success_message",
    runtimeUsage: ["Newsletter success toast/message"],
    currentEditor: ["Storefront Studio > Footer tab", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Keeps the opt-in surface self-contained in Studio."
  }),
  item({
    id: "settings.checkoutLocalPickup",
    label: "Local pickup availability, label, and fee",
    storageModel: "store_settings",
    storageKey: "checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents",
    runtimeUsage: ["Cart/checkout delivery method presentation"],
    currentEditor: ["Pickup settings manager", "Storefront Studio fulfillment settings"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Keep operational rate logic intact, but customer-facing labels belong with storefront fulfillment presentation."
  }),
  item({
    id: "settings.checkoutFlatRateShipping",
    label: "Flat-rate shipping availability, label, and fee",
    storageModel: "store_settings",
    storageKey: "checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents",
    runtimeUsage: ["Cart/checkout delivery method presentation"],
    currentEditor: ["Storefront Studio fulfillment settings", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Keep operational rate logic intact, but customer-facing labels belong with storefront fulfillment presentation."
  }),
  item({
    id: "settings.checkoutOrderNote",
    label: "Checkout order note enablement and prompt",
    storageModel: "store_settings",
    storageKey: "checkout_allow_order_note,checkout_order_note_prompt",
    runtimeUsage: ["Cart/checkout note field presentation"],
    currentEditor: ["Storefront Studio > Cart tab", "Storefront Studio fulfillment settings", "Legacy Store Policies form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "rehome",
    notes: "Pure storefront behavior/prompt copy."
  }),
  item({
    id: "settings.storeAlertPopup",
    label: "Store alert popup enablement, title, message, delay, and dismiss window",
    storageModel: "store_settings",
    storageKey: "store_alert_enabled,store_alert_title,store_alert_message,store_alert_delay_seconds,store_alert_dismiss_days",
    runtimeUsage: ["Customer-facing alert modal across all storefront pages"],
    currentEditor: ["Storefront Studio > Alert tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Sequenced after the welcome popup so the two never overlap."
  }),
  item({
    id: "settings.storefrontCopy",
    label: "Storefront copy families",
    storageModel: "storefront_copy_json",
    storageKey: "nav,home,sort,availabilityFilter,availability,productDetail,reviews,about,policies,footer,cart,checkout",
    runtimeUsage: ["Customer-facing labels and helper copy across all storefront pages"],
    currentEditor: ["Storefront Studio canvas inline", "Content workspace legacy forms", "Legacy Store Policies form raw JSON"],
    targetHome: "storefront_studio",
    status: "partial",
    disposition: "rehome",
    notes: "Families are largely editable in Studio/canvas today, but the legacy content-workspace surfaces still exist and there is no single canonical registry tying them together."
  }),
  item({
    id: "privacy.noticeAtCollectionEnabled",
    label: "Privacy notice-at-collection master toggle",
    storageModel: "platform_storefront_privacy_settings",
    storageKey: "notice_at_collection_enabled",
    runtimeUsage: ["Checkout/newsletter/review privacy notice behavior"],
    currentEditor: ["Admin > Legal > Privacy governance"],
    targetHome: "admin_legal",
    status: "active",
    disposition: "editable",
    notes: "Platform-owned compliance behavior for shared storefront collection notices."
  }),
  item({
    id: "privacy.noticeSurfaceToggles",
    label: "Checkout/newsletter/review privacy notice toggles",
    storageModel: "platform_storefront_privacy_settings",
    storageKey: "checkout_notice_enabled,newsletter_notice_enabled,review_notice_enabled",
    runtimeUsage: ["Notice display on specific storefront collection surfaces"],
    currentEditor: ["Admin > Legal > Privacy governance"],
    targetHome: "admin_legal",
    status: "active",
    disposition: "editable",
    notes: "Platform-owned compliance behavior for shared storefront notice surfaces."
  }),
  item({
    id: "privacy.californiaControls",
    label: "California notice and do-not-sell controls",
    storageModel: "platform_storefront_privacy_settings",
    storageKey: "show_california_notice,show_do_not_sell_link",
    runtimeUsage: ["Privacy request page and California rights messaging"],
    currentEditor: ["Admin > Legal > Privacy governance"],
    targetHome: "admin_legal",
    status: "active",
    disposition: "editable",
    notes: "Platform controls whether these rights surfaces exist; stores only add optional California or opt-out copy."
  }),
  item({
    id: "privacy.contactInfo",
    label: "Privacy contact info and request intro copy",
    storageModel: "store_privacy_profile",
    storageKey:
      "privacy_contact_email,privacy_rights_email,privacy_contact_name,request_page_intro_markdown,collection_notice_addendum_markdown,california_notice_markdown,do_not_sell_markdown",
    runtimeUsage: ["Privacy request page", "Notice copy", "Rights communication details"],
    currentEditor: ["Store Settings > Privacy"],
    targetHome: "privacy",
    status: "active",
    disposition: "editable",
    notes: "Store-specific privacy contacts and disclosure addenda remain merchant-editable in Privacy settings."
  }),
  item({
    id: "theme.pageWidth",
    label: "Page width",
    storageModel: "theme_json",
    storageKey: "pageWidth",
    runtimeUsage: ["Page shell width", "Cookie banner width", "Loading skeleton width"],
    currentEditor: ["Storefront Studio > Brand tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Already has a live Studio control."
  }),
  item({
    id: "theme.fontFamily",
    label: "Font family",
    storageModel: "theme_json",
    storageKey: "fontFamily",
    runtimeUsage: ["Storefront heading/body font stacks"],
    currentEditor: ["Storefront Studio > Brand tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Already has a live Studio control."
  }),
  item({
    id: "theme.radiusScale",
    label: "Corner radius",
    storageModel: "theme_json",
    storageKey: "radiusScale",
    runtimeUsage: ["Input/button/card radius across storefront pages and cookie UI"],
    currentEditor: ["Storefront Studio > Brand tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Already has a live Studio control."
  }),
  item({
    id: "theme.cardStyle",
    label: "Card style",
    storageModel: "theme_json",
    storageKey: "cardStyle",
    runtimeUsage: ["Card surface presentation", "Cookie banner/sheet styling"],
    currentEditor: ["Storefront Studio > Brand tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Already has a live Studio control."
  }),
  item({
    id: "theme.spacingScale",
    label: "Page spacing",
    storageModel: "theme_json",
    storageKey: "spacingScale",
    runtimeUsage: ["Page shell spacing", "Loading skeleton spacing", "Cookie UI spacing"],
    currentEditor: ["Storefront Studio > Brand tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Already has a live Studio control."
  }),
  item({
    id: "theme.primaryForegroundColor",
    label: "Primary action foreground color",
    storageModel: "theme_json",
    storageKey: "primaryForegroundColor",
    runtimeUsage: ["Primary button text contrast"],
    currentEditor: ["Storefront Studio > Brand tab", "Legacy Branding form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Live Studio control exists."
  }),
  item({
    id: "theme.accentForegroundColor",
    label: "Accent action foreground color",
    storageModel: "theme_json",
    storageKey: "accentForegroundColor",
    runtimeUsage: ["Accent strip/button text contrast"],
    currentEditor: ["Storefront Studio > Brand tab", "Legacy Branding form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Live Studio control exists."
  }),
  item({
    id: "theme.backgroundSurfaceText",
    label: "Background, surface, and text colors",
    storageModel: "theme_json",
    storageKey: "backgroundColor,surfaceColor,textColor",
    runtimeUsage: ["Global storefront color system"],
    currentEditor: ["Storefront Studio > Brand tab", "Legacy Branding form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Grouped because these are edited as a color system."
  }),
  item({
    id: "theme.headerColors",
    label: "Header background and foreground colors",
    storageModel: "theme_json",
    storageKey: "headerBackgroundColor,headerForegroundColor",
    runtimeUsage: ["Storefront header chrome"],
    currentEditor: ["Storefront Studio > Header tab", "Legacy Branding form"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Header-specific visual controls already exposed in Studio."
  }),
  item({
    id: "theme.primaryCtaStyle",
    label: "Primary CTA style",
    storageModel: "theme_json",
    storageKey: "primaryCtaStyle",
    runtimeUsage: ["Hero/product CTA treatment"],
    currentEditor: ["Storefront Studio > Brand tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Live Studio control exists."
  }),
  item({
    id: "theme.headerStructure",
    label: "Header logo/title visibility and sizes",
    storageModel: "theme_json",
    storageKey: "headerShowLogo,headerShowTitle,headerLogoSize,headerTitleSize,headerNavItems",
    runtimeUsage: ["Shared storefront header layout and navigation"],
    currentEditor: ["Storefront Studio > Header tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Header IA is correctly Studio-owned."
  }),
  item({
    id: "theme.footerStructure",
    label: "Footer nav and footer utility toggles",
    storageModel: "theme_json",
    storageKey: "footerNavItems,showFooterBackToTop,showFooterOwnerLogin",
    runtimeUsage: ["Footer link groups and utility affordances"],
    currentEditor: ["Storefront Studio > Footer tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Footer IA is correctly Studio-owned."
  }),
  item({
    id: "theme.heroNarrative",
    label: "Hero text and badge content",
    storageModel: "theme_json",
    storageKey: "heroEyebrow,heroHeadline,heroSubcopy,heroBadgeOne,heroBadgeTwo,heroBadgeThree",
    runtimeUsage: ["Home hero presentation", "About hero fallback usage"],
    currentEditor: ["Storefront Studio canvas inline", "Home surface controls"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Canvas editing already covers most of this, but it still belongs in the canonical inventory."
  }),
  item({
    id: "theme.heroLayout",
    label: "Hero layout and image size",
    storageModel: "theme_json",
    storageKey: "heroLayout,heroImageSize",
    runtimeUsage: ["Home hero structural layout"],
    currentEditor: ["Storefront Studio > Home tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Live Studio controls exist."
  }),
  item({
    id: "theme.heroBrandDisplay",
    label: "Hero brand display mode",
    storageModel: "theme_json",
    storageKey: "heroBrandDisplay,heroShowLogo,heroShowTitle",
    runtimeUsage: ["How the hero represents the brand name/logo"],
    currentEditor: ["Storefront Studio > Home tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Explicit Home-tab control now owns the hero logo/title mode."
  }),
  item({
    id: "theme.policyStripVisibility",
    label: "Announcement/policy strip visibility",
    storageModel: "theme_json",
    storageKey: "showPolicyStrip",
    runtimeUsage: ["Global top strip visibility across storefront pages"],
    currentEditor: ["Storefront Studio > Header tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "This overlaps with section-level announcement editing and needs a clearer IA note, but it is editable."
  }),
  item({
    id: "theme.homeVisibility",
    label: "Home section visibility toggles",
    storageModel: "theme_json",
    storageKey: "homeShowHero,homeShowContentBlocks,homeShowFeaturedProducts",
    runtimeUsage: ["Home page section visibility"],
    currentEditor: ["Storefront Studio > Home tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Live Studio controls exist."
  }),
  item({
    id: "theme.homeFeaturedProductsLimit",
    label: "Featured products limit",
    storageModel: "theme_json",
    storageKey: "homeFeaturedProductsLimit",
    runtimeUsage: ["Number of featured products shown on home"],
    currentEditor: ["Storefront Studio > Home tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Active Home-tab control persists the featured-products count."
  }),
  item({
    id: "theme.catalogLayout",
    label: "Catalog layout controls",
    storageModel: "theme_json",
    storageKey: "productGridColumns,productsFilterLayout,productsFiltersDefaultOpen",
    runtimeUsage: ["Products page layout", "Loading skeleton layout"],
    currentEditor: ["Storefront Studio > Products tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Grid columns, filter layout, and filters-default-open all live on the Products tab."
  }),
  item({
    id: "theme.catalogFilterVisibility",
    label: "Catalog filter/search visibility",
    storageModel: "theme_json",
    storageKey: "productsShowSearch,productsShowSort,productsShowAvailability,productsShowOptionFilters",
    runtimeUsage: ["Products page controls visibility"],
    currentEditor: ["Storefront Studio > Products tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Live Studio controls exist."
  }),
  item({
    id: "theme.productCardBehavior",
    label: "Product card display and media behavior",
    storageModel: "theme_json",
    storageKey: "productCardShowDescription,productCardDescriptionLines,productCardShowFeaturedBadge,productCardShowAvailability,productCardShowQuickAdd,productCardImageHoverZoom,productCardShowCarouselArrows,productCardShowCarouselDots,productCardImageFit",
    runtimeUsage: ["Products grid card rendering"],
    currentEditor: ["Storefront Studio > Products tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "All product-card display, line-clamp, and image-fit controls live on the Products tab."
  }),
  item({
    id: "theme.reviewsGlobal",
    label: "Reviews behavior controls",
    storageModel: "theme_json",
    storageKey: "reviewsEnabled,reviewsShowOnHome,reviewsShowOnProductDetail,reviewsFormEnabled,reviewsDefaultSort,reviewsItemsPerPage,reviewsShowVerifiedBadge,reviewsShowMediaGallery,reviewsShowSummary",
    runtimeUsage: ["Storefront review rendering, sorting, pagination, and form behavior"],
    currentEditor: ["Storefront Studio > Products tab", "Storefront Studio > Product Detail tab"],
    targetHome: "storefront_studio",
    status: "active",
    disposition: "editable",
    notes: "Global review enablement and home visibility live on Products; product-detail visibility, form, sort, pagination, summary, badge, and media controls live on Product Detail."
  }),
  item({
    id: "theme.buttonStyle",
    label: "Button style preset",
    storageModel: "theme_json",
    storageKey: "buttonStyle",
    runtimeUsage: ["Legacy theme payloads only"],
    currentEditor: [],
    targetHome: "retired",
    status: "legacy",
    disposition: "retire",
    notes: "Retired from the active theme contract because storefront rendering no longer uses it."
  }),
  item({
    id: "theme.fontPreset",
    label: "Font preset",
    storageModel: "theme_json",
    storageKey: "fontPreset",
    runtimeUsage: ["Compatibility fallback for older theme payloads"],
    currentEditor: [],
    targetHome: "retired",
    status: "legacy",
    disposition: "retire",
    notes: "Retired from the active theme contract but still honored as a migration fallback when resolving older storefront themes."
  })
] satisfies StorefrontSettingsInventoryItem[];

export const STOREFRONT_SETTINGS_STRANDED_IDS = STOREFRONT_SETTINGS_INVENTORY.filter((itemDefinition) => itemDefinition.status === "stranded").map(
  (itemDefinition) => itemDefinition.id
);
