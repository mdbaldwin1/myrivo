"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { notify } from "@/lib/feedback/toast";
import {
  resolveStorefrontThemeConfig,
  type CtaStyle,
  type FooterItemId,
  type NavItemId
} from "@/lib/theme/storefront-theme";
import type { StoreBrandingRecord } from "@/types/database";

type BrandingSettingsFormProps = {
  initialBranding: Pick<
    StoreBrandingRecord,
    "primary_color" | "accent_color" | "theme_json" | "favicon_path" | "apple_touch_icon_path" | "og_image_path" | "twitter_image_path"
  > | null;
  header?: ReactNode;
};

type BrandingResponse = {
  branding?: Pick<
    StoreBrandingRecord,
    "primary_color" | "accent_color" | "theme_json" | "favicon_path" | "apple_touch_icon_path" | "og_image_path" | "twitter_image_path"
  >;
  error?: string;
};

type AssetType = "favicon" | "apple_touch_icon" | "og_image" | "twitter_image";
type AssetUploadResponse = {
  assetType?: AssetType;
  assetPath?: string;
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

const DEFAULT_ACTION_FOREGROUND = "#FFFFFF";

export function BrandingSettingsForm({ initialBranding, header }: BrandingSettingsFormProps) {
  const formId = "branding-form";
  const initialTheme = resolveStorefrontThemeConfig(initialBranding?.theme_json ?? {});

  const [primaryColor, setPrimaryColor] = useState(initialBranding?.primary_color ?? "#0F7B84");
  const [accentColor, setAccentColor] = useState(initialBranding?.accent_color ?? "#1AA3A8");
  const [primaryForegroundColor, setPrimaryForegroundColor] = useState(
    initialTheme.primaryForegroundColor ?? DEFAULT_ACTION_FOREGROUND
  );
  const [accentForegroundColor, setAccentForegroundColor] = useState(
    initialTheme.accentForegroundColor ?? DEFAULT_ACTION_FOREGROUND
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

  const [primaryCtaStyle, setPrimaryCtaStyle] = useState<CtaStyle>(initialTheme.primaryCtaStyle);
  const [faviconPath, setFaviconPath] = useState(initialBranding?.favicon_path ?? "");
  const [appleTouchIconPath, setAppleTouchIconPath] = useState(initialBranding?.apple_touch_icon_path ?? "");
  const [ogImagePath, setOgImagePath] = useState(initialBranding?.og_image_path ?? "");
  const [twitterImagePath, setTwitterImagePath] = useState(initialBranding?.twitter_image_path ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<AssetType | null>(null);

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
        primaryCtaStyle,
        faviconPath,
        appleTouchIconPath,
        ogImagePath,
        twitterImagePath
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
      primaryCtaStyle,
      faviconPath,
      appleTouchIconPath,
      ogImagePath,
      twitterImagePath
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
      setPrimaryCtaStyle((parsed.primaryCtaStyle as CtaStyle) ?? primaryCtaStyle);
      setFaviconPath(String(parsed.faviconPath ?? faviconPath));
      setAppleTouchIconPath(String(parsed.appleTouchIconPath ?? appleTouchIconPath));
      setOgImagePath(String(parsed.ogImagePath ?? ogImagePath));
      setTwitterImagePath(String(parsed.twitterImagePath ?? twitterImagePath));
    } catch {
      // no-op
    }
    setError(null);
  }

  const isDirty = snapshot !== baseline;

  async function uploadAsset(type: AssetType, file: File) {
    setUploadingAsset(type);
    setError(null);

    const formData = new FormData();
    formData.append("assetType", type);
    formData.append("file", file);

    const response = await fetch("/api/stores/branding/logo", {
      method: "POST",
      body: formData
    });

    const payload = (await response.json()) as AssetUploadResponse;
    if (!response.ok || !payload.assetPath) {
      setError(payload.error ?? "Unable to upload branding asset.");
      setUploadingAsset(null);
      return;
    }

    if (type === "favicon") setFaviconPath(payload.assetPath);
    if (type === "apple_touch_icon") setAppleTouchIconPath(payload.assetPath);
    if (type === "og_image") setOgImagePath(payload.assetPath);
    if (type === "twitter_image") setTwitterImagePath(payload.assetPath);

    notify.success("Branding asset uploaded.");
    setUploadingAsset(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      restoreBaseline();
      return;
    }

    setError(null);
    setSaving(true);

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
      setSaving(false);
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
        faviconPath: faviconPath.trim() || null,
        appleTouchIconPath: appleTouchIconPath.trim() || null,
        ogImagePath: ogImagePath.trim() || null,
        twitterImagePath: twitterImagePath.trim() || null,
        themeJson: {
          ...(initialBranding?.theme_json ?? {}),
          pageWidth,
          radiusScale,
          fontPreset,
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
          primaryCtaStyle
        }
      })
    });

    const payload = (await response.json()) as BrandingResponse;

    if (!response.ok || !payload.branding) {
      setError(payload.error ?? "Unable to save branding settings.");
      setSaving(false);
      return;
    }

    setBaseline(snapshot);
    notify.success("Branding settings saved.");
    setSaving(false);
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {header}
        <SectionCard title="Color System" description="Set your storefront color palette for brand consistency across UI surfaces.">
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

        <SectionCard title="White Label Assets" description="Configure browser icons and social preview images for your custom domain storefront.">
          <div className="space-y-3">
            <FormField
              label="Favicon URL"
              description="Shown in browser tabs and bookmarks. Recommended 64x64 PNG or ICO."
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input value={faviconPath} onChange={(event) => setFaviconPath(event.target.value)} placeholder="https://.../favicon.ico" />
                <Input
                  type="file"
                  className="max-w-[220px]"
                  accept=".ico,.png,.svg,image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file) {
                      void uploadAsset("favicon", file);
                    }
                    event.target.value = "";
                  }}
                  disabled={saving}
                />
              </div>
            </FormField>

            <FormField
              label="Apple Touch Icon URL"
              description="Used when users save your storefront to iPhone/iPad home screens. Recommended 180x180 PNG."
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={appleTouchIconPath}
                  onChange={(event) => setAppleTouchIconPath(event.target.value)}
                  placeholder="https://.../apple-touch-icon.png"
                />
                <Input
                  type="file"
                  className="max-w-[220px]"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file) {
                      void uploadAsset("apple_touch_icon", file);
                    }
                    event.target.value = "";
                  }}
                  disabled={saving}
                />
              </div>
            </FormField>

            <FormField
              label="Open Graph Image URL"
              description="Used by link previews (Facebook, Slack, Discord). Recommended 1200x630."
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input value={ogImagePath} onChange={(event) => setOgImagePath(event.target.value)} placeholder="https://.../og-image.png" />
                <Input
                  type="file"
                  className="max-w-[220px]"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file) {
                      void uploadAsset("og_image", file);
                    }
                    event.target.value = "";
                  }}
                  disabled={saving}
                />
              </div>
            </FormField>

            <FormField
              label="Twitter Image URL"
              description="Used by X/Twitter card previews. Recommended 1200x600 or 1200x630."
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={twitterImagePath}
                  onChange={(event) => setTwitterImagePath(event.target.value)}
                  placeholder="https://.../twitter-image.png"
                />
                <Input
                  type="file"
                  className="max-w-[220px]"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file) {
                      void uploadAsset("twitter_image", file);
                    }
                    event.target.value = "";
                  }}
                  disabled={saving}
                />
              </div>
            </FormField>
            {uploadingAsset ? <p className="text-xs text-muted-foreground">Uploading asset...</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Global Layout" description="Control storefront width, typography preset, and overall corner style.">
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

        <SectionCard title="Call To Action" description="Choose the default visual treatment for primary action buttons.">
          <FormField label="Primary CTA Style" description="Global default style for primary storefront actions.">
            <Select value={primaryCtaStyle} onChange={(event) => setPrimaryCtaStyle(event.target.value as CtaStyle)}>
              <option value="primary">Primary</option>
              <option value="accent">Accent</option>
              <option value="outline">Outline</option>
            </Select>
          </FormField>
        </SectionCard>

        <SectionCard title="Header" description="Configure header colors and which navigation links appear at the top of your storefront.">
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

        <SectionCard title="Footer" description="Configure footer links and utility actions shown at the bottom of storefront pages.">
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
      </div>

      <DashboardFormActionBar
        formId={formId}
        saveLabel="Save branding"
        savePendingLabel="Saving..."
        savePending={saving || uploadingAsset !== null}
        discardLabel="Discard changes"
        saveDisabled={!isDirty || saving || uploadingAsset !== null}
        discardDisabled={!isDirty || saving || uploadingAsset !== null}
        statusMessage={error}
        statusVariant="error"
      />
    </form>
  );
}
