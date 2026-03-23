export type StorefrontCopyConfig = {
  nav: {
    home: string;
    products: string;
    about: string;
    policies: string;
    openCartAria: string;
  };
  home: {
    shopProductsCta: string;
    shopProductsUrl: string;
    aboutBrandCta: string;
    aboutBrandUrl: string;
    storeNotesLabel: string;
    contentBlocksHeading: string;
    browseFilterTitle: string;
    featuredIncludedNote: string;
    searchLabel: string;
    searchPlaceholder: string;
    sortLabel: string;
    availabilityLabel: string;
    resetFilters: string;
    featuredProductsHeading: string;
    shopProductsHeading: string;
    shownSuffix: string;
    noProductsMatch: string;
    noDescriptionYet: string;
    featuredBadge: string;
    addButton: string;
    showFiltersAria: string;
    hideFiltersAria: string;
  };
  sort: {
    featuredFirst: string;
    newestFirst: string;
    priceLowToHigh: string;
    priceHighToLow: string;
    nameAToZ: string;
  };
  availabilityFilter: {
    all: string;
    inStock: string;
    madeToOrder: string;
  };
  availability: {
    unavailable: string;
    madeToOrder: string;
    madeToOrderWithFulfillmentTemplate: string;
    outOfStock: string;
    inStockSuffix: string;
  };
  productDetail: {
    breadcrumbProducts: string;
    optionsLabel: string;
    addToCart: string;
    addToCartMadeToOrder: string;
    outOfStockButton: string;
    backToAllProducts: string;
  };
  reviews: {
    sectionTitle: string;
    summaryTemplate: string;
    emptyState: string;
    loadMore: string;
    formTitle: string;
    anonymousReviewer: string;
    verifiedPurchaseBadge: string;
    submitButton: string;
    submittingButton: string;
    moderationSuccessMessage: string;
    loadingMessage: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    titlePlaceholder: string;
    bodyPlaceholder: string;
    imageHelperText: string;
    imageCountTemplate: string;
  };
  about: {
    aboutPrefix: string;
    shopProductsCta: string;
    shippingReturnsCta: string;
    atAGlanceLabel: string;
    whoWeAreLabel: string;
    ourStoryHeading: string;
    ourPhilosophyLabel: string;
    whatShapesOurWorkHeading: string;
    needDetailsLabel: string;
    needDetailsHeading: string;
    needDetailsBody: string;
    readPoliciesLink: string;
    questionsLabel: string;
    questionsHeading: string;
    questionsBody: string;
    contactSupport: string;
    supportComingSoon: string;
  };
  policies: {
    customerCareEyebrow: string;
    title: string;
    subtitle: string;
    lastUpdatedPrefix: string;
    shippingAtAGlance: string;
    returnsAtAGlance: string;
    supportAtAGlance: string;
    shippingPolicyLabel: string;
    shippingHeading: string;
    returnsPolicyLabel: string;
    returnsHeading: string;
    returnComingSoon: string;
    supportLabel: string;
    supportHeading: string;
    supportBodyPrefix: string;
    supportComingSoon: string;
    formalDocumentsLabel: string;
    privacyPolicyLink: string;
    termsConditionsLink: string;
    faqLabel: string;
    fallbackFaq1Question: string;
    fallbackFaq1Answer: string;
    fallbackFaq2Question: string;
    fallbackFaq2Answer: string;
    backToAbout: string;
    shippingLeadFallback: string;
    returnLeadFallback: string;
    supportLeadFallback: string;
  };
  footer: {
    shopLabel: string;
    legalLabel: string;
    allProductsLink: string;
    cartLink: string;
    aboutLink: string;
    policiesLink: string;
    privacyLink: string;
    termsLink: string;
    supportLabel: string;
    contactSupport: string;
    supportComingSoon: string;
    defaultTagline: string;
    rightsReserved: string;
    backToTop: string;
    ownerLogin: string;
  };
  cart: {
    title: string;
    subtitle: string;
    empty: string;
    browseProducts: string;
    remove: string;
    orderSummary: string;
    subtotalLabel: string;
    discountLabel: string;
    estimatedTotalLabel: string;
    emailPlaceholder: string;
    promoPlaceholder: string;
    applyPromo: string;
    applyingPromo: string;
    checkout: string;
    processing: string;
    continueShopping: string;
    addAtLeastOneToCartError: string;
    applyPromoError: string;
    checkoutFailed: string;
  };
  checkout: {
    title: string;
    cancelled: string;
    preparingStatus: string;
    returnToCartPrompt: string;
    paymentReceivedFinalizing: string;
    orderPlacedTemplate: string;
    finalizationFailed: string;
    backToCart: string;
    continueShopping: string;
  };
};

