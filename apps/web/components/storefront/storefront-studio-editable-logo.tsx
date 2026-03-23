"use client";

import Image from "next/image";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useRef } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";
import type { HeaderLogoSize, HeaderTitleSize } from "@/lib/theme/storefront-theme";
import { cn } from "@/lib/utils";
import { StorefrontStudioEditableStoreName } from "@/components/storefront/storefront-studio-editable-store-name";

type LogoUploadResponse = {
  logoPath?: string;
  error?: string;
};

type StorefrontStudioEditableLogoProps = {
  href: string;
  logoPath?: string | null;
  storeName: string;
  showLogo: boolean;
  showTitle: boolean;
  logoSize: HeaderLogoSize;
  titleSize: HeaderTitleSize;
  buttonRadiusClass: string;
  compact: boolean;
  onNavigateHref?: ((href: string) => void) | null;
};

export function StorefrontStudioEditableLogo({
  href,
  logoPath,
  storeName,
  showLogo,
  showTitle,
  logoSize,
  titleSize,
  buttonRadiusClass,
  compact,
  onNavigateHref = null
}: StorefrontStudioEditableLogoProps) {
  const document = useOptionalStorefrontStudioDocument();
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function uploadLogo(file: File) {
    if (!document) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/branding/logo", document.storeSlug), {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as LogoUploadResponse;

      if (!response.ok || !payload.logoPath) {
        throw new Error(payload.error ?? "Unable to upload logo.");
      }

      document.setBrandingDraft((current) => ({
        ...(current ?? {
          logo_path: null,
          favicon_path: null,
          apple_touch_icon_path: null,
          og_image_path: null,
          twitter_image_path: null,
          primary_color: null,
          accent_color: null,
          theme_json: {}
        }),
        logo_path: payload.logoPath ?? null
      }));
      notify.success("Logo uploaded. Changes save automatically.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to upload logo.");
    }
  }

  const canRenderLogo = Boolean(showLogo && logoPath);
  const canRenderTitle = showTitle || !canRenderLogo;
  const logoSizeClass = compact
    ? logoSize === "small"
      ? "max-h-10 max-w-[34vw] sm:max-w-[220px]"
      : logoSize === "large"
        ? "max-h-14 max-w-[48vw] sm:max-w-[320px]"
        : "max-h-12 max-w-[40vw] sm:max-w-[260px]"
    : logoSize === "small"
      ? "max-h-16 max-w-[46vw] sm:max-h-24 sm:max-w-[420px]"
      : logoSize === "large"
        ? "max-h-24 max-w-[60vw] sm:max-h-40 sm:max-w-[640px]"
        : "max-h-20 max-w-[54vw] sm:max-h-32 sm:max-w-[540px]";
  const titleSizeClass = compact
    ? titleSize === "small"
      ? "text-xs"
      : titleSize === "large"
        ? "text-base"
        : "text-sm"
    : titleSize === "small"
      ? "text-base sm:text-lg"
      : titleSize === "large"
        ? "text-xl sm:text-3xl"
        : "text-lg sm:text-2xl";

  return (
    <div className="w-fit">
      <Link
        href={href}
        className="inline-flex items-center gap-3"
        onClick={(event) => {
          if (!onNavigateHref) {
            return;
          }

          event.preventDefault();
          onNavigateHref(event.currentTarget.href);
        }}
      >
        {showLogo ? (
          <span className="group/logo relative inline-flex w-fit shrink-0 self-start">
            {canRenderLogo ? (
              <Image
                src={logoPath!}
                alt={`${storeName} logo`}
                width={800}
                height={320}
                loading="eager"
                unoptimized
                style={{ width: "auto", height: "auto" }}
                className={cn(
                  "object-contain transition-all duration-200",
                  buttonRadiusClass,
                  logoSizeClass
                )}
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center bg-muted text-xs font-semibold transition-all duration-200",
                  buttonRadiusClass,
                  compact ? "h-9 w-9" : "h-14 w-14 sm:h-24 sm:w-24"
                )}
              >
                {storeName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {document ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-1.5 top-1.5 z-20 h-8 w-8 rounded-full border border-border/70 bg-white/95 opacity-0 shadow-sm transition group-hover/logo:opacity-100"
                aria-label="Replace logo"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </span>
        ) : null}
        {canRenderTitle ? (
          <StorefrontStudioEditableStoreName
            value={storeName}
            as="span"
            displayClassName={cn("font-medium transition-all duration-200", titleSizeClass)}
            editorClassName={cn("bg-white/95 shadow-sm", compact ? "h-10 min-h-0" : "min-h-[3.25rem]", titleSizeClass)}
            buttonClassName="border-slate-900/10 bg-white/95 text-slate-700"
          />
        ) : null}
      </Link>
      {document ? (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file) {
                void uploadLogo(file);
              }
              event.target.value = "";
            }}
          />
        </>
      ) : null}
    </div>
  );
}
