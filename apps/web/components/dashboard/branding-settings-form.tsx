"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import {
  resolveStorefrontThemeConfig,
  type CtaStyle,
  type FilterLayout,
  type FooterItemId,
  type ImageFit,
  type NavItemId
} from "@/lib/theme/storefront-theme";
import type { StoreBrandingRecord } from "@/types/database";

type BrandingSettingsFormProps = {
  initialBranding: Pick<StoreBrandingRecord, "primary_color" | "accent_color" | "theme_json"> | null;
};

type BrandingResponse = {
  branding?: Pick<StoreBrandingRecord, "primary_color" | "accent_color" | "theme_json">;
  error?: string;
};

const HEADER_NAV_OPTIONS: Array<{ id: NavItemId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "products", label: "Products" },
  { id: "about", label: "About" },
  { id: "policies", label: "Policies" }
];

const FOOTER_NAV_OPTIONS: Array<{ id: FooterItemId; label: string }> = [
  { id: "products", label: "Products" },
  { id: "cart", label: "Cart" },
  { id: "about", label: "About" },
  { id: "policies", label: "Policies" }
];

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#([0-9a-fA-F]{6})$/.test(hex) ? hex.toUpperCase() : null;
}

function resolveContrastingForeground(hex: string): string {
  const normalized = normalizeHex(hex) ?? "#000000";
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.6 ? "#111111" : "#FFFFFF";
}