export const DEFAULT_STOREFRONT_COPY: StorefrontCopyConfig = {
  nav: {
    home: "Home",
    products: "Products",
    about: "About",
    policies: "Policies",
    openCartAria: "Open cart"
  },
  home: {
    shopProductsCta: "Shop products",
    shopProductsUrl: "",
    aboutBrandCta: "About the brand",
    aboutBrandUrl: "",
    storeNotesLabel: "Store Notes",
    contentBlocksHeading: "Our Approach",
    browseFilterTitle: "Browse & Filter",
    featuredIncludedNote: "Featured products are included in this catalog.",
    searchLabel: "Search",
    searchPlaceholder: "Search products...",
    sortLabel: "Sort",
    availabilityLabel: "Availability",
    resetFilters: "Reset filters",
    featuredProductsHeading: "Featured Products",
    shopProductsHeading: "Shop Products",
    shownSuffix: "shown",
    noProductsMatch: "No products match your current filters.",
    noDescriptionYet: "No description yet.",
    featuredBadge: "Featured",
    addButton: "Add",
    showFiltersAria: "Show filters",
    hideFiltersAria: "Hide filters"
  },
  sort: {
    featuredFirst: "Featured first",
    newestFirst: "Newest first",
    priceLowToHigh: "Price: low to high",
    priceHighToLow: "Price: high to low",
    nameAToZ: "Name: A to Z"
  },
  availabilityFilter: {
    all: "All",
    inStock: "In stock",
    madeToOrder: "Made to order"
  },
  availability: {
    unavailable: "Unavailable",
    madeToOrder: "Made to order",
    madeToOrderWithFulfillmentTemplate: "Made to order • {message}",
    outOfStock: "Out of stock",
    inStockSuffix: "in stock"
  },
  productDetail: {
    breadcrumbProducts: "Products",
    optionsLabel: "Options",
    addToCart: "Add to cart",
    addToCartMadeToOrder: "Add to cart (made to order)",
    outOfStockButton: "Out of stock",
    backToAllProducts: "Back to all products"
  },
  reviews: {
    sectionTitle: "Reviews",
    summaryTemplate: "{average} average from {count} reviews",
    emptyState: "No published reviews yet.",
    loadMore: "Load more",
    formTitle: "Write a review",
    anonymousReviewer: "Anonymous",
    verifiedPurchaseBadge: "Verified purchase",
    submitButton: "Submit review",
    submittingButton: "Submitting...",
    moderationSuccessMessage: "Thanks. Your review was submitted and is awaiting moderation.",
    loadingMessage: "Loading reviews...",
    namePlaceholder: "Your name",
    emailPlaceholder: "you@example.com",
    titlePlaceholder: "Review title (optional)",
    bodyPlaceholder: "Tell other buyers about your experience",
    imageHelperText: "Drag to reorder. Click an image to replace it.",
    imageCountTemplate: "{current}/{max} images selected."
  },
  about: {
    aboutPrefix: "About",
    shopProductsCta: "Shop products",
    shippingReturnsCta: "Shipping & returns",
    atAGlanceLabel: "At a glance",
    whoWeAreLabel: "Who We Are",
    ourStoryHeading: "Our Story",
    ourPhilosophyLabel: "Our Philosophy",
    whatShapesOurWorkHeading: "What Shapes Our Work",
    needDetailsLabel: "Need details?",
    needDetailsHeading: "Shipping, returns, and policy information",
    needDetailsBody: "Visit our policies page for full shipping and return terms before placing your order.",
    readPoliciesLink: "Read policies",
    questionsLabel: "Questions?",
    questionsHeading: "We’re happy to help",
    questionsBody: "Reach out any time and we’ll get back to you with the information you need.",
    contactSupport: "Contact support",
    supportComingSoon: "Support contact coming soon."
  },
  policies: {
    customerCareEyebrow: "Customer Care",
    title: "Policies",
    subtitle: "Clear shipping, return, and support expectations before you place an order.",
    lastUpdatedPrefix: "Last updated",
    shippingAtAGlance: "Shipping",
    returnsAtAGlance: "Returns",
    supportAtAGlance: "Support",
    shippingPolicyLabel: "Shipping Policy",
    shippingHeading: "How shipping works",
    returnsPolicyLabel: "Return Policy",
    returnsHeading: "Returns and exchanges",
    returnComingSoon: "Return policy details are coming soon.",
    supportLabel: "Support",
    supportHeading: "Need help with an order?",
    supportBodyPrefix: "Email",
    supportComingSoon: "Support contact information is coming soon.",
    formalDocumentsLabel: "Formal documents",
    privacyPolicyLink: "Privacy Policy",
    termsConditionsLink: "Terms & Conditions",
    faqLabel: "FAQ",
    fallbackFaq1Question: "When will my order ship?",
    fallbackFaq1Answer: "Orders ship according to the timeline listed in our shipping policy.",
    fallbackFaq2Question: "Can I return opened items?",
    fallbackFaq2Answer: "Return eligibility is outlined in our return policy.",
    backToAbout: "Back to About",
    shippingLeadFallback: "Shipping timelines and fulfillment details are published here.",
    returnLeadFallback: "Return terms and eligibility are published here.",
    supportLeadFallback: "Support contact details are coming soon."
  },
  footer: {
    shopLabel: "Shop",
    legalLabel: "Legal",
    allProductsLink: "All products",
    cartLink: "Cart",
    aboutLink: "About",
    policiesLink: "Policies",
    privacyLink: "Privacy Policy",
    termsLink: "Terms & Conditions",
    supportLabel: "Support",
    contactSupport: "Contact support",
    supportComingSoon: "Support contact coming soon.",
    defaultTagline: "Thoughtful goods for everyday ritual.",
    rightsReserved: "All rights reserved.",
    backToTop: "Back to top",
    ownerLogin: "Owner login"
  },
  cart: {
    title: "Your Cart",
    subtitle: "Review your items before secure checkout.",
    empty: "Your cart is empty.",
    browseProducts: "Browse products",
    remove: "Remove",
    orderSummary: "Order Summary",
    subtotalLabel: "Subtotal",
    discountLabel: "Discount",
    estimatedTotalLabel: "Estimated total",
    emailPlaceholder: "you@example.com",
    promoPlaceholder: "Promo code (optional)",
    applyPromo: "Apply promo",
    applyingPromo: "Applying...",
    checkout: "Checkout",
    processing: "Processing...",
    continueShopping: "Continue shopping",
    addAtLeastOneToCartError: "Add at least one product to cart.",
    applyPromoError: "Unable to apply promo code.",
    checkoutFailed: "Checkout failed."
  },
  checkout: {
    title: "Checkout",
    cancelled: "Checkout was cancelled.",
    preparingStatus: "Preparing checkout status...",
    returnToCartPrompt: "Return to cart to continue checkout.",
    paymentReceivedFinalizing: "Payment received. Finalizing your order...",
    orderPlacedTemplate: "Order {orderId} placed successfully.",
    finalizationFailed: "Checkout finalization failed.",
    backToCart: "Back to cart",
    continueShopping: "Continue shopping"
  }
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMergeStrings<T extends Record<string, unknown>>(base: T, override: unknown): T {
  if (!isPlainObject(override)) {
    return base;
  }

  const next = { ...base } as Record<string, unknown>;

  for (const [key, value] of Object.entries(base)) {
    const overrideValue = override[key];

    if (typeof value === "string") {
      if (typeof overrideValue === "string" && overrideValue.trim().length > 0) {
        next[key] = overrideValue;
      }
      continue;
    }

    if (isPlainObject(value)) {
      next[key] = deepMergeStrings(value, overrideValue);
    }
  }

  return next as T;
}

export function resolveStorefrontCopy(input: unknown): StorefrontCopyConfig {
  return deepMergeStrings(DEFAULT_STOREFRONT_COPY, input);
}

export function formatCopyTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((resolved, [key, value]) => resolved.replaceAll(`{${key}}`, value), template);
}