export function BrandingSettingsForm({ initialBranding }: BrandingSettingsFormProps) {
  const initialTheme = resolveStorefrontThemeConfig(initialBranding?.theme_json ?? {});

  const [primaryColor, setPrimaryColor] = useState(initialBranding?.primary_color ?? "#0F7B84");
  const [accentColor, setAccentColor] = useState(initialBranding?.accent_color ?? "#1AA3A8");
  const [primaryForegroundColor, setPrimaryForegroundColor] = useState(
    initialTheme.primaryForegroundColor ?? resolveContrastingForeground(initialBranding?.primary_color ?? "#0F7B84")
  );
  const [accentForegroundColor, setAccentForegroundColor] = useState(
    initialTheme.accentForegroundColor ?? resolveContrastingForeground(initialBranding?.accent_color ?? "#1AA3A8")
  );
  const [backgroundColor, setBackgroundColor] = useState(initialTheme.backgroundColor);
  const [surfaceColor, setSurfaceColor] = useState(initialTheme.surfaceColor);
  const [textColor, setTextColor] = useState(initialTheme.textColor);

  const [headerBackgroundColor, setHeaderBackgroundColor] = useState(initialTheme.headerBackgroundColor);
  const [headerForegroundColor, setHeaderForegroundColor] = useState(initialTheme.headerForegroundColor);
  const [headerNavItems, setHeaderNavItems] = useState<NavItemId[]>(initialTheme.headerNavItems);

  const [showFooterBackToTop, setShowFooterBackToTop] = useState(initialTheme.showFooterBackToTop);
  const [showFooterOwnerLogin, setShowFooterOwnerLogin] = useState(initialTheme.showFooterOwnerLogin);
  const [footerNavItems, setFooterNavItems] = useState<FooterItemId[]>(initialTheme.footerNavItems);

  const [pageWidth, setPageWidth] = useState(initialTheme.pageWidth);
  const [fontPreset, setFontPreset] = useState(initialTheme.fontPreset);
  const [radiusScale, setRadiusScale] = useState(initialTheme.radiusScale);

  const [showPolicyStrip, setShowPolicyStrip] = useState(initialTheme.showPolicyStrip);
  const [showContentBlocks, setShowContentBlocks] = useState(initialTheme.showContentBlocks);
  const [homeShowHero, setHomeShowHero] = useState(initialTheme.homeShowHero);
  const [homeShowContentBlocks, setHomeShowContentBlocks] = useState(initialTheme.homeShowContentBlocks);
  const [homeShowFeaturedProducts, setHomeShowFeaturedProducts] = useState(initialTheme.homeShowFeaturedProducts);
  const [homeFeaturedProductsLimit, setHomeFeaturedProductsLimit] = useState(String(initialTheme.homeFeaturedProductsLimit));

  const [productGridColumns, setProductGridColumns] = useState(String(initialTheme.productGridColumns));
  const [productsFilterLayout, setProductsFilterLayout] = useState<FilterLayout>(initialTheme.productsFilterLayout);
  const [productsFiltersDefaultOpen, setProductsFiltersDefaultOpen] = useState(initialTheme.productsFiltersDefaultOpen);
  const [productsShowSearch, setProductsShowSearch] = useState(initialTheme.productsShowSearch);
  const [productsShowSort, setProductsShowSort] = useState(initialTheme.productsShowSort);
  const [productsShowAvailability, setProductsShowAvailability] = useState(initialTheme.productsShowAvailability);
  const [productsShowOptionFilters, setProductsShowOptionFilters] = useState(initialTheme.productsShowOptionFilters);

  const [primaryCtaStyle, setPrimaryCtaStyle] = useState<CtaStyle>(initialTheme.primaryCtaStyle);
  const [productCardImageFit, setProductCardImageFit] = useState<ImageFit>(initialTheme.productCardImageFit);
  const [productCardDescriptionLines, setProductCardDescriptionLines] = useState(String(initialTheme.productCardDescriptionLines));
  const [productCardShowDescription, setProductCardShowDescription] = useState(initialTheme.productCardShowDescription);
  const [productCardShowFeaturedBadge, setProductCardShowFeaturedBadge] = useState(initialTheme.productCardShowFeaturedBadge);
  const [productCardShowAvailability, setProductCardShowAvailability] = useState(initialTheme.productCardShowAvailability);
  const [productCardShowQuickAdd, setProductCardShowQuickAdd] = useState(initialTheme.productCardShowQuickAdd);
  const [productCardImageHoverZoom, setProductCardImageHoverZoom] = useState(initialTheme.productCardImageHoverZoom);
  const [productCardShowCarouselArrows, setProductCardShowCarouselArrows] = useState(initialTheme.productCardShowCarouselArrows);
  const [productCardShowCarouselDots, setProductCardShowCarouselDots] = useState(initialTheme.productCardShowCarouselDots);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        primaryColor,
        accentColor,
        primaryForegroundColor,
        accentForegroundColor,
        backgroundColor,
        surfaceColor,
        textColor,
        headerBackgroundColor,
        headerForegroundColor,
        headerNavItems,
        showFooterBackToTop,
        showFooterOwnerLogin,
        footerNavItems,
        pageWidth,
        fontPreset,
        radiusScale,
        showPolicyStrip,
        showContentBlocks,
        homeShowHero,
        homeShowContentBlocks,
        homeShowFeaturedProducts,
        homeFeaturedProductsLimit,
        productGridColumns,
        productsFilterLayout,
        productsFiltersDefaultOpen,
        productsShowSearch,
        productsShowSort,
        productsShowAvailability,
        productsShowOptionFilters,
        primaryCtaStyle,
        productCardImageFit,
        productCardDescriptionLines,
        productCardShowDescription,
        productCardShowFeaturedBadge,
        productCardShowAvailability,
        productCardShowQuickAdd,
        productCardImageHoverZoom,
        productCardShowCarouselArrows,
        productCardShowCarouselDots
      }),
    [
      primaryColor,
      accentColor,
      primaryForegroundColor,
      accentForegroundColor,
      backgroundColor,
      surfaceColor,
      textColor,
      headerBackgroundColor,
      headerForegroundColor,
      headerNavItems,
      showFooterBackToTop,
      showFooterOwnerLogin,
      footerNavItems,
      pageWidth,
      fontPreset,
      radiusScale,
      showPolicyStrip,
      showContentBlocks,
      homeShowHero,
      homeShowContentBlocks,
      homeShowFeaturedProducts,
      homeFeaturedProductsLimit,
      productGridColumns,
      productsFilterLayout,
      productsFiltersDefaultOpen,
      productsShowSearch,
      productsShowSort,
      productsShowAvailability,
      productsShowOptionFilters,
      primaryCtaStyle,
      productCardImageFit,
      productCardDescriptionLines,
      productCardShowDescription,
      productCardShowFeaturedBadge,
      productCardShowAvailability,
      productCardShowQuickAdd,
      productCardImageHoverZoom,
      productCardShowCarouselArrows,
      productCardShowCarouselDots
    ]
  );

  const [baseline, setBaseline] = useState(snapshot);

  function restoreBaseline() {
    try {
      const parsed = JSON.parse(baseline) as Record<string, unknown>;
      setPrimaryColor(String(parsed.primaryColor ?? primaryColor));
      setAccentColor(String(parsed.accentColor ?? accentColor));
      setPrimaryForegroundColor(String(parsed.primaryForegroundColor ?? primaryForegroundColor));
      setAccentForegroundColor(String(parsed.accentForegroundColor ?? accentForegroundColor));
      setBackgroundColor(String(parsed.backgroundColor ?? backgroundColor));
      setSurfaceColor(String(parsed.surfaceColor ?? surfaceColor));
      setTextColor(String(parsed.textColor ?? textColor));
      setHeaderBackgroundColor(String(parsed.headerBackgroundColor ?? headerBackgroundColor));
      setHeaderForegroundColor(String(parsed.headerForegroundColor ?? headerForegroundColor));
      setHeaderNavItems((parsed.headerNavItems as NavItemId[]) ?? headerNavItems);
      setShowFooterBackToTop(Boolean(parsed.showFooterBackToTop));
      setShowFooterOwnerLogin(Boolean(parsed.showFooterOwnerLogin));
      setFooterNavItems((parsed.footerNavItems as FooterItemId[]) ?? footerNavItems);
      setPageWidth((parsed.pageWidth as typeof pageWidth) ?? pageWidth);
      setFontPreset((parsed.fontPreset as typeof fontPreset) ?? fontPreset);
      setRadiusScale((parsed.radiusScale as typeof radiusScale) ?? radiusScale);
      setShowPolicyStrip(Boolean(parsed.showPolicyStrip));
      setShowContentBlocks(Boolean(parsed.showContentBlocks));
      setHomeShowHero(Boolean(parsed.homeShowHero));
      setHomeShowContentBlocks(Boolean(parsed.homeShowContentBlocks));
      setHomeShowFeaturedProducts(Boolean(parsed.homeShowFeaturedProducts));
      setHomeFeaturedProductsLimit(String(parsed.homeFeaturedProductsLimit ?? homeFeaturedProductsLimit));
      setProductGridColumns(String(parsed.productGridColumns ?? productGridColumns));
      setProductsFilterLayout((parsed.productsFilterLayout as FilterLayout) ?? productsFilterLayout);
      setProductsFiltersDefaultOpen(Boolean(parsed.productsFiltersDefaultOpen));
      setProductsShowSearch(Boolean(parsed.productsShowSearch));
      setProductsShowSort(Boolean(parsed.productsShowSort));
      setProductsShowAvailability(Boolean(parsed.productsShowAvailability));
      setProductsShowOptionFilters(Boolean(parsed.productsShowOptionFilters));
      setPrimaryCtaStyle((parsed.primaryCtaStyle as CtaStyle) ?? primaryCtaStyle);
      setProductCardImageFit((parsed.productCardImageFit as ImageFit) ?? productCardImageFit);
      setProductCardDescriptionLines(String(parsed.productCardDescriptionLines ?? productCardDescriptionLines));
      setProductCardShowDescription(Boolean(parsed.productCardShowDescription));
      setProductCardShowFeaturedBadge(Boolean(parsed.productCardShowFeaturedBadge));
      setProductCardShowAvailability(Boolean(parsed.productCardShowAvailability));
      setProductCardShowQuickAdd(Boolean(parsed.productCardShowQuickAdd));
      setProductCardImageHoverZoom(Boolean(parsed.productCardImageHoverZoom));
      setProductCardShowCarouselArrows(Boolean(parsed.productCardShowCarouselArrows));
      setProductCardShowCarouselDots(Boolean(parsed.productCardShowCarouselDots));
    } catch {
      // no-op
    }
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      restoreBaseline();
      return;
    }

    setError(null);
    setMessage(null);

    const parsedPrimary = normalizeHex(primaryColor);
    const parsedAccent = normalizeHex(accentColor);
    const parsedPrimaryForeground = normalizeHex(primaryForegroundColor);
    const parsedAccentForeground = normalizeHex(accentForegroundColor);
    const parsedBackground = normalizeHex(backgroundColor);
    const parsedSurface = normalizeHex(surfaceColor);
    const parsedText = normalizeHex(textColor);
    const parsedHeaderBackground = normalizeHex(headerBackgroundColor);
    const parsedHeaderForeground = normalizeHex(headerForegroundColor);

    if (
      !parsedPrimary ||
      !parsedAccent ||
      !parsedPrimaryForeground ||
      !parsedAccentForeground ||
      !parsedBackground ||
      !parsedSurface ||
      !parsedText ||
      !parsedHeaderBackground ||
      !parsedHeaderForeground
    ) {
      setError("All colors must be valid 6-digit hex values.");
      return;
    }

    const parsedProductGridColumns = Number.parseInt(productGridColumns, 10);
    const parsedHomeFeaturedProductsLimit = Number.parseInt(homeFeaturedProductsLimit, 10);
    const parsedProductCardDescriptionLines = Number.parseInt(productCardDescriptionLines, 10);

    if (!Number.isInteger(parsedProductGridColumns) || ![2, 3, 4].includes(parsedProductGridColumns)) {
      setError("Product grid columns must be 2, 3, or 4.");
      return;
    }

    if (!Number.isInteger(parsedHomeFeaturedProductsLimit) || parsedHomeFeaturedProductsLimit < 1 || parsedHomeFeaturedProductsLimit > 24) {
      setError("Featured products limit must be between 1 and 24.");
      return;
    }

    if (!Number.isInteger(parsedProductCardDescriptionLines) || parsedProductCardDescriptionLines < 1 || parsedProductCardDescriptionLines > 4) {
      setError("Description line clamp must be between 1 and 4.");
      return;
    }

    const safeHeaderNavItems = headerNavItems.length > 0 ? headerNavItems : initialTheme.headerNavItems;
    const safeFooterNavItems = footerNavItems.length > 0 ? footerNavItems : initialTheme.footerNavItems;

    const response = await fetch("/api/stores/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryColor: parsedPrimary,
        accentColor: parsedAccent,
        themeJson: {
          ...(initialBranding?.theme_json ?? {}),
          pageWidth,
          heroLayout: initialTheme.heroLayout,
          heroBrandDisplay: initialTheme.heroBrandDisplay,
          productGridColumns: parsedProductGridColumns,
          radiusScale,
          cardStyle: initialTheme.cardStyle,
          buttonStyle: initialTheme.buttonStyle,
          spacingScale: initialTheme.spacingScale,
          fontPreset,
          showContentBlocks,
          showPolicyStrip,
          heroEyebrow: initialTheme.heroEyebrow,
          heroHeadline: initialTheme.heroHeadline,
          heroSubcopy: initialTheme.heroSubcopy,
          heroBadgeOne: initialTheme.heroBadgeOne,
          heroBadgeTwo: initialTheme.heroBadgeTwo,
          heroBadgeThree: initialTheme.heroBadgeThree,
          primaryForegroundColor: parsedPrimaryForeground,
          accentForegroundColor: parsedAccentForeground,
          backgroundColor: parsedBackground,
          surfaceColor: parsedSurface,
          textColor: parsedText,
          headerBackgroundColor: parsedHeaderBackground,
          headerForegroundColor: parsedHeaderForeground,
          headerNavItems: safeHeaderNavItems,
          footerNavItems: safeFooterNavItems,
          showFooterBackToTop,
          showFooterOwnerLogin,
          homeShowHero,
          homeShowContentBlocks,
          homeShowFeaturedProducts,
          homeFeaturedProductsLimit: parsedHomeFeaturedProductsLimit,
          productsFilterLayout,
          productsFiltersDefaultOpen,
          productsShowSearch,
          productsShowSort,
          productsShowAvailability,
          productsShowOptionFilters,
          productCardShowDescription,
          productCardDescriptionLines: parsedProductCardDescriptionLines,
          productCardShowFeaturedBadge,
          productCardShowAvailability,
          productCardShowQuickAdd,
          productCardImageHoverZoom,
          productCardShowCarouselArrows,
          productCardShowCarouselDots,
          productCardImageFit,
          primaryCtaStyle
        }
      })
    });

    const payload = (await response.json()) as BrandingResponse;

    if (!response.ok || !payload.branding) {
      setError(payload.error ?? "Unable to save branding settings.");
      return;
    }

    setBaseline(snapshot);
    setMessage("Branding settings saved.");
  }

  return (
    <form id="branding-form" onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="Color System">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Primary">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(primaryColor) ?? "#0F7B84"} onChange={(event) => setPrimaryColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} placeholder="#0F7B84" />
            </div>
          </FormField>
          <FormField label="Primary Foreground">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(primaryForegroundColor) ?? "#FFFFFF"} onChange={(event) => setPrimaryForegroundColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={primaryForegroundColor} onChange={(event) => setPrimaryForegroundColor(event.target.value)} placeholder="#FFFFFF" />
            </div>
          </FormField>
          <FormField label="Accent">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(accentColor) ?? "#1AA3A8"} onChange={(event) => setAccentColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} placeholder="#1AA3A8" />
            </div>
          </FormField>
          <FormField label="Accent Foreground">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(accentForegroundColor) ?? "#FFFFFF"} onChange={(event) => setAccentForegroundColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={accentForegroundColor} onChange={(event) => setAccentForegroundColor(event.target.value)} placeholder="#FFFFFF" />
            </div>
          </FormField>
          <FormField label="Background">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(backgroundColor) ?? "#F5FBFB"} onChange={(event) => setBackgroundColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} placeholder="#F5FBFB" />
            </div>
          </FormField>
          <FormField label="Surface">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(surfaceColor) ?? "#FFFFFF"} onChange={(event) => setSurfaceColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={surfaceColor} onChange={(event) => setSurfaceColor(event.target.value)} placeholder="#FFFFFF" />
            </div>
          </FormField>
          <FormField label="Text">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(textColor) ?? "#143435"} onChange={(event) => setTextColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={textColor} onChange={(event) => setTextColor(event.target.value)} placeholder="#143435" />
            </div>
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Global Layout">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Page Width">
            <Select value={pageWidth} onChange={(event) => setPageWidth(event.target.value as typeof pageWidth)}>
              <option value="narrow">Narrow</option>
              <option value="standard">Standard</option>
              <option value="wide">Wide</option>
            </Select>
          </FormField>
          <FormField label="Font Style">
            <Select value={fontPreset} onChange={(event) => setFontPreset(event.target.value as typeof fontPreset)}>
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="clean">Clean</option>
            </Select>
          </FormField>
          <FormField label="Corner Radius">
            <Select value={radiusScale} onChange={(event) => setRadiusScale(event.target.value as typeof radiusScale)}>
              <option value="soft">Soft</option>
              <option value="rounded">Rounded</option>
              <option value="sharp">Sharp</option>
            </Select>
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Home Page">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={showPolicyStrip} onChange={(event) => setShowPolicyStrip(event.target.checked)} />Show policy strip and announcement bar</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={showContentBlocks} onChange={(event) => setShowContentBlocks(event.target.checked)} />Show content blocks section</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={homeShowHero} onChange={(event) => setHomeShowHero(event.target.checked)} />Show home hero section</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={homeShowContentBlocks} onChange={(event) => setHomeShowContentBlocks(event.target.checked)} />Show home content blocks row</label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={homeShowFeaturedProducts} onChange={(event) => setHomeShowFeaturedProducts(event.target.checked)} />Show featured products on home</label>
        </div>
        <FormField label="Featured Products Limit">
          <Input type="number" min={1} max={24} value={homeFeaturedProductsLimit} onChange={(event) => setHomeFeaturedProductsLimit(event.target.value)} placeholder="6" />
        </FormField>
      </SectionCard>

      <SectionCard title="Products Page">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Product Grid Columns">
            <Select value={productGridColumns} onChange={(event) => setProductGridColumns(event.target.value)}>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </Select>
          </FormField>
          <FormField label="Filter Layout">
            <Select value={productsFilterLayout} onChange={(event) => setProductsFilterLayout(event.target.value as FilterLayout)}>
              <option value="sidebar">Sidebar</option>
              <option value="topbar">Top bar</option>
            </Select>
          </FormField>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productsFiltersDefaultOpen} onChange={(event) => setProductsFiltersDefaultOpen(event.target.checked)} />Open filters by default</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productsShowSearch} onChange={(event) => setProductsShowSearch(event.target.checked)} />Show products search field</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productsShowSort} onChange={(event) => setProductsShowSort(event.target.checked)} />Show products sort control</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productsShowAvailability} onChange={(event) => setProductsShowAvailability(event.target.checked)} />Show availability filter</label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={productsShowOptionFilters} onChange={(event) => setProductsShowOptionFilters(event.target.checked)} />Show option filters</label>
        </div>
      </SectionCard>

      <SectionCard title="Product Cards & CTA">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Primary CTA Style">
            <Select value={primaryCtaStyle} onChange={(event) => setPrimaryCtaStyle(event.target.value as CtaStyle)}>
              <option value="primary">Primary</option>
              <option value="accent">Accent</option>
              <option value="outline">Outline</option>
            </Select>
          </FormField>
          <FormField label="Product Image Fit">
            <Select value={productCardImageFit} onChange={(event) => setProductCardImageFit(event.target.value as ImageFit)}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </Select>
          </FormField>
          <FormField label="Card Description Lines">
            <Input type="number" min={1} max={4} value={productCardDescriptionLines} onChange={(event) => setProductCardDescriptionLines(event.target.value)} placeholder="2" />
          </FormField>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productCardShowDescription} onChange={(event) => setProductCardShowDescription(event.target.checked)} />Show card descriptions</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productCardShowFeaturedBadge} onChange={(event) => setProductCardShowFeaturedBadge(event.target.checked)} />Show featured badge on cards</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productCardShowAvailability} onChange={(event) => setProductCardShowAvailability(event.target.checked)} />Show card availability text</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productCardShowQuickAdd} onChange={(event) => setProductCardShowQuickAdd(event.target.checked)} />Show quick add button on cards</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productCardImageHoverZoom} onChange={(event) => setProductCardImageHoverZoom(event.target.checked)} />Enable image hover zoom</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={productCardShowCarouselArrows} onChange={(event) => setProductCardShowCarouselArrows(event.target.checked)} />Show card carousel arrows</label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={productCardShowCarouselDots} onChange={(event) => setProductCardShowCarouselDots(event.target.checked)} />Show card carousel dots</label>
        </div>
      </SectionCard>

      <SectionCard title="Header">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Header Background">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(headerBackgroundColor) ?? "#FFFFFF"} onChange={(event) => setHeaderBackgroundColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={headerBackgroundColor} onChange={(event) => setHeaderBackgroundColor(event.target.value)} placeholder="#FFFFFF" />
            </div>
          </FormField>
          <FormField label="Header Foreground">
            <div className="flex items-center gap-2">
              <Input type="color" value={normalizeHex(headerForegroundColor) ?? "#143435"} onChange={(event) => setHeaderForegroundColor(event.target.value)} className="h-10 w-14 p-1" />
              <Input type="text" value={headerForegroundColor} onChange={(event) => setHeaderForegroundColor(event.target.value)} placeholder="#143435" />
            </div>
          </FormField>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Header links</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {HEADER_NAV_OPTIONS.map((option) => (
              <label key={`header-${option.id}`} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={headerNavItems.includes(option.id)}
                  onChange={(event) =>
                    setHeaderNavItems((current) => {
                      if (event.target.checked) {
                        return current.includes(option.id) ? current : [...current, option.id];
                      }
                      const next = current.filter((entry) => entry !== option.id);
                      return next.length > 0 ? next : current;
                    })
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Footer">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={showFooterBackToTop} onChange={(event) => setShowFooterBackToTop(event.target.checked)} />Show footer “Back to top”</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={showFooterOwnerLogin} onChange={(event) => setShowFooterOwnerLogin(event.target.checked)} />Show footer “Owner login”</label>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Footer links</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FOOTER_NAV_OPTIONS.map((option) => (
              <label key={`footer-${option.id}`} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={footerNavItems.includes(option.id)}
                  onChange={(event) =>
                    setFooterNavItems((current) => {
                      if (event.target.checked) {
                        return current.includes(option.id) ? current : [...current, option.id];
                      }
                      const next = current.filter((entry) => entry !== option.id);
                      return next.length > 0 ? next : current;
                    })
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      <FeedbackMessage type="error" message={error} />
      <FeedbackMessage type="success" message={message} />
    </form>
  );
}
