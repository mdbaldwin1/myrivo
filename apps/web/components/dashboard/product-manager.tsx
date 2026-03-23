"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Plus, RotateCcw, Search, Star, X } from "lucide-react";
import { AppAlert } from "@/components/ui/app-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Flyout } from "@/components/ui/flyout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createBlankVariant,
  hasStructuredVariants,
  normalizeTierDisplayLabel,
  resolvePriceRange,
  resolveTierNamesForProduct,
  sortVariants,
  statusOptions,
  type OptionPairDraft,
  type ProductListItem,
  type ProductVariantListItem,
  type VariantDraft,
  variantStatusOptions
} from "@/components/dashboard/product-manager-domain";
import { shouldOpenCatalogProductFromUrl } from "@/lib/dashboard/catalog-url-sync";
import { formatVariantLabel } from "@/lib/products/variants";
import { richTextToPlainText } from "@/lib/rich-text";
import { notify } from "@/lib/feedback/toast";
import { ProductRecord } from "@/types/database";

export type { ProductListItem } from "@/components/dashboard/product-manager-domain";

type ProductManagerProps = {
  initialProducts: ProductListItem[];
};

type ProductResponse = {
  product?: ProductListItem;
  products?: ProductListItem[];
  error?: string;
  success?: boolean;
};

type VariantRemovalCheckResponse = {
  ok?: boolean;
  error?: string;
  blockedVariantIds?: string[];
};

type ImageUploadResponse = {
  imageUrl?: string;
  error?: string;
};

type InventoryAdjustResponse = {
  product?: ProductListItem;
  error?: string;
};

function buildSkuFromParts(base: string, parts: string[]) {
  const normalizedBase = base.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const normalizedParts = parts.map((part) =>
    part
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  );

  return [normalizedBase || "SKU", ...normalizedParts.filter(Boolean)].join("-");
}

function getVariantOptionValueParts(variant: VariantDraft) {
  return variant.optionPairs
    .map((pair) => {
      const name = pair.name.trim();
      const value = pair.value.trim();
      if (!name || !value) {
        return "";
      }
      return value;
    })
    .filter((value) => value.length > 0);
}

function buildDefaultVariantSku(variant: VariantDraft, skuBase: string, fallbackIndex: number) {
  const optionParts = getVariantOptionValueParts(variant);
  return buildSkuFromParts(skuBase, optionParts.length > 0 ? optionParts : [String(fallbackIndex + 1)]);
}

function normalizeVariantDefaults(variants: VariantDraft[]): VariantDraft[] {
  if (variants.length === 0) {
    return [createBlankVariant(true)];
  }

  const firstDefaultIndex = variants.findIndex((variant) => variant.isDefault);
  const defaultIndex = firstDefaultIndex === -1 ? 0 : firstDefaultIndex;

  return variants.map((variant, index) => ({
    ...variant,
    isDefault: index === defaultIndex
  }));
}

function cloneVariantDrafts(variants: VariantDraft[]): VariantDraft[] {
  return variants.map((variant) => ({
    ...variant,
    optionPairs: variant.optionPairs.map((pair) => ({ ...pair }))
  }));
}

function hasStructuredVariantDrafts(variants: VariantDraft[]) {
  return (
    variants.length > 1 ||
    variants.some((variant) =>
      variant.optionPairs.some((pair) => pair.name.trim().length > 0 || pair.value.trim().length > 0)
    )
  );
}

function getOptionValue(variant: VariantDraft, optionName: string) {
  const normalizedName = optionName.trim().toLowerCase();
  if (!normalizedName) {
    return "";
  }

  const pair = variant.optionPairs.find((item) => item.name.trim().toLowerCase() === normalizedName);
  return pair?.value ?? "";
}

function setOptionValue(variant: VariantDraft, optionName: string, optionValue: string) {
  const normalizedName = optionName.trim();
  if (!normalizedName) {
    return variant;
  }

  const lookup = normalizedName.toLowerCase();
  const existingIndex = variant.optionPairs.findIndex((item) => item.name.trim().toLowerCase() === lookup);

  if (existingIndex === -1) {
    return {
      ...variant,
      optionPairs: [...variant.optionPairs, { name: normalizedName, value: optionValue }]
    };
  }

  return {
    ...variant,
    optionPairs: variant.optionPairs.map((item, index) =>
      index === existingIndex ? { ...item, name: normalizedName, value: optionValue } : item
    )
  };
}

function renameOptionName(variant: VariantDraft, oldName: string, nextName: string) {
  const normalizedOld = oldName.trim().toLowerCase();
  const normalizedNext = nextName.trim();

  if (!normalizedOld || !normalizedNext) {
    return variant;
  }

  const renamedPairs = variant.optionPairs.map((pair) =>
    pair.name.trim().toLowerCase() === normalizedOld ? { ...pair, name: normalizedNext } : pair
  );

  const dedupedPairs: OptionPairDraft[] = [];
  const seen = new Set<string>();
  for (const pair of renamedPairs) {
    const key = pair.name.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    dedupedPairs.push(pair);
  }

  return {
    ...variant,
    optionPairs: dedupedPairs
  };
}

function removeOptionName(variant: VariantDraft, optionName: string) {
  const normalized = optionName.trim().toLowerCase();
  if (!normalized) {
    return variant;
  }
  return {
    ...variant,
    optionPairs: variant.optionPairs.filter((pair) => pair.name.trim().toLowerCase() !== normalized)
  };
}

function pickPrimaryVariant(variants: VariantDraft[]) {
  return variants.find((variant) => variant.isDefault) ?? variants[0] ?? createBlankVariant(true);
}

function productVariantsForEditing(product: ProductListItem, tierNames: string[] = []): VariantDraft[] {
  if (!product.product_variants || product.product_variants.length === 0) {
    return [
      {
        title: "",
        sku: product.sku ?? "",
        skuMode: "auto",
        imageUrls: [],
        groupImageUrls: [],
        priceDollars: (product.price_cents / 100).toFixed(2),
        inventoryQty: String(product.inventory_qty),
        isMadeToOrder: false,
        optionPairs: [],
        status: "active",
        isDefault: true
      }
    ];
  }

  const normalizedTierNames = tierNames.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0);

  return [...product.product_variants]
    .sort((left, right) => {
      if (left.sort_order === right.sort_order) {
        return left.created_at.localeCompare(right.created_at);
      }
      return left.sort_order - right.sort_order;
    })
    .map((variant) => {
      const rawPairs = Object.entries(variant.option_values ?? {}).map(([name, value]) => ({ name, value }));
      const orderedPairs =
        normalizedTierNames.length === 0
          ? rawPairs
          : [...rawPairs].sort((left, right) => {
              const leftIndex = normalizedTierNames.indexOf(left.name.trim().toLowerCase());
              const rightIndex = normalizedTierNames.indexOf(right.name.trim().toLowerCase());
              if (leftIndex === -1 && rightIndex === -1) return 0;
              if (leftIndex === -1) return 1;
              if (rightIndex === -1) return -1;
              return leftIndex - rightIndex;
            });

      return {
        id: variant.id,
        title: variant.title ?? "",
        sku: variant.sku ?? "",
        skuMode: variant.sku_mode ?? "manual",
        imageUrls: variant.image_urls ?? [],
        groupImageUrls: variant.group_image_urls ?? [],
        priceDollars: (variant.price_cents / 100).toFixed(2),
        inventoryQty: String(variant.inventory_qty),
        isMadeToOrder: variant.is_made_to_order ?? false,
        optionPairs: orderedPairs,
        status: variant.status,
        isDefault: variant.is_default
      };
    });
}

function parseVariantsFromDrafts(
  drafts: VariantDraft[],
  skuBase: string,
  options?: { strictValidation?: boolean; lockedSkuVariantIds?: Set<string> }
): { variants: Array<Record<string, unknown>> } | { error: string } {
  const strictValidation = options?.strictValidation ?? true;
  const lockedSkuVariantIds = options?.lockedSkuVariantIds ?? new Set<string>();

  if (drafts.length === 0) {
    return { variants: [] };
  }

  const normalizedDrafts = drafts.map((variant, index) => ({ ...variant, isDefault: variant.isDefault || index === 0 }));
  const seenSignatures = new Set<string>();
  const seenSkus = new Set<string>();
  const hasStructuredOptions = normalizedDrafts.some((variant) =>
    variant.optionPairs.some((pair) => pair.name.trim().length > 0 && pair.value.trim().length > 0)
  );

  let hasDefault = false;

  const variants = normalizedDrafts.map((variant, index) => {
    const price = Number(variant.priceDollars);
    const inventory = Number(variant.inventoryQty);

    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(inventory) || inventory < 0) {
      throw new Error("Variant price and inventory must be non-negative numbers.");
    }

    const optionValues = variant.optionPairs.reduce<Record<string, string>>((accumulator, pair) => {
      const key = pair.name.trim();
      const value = pair.value.trim();

      if (!key || !value) {
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    }, {});

    if (strictValidation && hasStructuredOptions && normalizedDrafts.length > 1 && Object.keys(optionValues).length === 0) {
      throw new Error("Each variant must include option values when multiple variants exist.");
    }

    const signature = JSON.stringify(Object.entries(optionValues).sort(([left], [right]) => left.localeCompare(right)));
    if (strictValidation && hasStructuredOptions && seenSignatures.has(signature)) {
      throw new Error("Duplicate variant option combinations detected.");
    }
    if (hasStructuredOptions) {
      seenSignatures.add(signature);
    }

    const providedSku = variant.sku.trim();
    const fallbackParts = getVariantOptionValueParts(variant);
    const generatedSku = buildSkuFromParts(skuBase, fallbackParts.length > 0 ? fallbackParts : [String(index + 1)]);
    const isLockedSkuVariant = variant.id ? lockedSkuVariantIds.has(variant.id) : false;
    const resolvedSku =
      variant.skuMode === "manual"
        ? providedSku || generatedSku
        : isLockedSkuVariant
          ? providedSku || generatedSku
          : generatedSku;
    const normalizedSku = resolvedSku.toLowerCase();
    if (strictValidation && seenSkus.has(normalizedSku)) {
      throw new Error(`Duplicate variant SKU detected: ${resolvedSku}`);
    }
    seenSkus.add(normalizedSku);

    const isDefault = variant.isDefault || (!hasDefault && index === 0);
    if (isDefault) {
      hasDefault = true;
    }

    return {
      id: variant.id,
      title: variant.title.trim() || null,
      sku: resolvedSku,
      skuMode: variant.skuMode,
      imageUrls: variant.imageUrls,
      groupImageUrls: variant.groupImageUrls,
      priceCents: Math.round(price * 100),
      inventoryQty: Math.trunc(inventory),
      isMadeToOrder: variant.isMadeToOrder,
      optionValues,
      status: variant.status,
      isDefault,
      sortOrder: index
    };
  });

  return { variants };
}

type ParsedVariantSubmission = {
  id?: string;
  title: string | null;
  sku: string;
  skuMode: "auto" | "manual";
  imageUrls: string[];
  groupImageUrls: string[];
  priceCents: number;
  inventoryQty: number;
  isMadeToOrder: boolean;
  optionValues: Record<string, string>;
  status: "active" | "archived";
  isDefault: boolean;
  sortOrder: number;
};

type NestedVariantOptionSubmission = {
  id?: string;
  optionValue: string;
  sku: string;
  skuMode: "auto" | "manual";
  imageUrls: string[];
  priceCents: number;
  inventoryQty: number;
  isMadeToOrder: boolean;
  status: "active" | "archived";
  isDefault: boolean;
  sortOrder: number;
};

type NestedVariantSubmission = {
  id?: string;
  optionValue: string;
  sku: string;
  skuMode: "auto" | "manual";
  imageUrls: string[];
  priceCents: number;
  inventoryQty: number;
  isMadeToOrder: boolean;
  status: "active" | "archived";
  isDefault: boolean;
  sortOrder: number;
  options: NestedVariantOptionSubmission[];
};

function buildNestedVariantsFromParsed(
  variants: ParsedVariantSubmission[],
  hasVariants: boolean,
  tierCount: 1 | 2,
  tierLabels: string[]
) {
  const sorted = [...variants].sort((left, right) => left.sortOrder - right.sortOrder);

  if (!hasVariants) {
    const only = sorted.find((variant) => variant.isDefault) ?? sorted[0];
    if (!only) {
      return [] as NestedVariantSubmission[];
    }
    return [
      {
        id: only.id,
        optionValue: "",
        sku: only.sku,
        skuMode: only.skuMode,
        imageUrls: only.imageUrls,
        priceCents: only.priceCents,
        inventoryQty: only.inventoryQty,
        isMadeToOrder: only.isMadeToOrder,
        status: only.status,
        isDefault: true,
        sortOrder: 0,
        options: []
      }
    ];
  }

  const tierOneName = tierLabels[0]?.trim() || "Option 1";
  const tierTwoName = tierLabels[1]?.trim() || "Option 2";

  if (tierCount === 1) {
    return sorted.map((variant, index) => ({
      id: variant.id,
      optionValue: variant.optionValues[tierOneName] ?? `${tierOneName} ${index + 1}`,
      sku: variant.sku,
      skuMode: variant.skuMode,
      imageUrls: variant.imageUrls.length > 0 ? variant.imageUrls : variant.groupImageUrls,
      priceCents: variant.priceCents,
      inventoryQty: variant.inventoryQty,
      isMadeToOrder: variant.isMadeToOrder,
      status: variant.status,
      isDefault: variant.isDefault,
      sortOrder: variant.sortOrder,
      options: []
    }));
  }

  const grouped = new Map<string, NestedVariantSubmission>();
  const orderedKeys: string[] = [];

  sorted.forEach((variant, index) => {
    const levelOneValue = variant.optionValues[tierOneName] ?? `${tierOneName} ${index + 1}`;
    const key = levelOneValue.trim().toLowerCase();

    if (!grouped.has(key)) {
      grouped.set(key, {
        optionValue: levelOneValue,
        sku: "",
        skuMode: "auto",
        imageUrls: variant.groupImageUrls,
        priceCents: variant.priceCents,
        inventoryQty: variant.inventoryQty,
        isMadeToOrder: variant.isMadeToOrder,
        status: variant.status,
        isDefault: false,
        sortOrder: orderedKeys.length,
        options: []
      });
      orderedKeys.push(key);
    }

    const group = grouped.get(key)!;
    const levelTwoValue = variant.optionValues[tierTwoName] ?? `${tierTwoName} ${group.options.length + 1}`;
      group.options.push({
        id: variant.id,
        optionValue: levelTwoValue,
        sku: variant.sku,
        skuMode: variant.skuMode,
        imageUrls: variant.imageUrls,
      priceCents: variant.priceCents,
      inventoryQty: variant.inventoryQty,
      isMadeToOrder: variant.isMadeToOrder,
      status: variant.status,
      isDefault: variant.isDefault,
      sortOrder: group.options.length
    });
    if (variant.isDefault) {
      group.isDefault = true;
    }
  });

  return orderedKeys.map((key, index) => {
    const group = grouped.get(key)!;
    return {
      ...group,
      sortOrder: index
    };
  });
}

export function ProductManager({ initialProducts }: ProductManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProductRecord["status"]>("all");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [imageAltText, setImageAltText] = useState("");
  const [sku, setSku] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [createImageUrls, setCreateImageUrls] = useState<string[]>([]);
  const [createDraggingImageIndex, setCreateDraggingImageIndex] = useState<number | null>(null);
  const [createVariants, setCreateVariants] = useState<VariantDraft[]>([createBlankVariant(true)]);
  const [createHasVariants, setCreateHasVariants] = useState(false);
  const [createVariantTierCount, setCreateVariantTierCount] = useState<1 | 2>(1);
  const [createFlowStep, setCreateFlowStep] = useState<"product" | "variant" | "option">("product");
  const [createStepDirection, setCreateStepDirection] = useState<"forward" | "backward">("forward");
  const [createStepMotionKey, setCreateStepMotionKey] = useState(0);
  const [createActiveVariantIndex, setCreateActiveVariantIndex] = useState<number | null>(null);
  const [createVariantSnapshot, setCreateVariantSnapshot] = useState<VariantDraft[] | null>(null);
  const [createOptionSnapshot, setCreateOptionSnapshot] = useState<VariantDraft[] | null>(null);
  const [createOptionOneName, setCreateOptionOneName] = useState("");
  const [createOptionTwoName, setCreateOptionTwoName] = useState("");
  const [createSingleSkuMode, setCreateSingleSkuMode] = useState<"auto" | "manual">("auto");
  const [createSinglePriceDollars, setCreateSinglePriceDollars] = useState("0.00");
  const [createSingleInventoryQty, setCreateSingleInventoryQty] = useState("0");
  const [createSingleMadeToOrder, setCreateSingleMadeToOrder] = useState(false);
  const [createVariantsSnapshotByMode, setCreateVariantsSnapshotByMode] = useState<VariantDraft[] | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [deletePendingProductId, setDeletePendingProductId] = useState<string | null>(null);

  function updateProductUrl(productId: string | null) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (productId) {
      nextParams.set("productId", productId);
    } else {
      nextParams.delete("productId");
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProductSlug, setEditProductSlug] = useState("");
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editSeoDescription, setEditSeoDescription] = useState("");
  const [editImageAltText, setEditImageAltText] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editStatus, setEditStatus] = useState<ProductRecord["status"]>("draft");
  const [editIsFeatured, setEditIsFeatured] = useState(false);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [editDraggingImageIndex, setEditDraggingImageIndex] = useState<number | null>(null);
  const [editVariants, setEditVariants] = useState<VariantDraft[]>([createBlankVariant(true)]);
  const [editHasVariants, setEditHasVariants] = useState(false);
  const [editVariantTierCount, setEditVariantTierCount] = useState<1 | 2>(1);
  const [editFlowStep, setEditFlowStep] = useState<"product" | "variant" | "option">("product");
  const [editStepDirection, setEditStepDirection] = useState<"forward" | "backward">("forward");
  const [editStepMotionKey, setEditStepMotionKey] = useState(0);
  const [editActiveVariantIndex, setEditActiveVariantIndex] = useState<number | null>(null);
  const [editVariantSnapshot, setEditVariantSnapshot] = useState<VariantDraft[] | null>(null);
  const [editOptionSnapshot, setEditOptionSnapshot] = useState<VariantDraft[] | null>(null);
  const [editOptionOneName, setEditOptionOneName] = useState("");
  const [editOptionTwoName, setEditOptionTwoName] = useState("");
  const [editSingleInventoryQty, setEditSingleInventoryQty] = useState("0");
  const [editSingleMadeToOrder, setEditSingleMadeToOrder] = useState(false);
  const [editVariantsSnapshotByMode, setEditVariantsSnapshotByMode] = useState<VariantDraft[] | null>(null);
  const [editOrderedVariantIds, setEditOrderedVariantIds] = useState<Set<string>>(new Set());
  const [editPending, setEditPending] = useState(false);

  const [isCreateFlyoutOpen, setIsCreateFlyoutOpen] = useState(false);
  const [isEditFlyoutOpen, setIsEditFlyoutOpen] = useState(false);
  const [createBaseline, setCreateBaseline] = useState("");
  const [editBaseline, setEditBaseline] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState("Confirm delete?");
  const [deleteConfirmDescription, setDeleteConfirmDescription] = useState("Are you sure you want to continue?");
  const [deleteConfirmLabel, setDeleteConfirmLabel] = useState("Delete");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(searchParams.get("productId") ?? initialProducts[0]?.id ?? null);
  const [catalogInspectorTab, setCatalogInspectorTab] = useState<"overview" | "variants" | "inventory" | "media">("overview");
  const [variantInspectorMode, setVariantInspectorMode] = useState<"flat" | "grouped">("flat");
  const [inventoryAdjustDraft, setInventoryAdjustDraft] = useState<{
    productId: string;
    variantId: string;
    variantLabel: string;
    currentQty: number;
    delta: string;
    note: string;
  } | null>(null);
  const [inventoryAdjustError, setInventoryAdjustError] = useState<string | null>(null);
  const [inventoryAdjustPending, setInventoryAdjustPending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [createVariantError, setCreateVariantError] = useState<string | null>(null);
  const [editVariantError, setEditVariantError] = useState<string | null>(null);
  const deleteConfirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const createActivePanelRef = useRef<HTMLDivElement | null>(null);
  const editActivePanelRef = useRef<HTMLDivElement | null>(null);
  const wasCreateFlyoutOpenRef = useRef(false);
  const wasEditFlyoutOpenRef = useRef(false);
  const lastHandledProductIdFromUrlRef = useRef<string | null>(null);

  const currentCreateSnapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        description,
        productSlug,
        seoTitle,
        seoDescription,
        imageAltText,
        sku,
        isFeatured,
        createImageUrls,
        createVariants,
        createHasVariants,
        createVariantTierCount,
        createOptionOneName,
        createOptionTwoName,
        createSingleSkuMode,
        createSinglePriceDollars,
        createSingleInventoryQty,
        createSingleMadeToOrder
      }),
    [
      title,
      description,
      productSlug,
      seoTitle,
      seoDescription,
      imageAltText,
      sku,
      isFeatured,
      createImageUrls,
      createVariants,
      createHasVariants,
      createVariantTierCount,
      createOptionOneName,
      createOptionTwoName,
      createSingleSkuMode,
      createSinglePriceDollars,
      createSingleInventoryQty,
      createSingleMadeToOrder
    ]
  );

  const currentEditSnapshot = useMemo(
    () =>
      JSON.stringify({
        editingProductId,
        editTitle,
        editDescription,
        editProductSlug,
        editSeoTitle,
        editSeoDescription,
        editImageAltText,
        editSku,
        editStatus,
        editIsFeatured,
        editImageUrls,
        editVariants,
        editHasVariants,
        editVariantTierCount,
        editOptionOneName,
        editOptionTwoName,
        editSingleInventoryQty,
        editSingleMadeToOrder
      }),
    [
      editingProductId,
      editTitle,
      editDescription,
      editProductSlug,
      editSeoTitle,
      editSeoDescription,
      editImageAltText,
      editSku,
      editStatus,
      editIsFeatured,
      editImageUrls,
      editVariants,
      editHasVariants,
      editVariantTierCount,
      editOptionOneName,
      editOptionTwoName,
      editSingleInventoryQty,
      editSingleMadeToOrder
    ]
  );

  useEffect(() => {
    const wasOpen = wasCreateFlyoutOpenRef.current;
    if (isCreateFlyoutOpen && !wasOpen) {
      setCreateBaseline(currentCreateSnapshot);
    }
    if (!isCreateFlyoutOpen && wasOpen) {
      setCreateBaseline("");
    }
    wasCreateFlyoutOpenRef.current = isCreateFlyoutOpen;
  }, [isCreateFlyoutOpen, currentCreateSnapshot]);

  useEffect(() => {
    const wasOpen = wasEditFlyoutOpenRef.current;
    if (isEditFlyoutOpen && !wasOpen) {
      setEditBaseline(currentEditSnapshot);
    }
    if (!isEditFlyoutOpen && wasOpen) {
      setEditBaseline("");
    }
    wasEditFlyoutOpenRef.current = isEditFlyoutOpen;
  }, [isEditFlyoutOpen, currentEditSnapshot]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      if (statusFilter !== "all" && product.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        product.title.toLowerCase().includes(normalizedQuery) ||
        richTextToPlainText(product.description).toLowerCase().includes(normalizedQuery)
      );
    });
  }, [products, query, statusFilter]);

  const selectedProduct = useMemo(
    () => visibleProducts.find((product) => product.id === selectedProductId) ?? visibleProducts[0] ?? null,
    [selectedProductId, visibleProducts]
  );

  useEffect(() => {
    if (visibleProducts.length === 0) {
      if (selectedProductId !== null) {
        setSelectedProductId(null);
      }
      return;
    }

    if (!selectedProductId || !visibleProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(visibleProducts[0]?.id ?? null);
    }
  }, [selectedProductId, visibleProducts]);

  const openProductFromUrl = useEffectEvent((product: ProductListItem) => {
    openEditFlyout(product);
  });

  useEffect(() => {
    const productIdFromUrl = searchParams.get("productId");
    if (!productIdFromUrl) {
      lastHandledProductIdFromUrlRef.current = null;
      return;
    }

    const product = products.find((entry) => entry.id === productIdFromUrl);
    if (!product) {
      return;
    }

    if (selectedProductId !== product.id) {
      setSelectedProductId(product.id);
    }

    if (shouldOpenCatalogProductFromUrl(productIdFromUrl, lastHandledProductIdFromUrlRef.current)) {
      lastHandledProductIdFromUrlRef.current = productIdFromUrl;
      openProductFromUrl(product);
    }
  }, [products, searchParams, selectedProductId]);

  const flowStepOrder = { product: 0, variant: 1, option: 2 } as const;

  function transitionCreateStep(nextStep: "product" | "variant" | "option") {
    const nextIndex = flowStepOrder[nextStep];
    const currentIndex = flowStepOrder[createFlowStep];
    if (nextIndex === currentIndex) {
      return;
    }
    setCreateStepDirection(nextIndex >= currentIndex ? "forward" : "backward");
    setCreateFlowStep(nextStep);
    setCreateStepMotionKey((current) => current + 1);
  }

  function transitionEditStep(nextStep: "product" | "variant" | "option") {
    const nextIndex = flowStepOrder[nextStep];
    const currentIndex = flowStepOrder[editFlowStep];
    if (nextIndex === currentIndex) {
      return;
    }
    setEditStepDirection(nextIndex >= currentIndex ? "forward" : "backward");
    setEditFlowStep(nextStep);
    setEditStepMotionKey((current) => current + 1);
  }

  async function uploadProductImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/products/image", {
      method: "POST",
      body: formData
    });

    const payload = (await response.json()) as ImageUploadResponse;

    if (!response.ok || !payload.imageUrl) {
      throw new Error(payload.error ?? "Unable to upload product image.");
    }

    return payload.imageUrl;
  }

  async function uploadProductImages(files: File[]) {
    const uploads = await Promise.all(files.map((file) => uploadProductImage(file)));
    return uploads.filter((url, index, source) => source.indexOf(url) === index);
  }

  function reorderImageUrls(urls: string[], fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= urls.length || toIndex >= urls.length) {
      return urls;
    }

    const next = [...urls];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return urls;
    }
    next.splice(toIndex, 0, moved);
    return next;
  }

  function promotePrimaryImage(urls: string[], index: number) {
    if (index <= 0 || index >= urls.length) {
      return urls;
    }
    return reorderImageUrls(urls, index, 0);
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreateVariantError(null);
    setCreatePending(true);

    let parsedVariants: ParsedVariantSubmission[];

    try {
      const baseVariant = createVariants[0] ?? createBlankVariant(true);
      const variantsForSubmission = createHasVariants
        ? createVariants
        : [
            {
              ...baseVariant,
              priceDollars: createSinglePriceDollars,
              sku: createSingleSkuValue.trim(),
              inventoryQty: createSingleInventoryQty,
              isMadeToOrder: createSingleMadeToOrder,
              optionPairs: []
            }
          ];

      const parsed = parseVariantsFromDrafts(
        variantsForSubmission,
        createHasVariants ? (sku.trim() || title.trim() || "SKU") : (createSingleSkuValue.trim() || title.trim() || "SKU"),
        {
        strictValidation: false
        }
      );
      if ("error" in parsed) {
        setCreateVariantError(parsed.error);
        setCreatePending(false);
        return;
      }

      parsedVariants = parsed.variants as ParsedVariantSubmission[];
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "Unable to parse variants.";
      if (createHasVariants) {
        setCreateVariantError(message);
      } else {
        setCreateError(message);
      }
      setCreatePending(false);
      return;
    }

    const nestedVariants = buildNestedVariantsFromParsed(
      parsedVariants,
      createHasVariants,
      createVariantTierCount,
      [createTierOneLabel, createTierTwoLabel]
    );
    const rollupPriceCents = parsedVariants.reduce((minimum, variant) => Math.min(minimum, variant.priceCents), parsedVariants[0]?.priceCents ?? 0);
    const rollupInventoryQty = parsedVariants.reduce((sum, variant) => sum + variant.inventoryQty, 0);

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        slug: productSlug.trim() || null,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        imageAltText: imageAltText.trim() || null,
        status: "draft",
        hasVariants: createHasVariants,
        variantTiersCount: createVariantTierCount,
        variantTierLevels: createVariantTierCount === 2 ? [createTierOneLabel, createTierTwoLabel] : [createTierOneLabel],
        sku: createHasVariants ? (sku.trim() || null) : (createSingleSkuValue.trim() || null),
        imageUrls: createImageUrls,
        isFeatured,
        priceCents: rollupPriceCents,
        inventoryQty: rollupInventoryQty,
        variants: nestedVariants
      })
    });

    let payload: ProductResponse;
    try {
      payload = (await response.json()) as ProductResponse;
    } catch {
      setCreateError("Unable to create product due to an unexpected server response.");
      setCreatePending(false);
      return;
    }

    if (!response.ok || !payload.product) {
      setCreateError(payload.error ?? "Unable to create product.");
      setCreatePending(false);
      return;
    }

    setProducts((current) => [payload.product!, ...current]);
    setTitle("");
    setDescription("");
    setProductSlug("");
    setSeoTitle("");
    setSeoDescription("");
    setImageAltText("");
    setSku("");
    setIsFeatured(false);
    setCreateImageUrls([]);
    setCreateVariants([createBlankVariant(true)]);
    setCreateHasVariants(false);
    setCreateVariantTierCount(1);
    transitionCreateStep("product");
    setCreateActiveVariantIndex(null);
    setCreateVariantSnapshot(null);
    setCreateOptionSnapshot(null);
    setCreateSingleSkuMode("auto");
    setCreateSinglePriceDollars("0.00");
    setCreateSingleInventoryQty("0");
    setCreateSingleMadeToOrder(false);
    setCreateOptionOneName("");
    setCreateOptionTwoName("");
    setCreateVariantsSnapshotByMode(null);
    setCreatePending(false);
    setIsCreateFlyoutOpen(false);
    notify.success("Product created.");
  }

  async function updateProduct(
    productId: string,
    patch: Record<string, unknown>,
    scope: "catalog" | "edit" = "catalog"
  ): Promise<{ ok: boolean; error?: string }> {
    if (scope === "catalog") {
      setCatalogError(null);
    } else {
      setEditError(null);
      setEditVariantError(null);
    }

    const response = await fetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        ...patch
      })
    });

    let payload: ProductResponse;
    try {
      payload = (await response.json()) as ProductResponse;
    } catch {
      const message = "Unable to update product due to an unexpected server response.";
      if (scope === "catalog") {
        setCatalogError(message);
      } else {
        setEditError(message);
      }
      return { ok: false, error: message };
    }

    if (!response.ok || !payload.product) {
      const message = payload.error ?? "Unable to update product.";
      if (scope === "catalog") {
        setCatalogError(message);
      } else if (message.toLowerCase().includes("variant") || message.toLowerCase().includes("option")) {
        setEditVariantError(message);
      } else {
        setEditError(message);
      }
      return { ok: false, error: message };
    }

    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;
        return { ...product, ...payload.product };
      })
    );

    return { ok: true };
  }

  async function validateVariantRemovals(productId: string, variantIds: string[]) {
    if (variantIds.length === 0) {
      return { ok: true as const };
    }

    const response = await fetch("/api/products/variant-removal-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, variantIds })
    });

    let payload: VariantRemovalCheckResponse;
    try {
      payload = (await response.json()) as VariantRemovalCheckResponse;
    } catch {
      return { ok: false as const, error: "Unable to validate variant deletion due to an unexpected server response." };
    }

    if (!response.ok || !payload.ok) {
      return {
        ok: false as const,
        error: payload.error ?? "Unable to delete one or more variants."
      };
    }

    return { ok: true as const };
  }

  async function fetchOrderedVariantIds(productId: string, variantIds: string[]) {
    if (variantIds.length === 0) {
      return new Set<string>();
    }

    const response = await fetch("/api/products/variant-removal-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, variantIds })
    });

    let payload: VariantRemovalCheckResponse;
    try {
      payload = (await response.json()) as VariantRemovalCheckResponse;
    } catch {
      return new Set<string>();
    }

    return new Set(payload.blockedVariantIds ?? []);
  }

  async function requestDeleteConfirm(title: string, description: string, confirmLabel = "Delete") {
    if (deleteConfirmResolverRef.current) {
      deleteConfirmResolverRef.current(false);
      deleteConfirmResolverRef.current = null;
    }

    setDeleteConfirmTitle(title);
    setDeleteConfirmDescription(description);
    setDeleteConfirmLabel(confirmLabel);
    setIsDeleteConfirmOpen(true);

    return await new Promise<boolean>((resolve) => {
      deleteConfirmResolverRef.current = resolve;
    });
  }

  function resolveDeleteConfirm(confirmed: boolean) {
    setIsDeleteConfirmOpen(false);
    deleteConfirmResolverRef.current?.(confirmed);
    deleteConfirmResolverRef.current = null;
  }

  async function deleteProduct(product: ProductListItem) {
    const confirmed = await requestDeleteConfirm(
      `Delete "${product.title}"?`,
      "This only works when the product has no order associations and cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    setCatalogError(null);
    setDeletePendingProductId(product.id);

    const response = await fetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id })
    });

    let payload: ProductResponse;
    try {
      payload = (await response.json()) as ProductResponse;
    } catch {
      setDeletePendingProductId(null);
      setCatalogError("Unable to delete product due to an unexpected server response.");
      return;
    }

    setDeletePendingProductId(null);

    if (!response.ok || !payload.success) {
      setCatalogError(payload.error ?? "Unable to delete product.");
      return;
    }

    setProducts((current) => current.filter((item) => item.id !== product.id));
    notify.success("Product deleted.");

    if (editingProductId === product.id) {
      closeEditFlyout();
    }
  }

  function openInventoryAdjustModal(productId: string, variant: ProductVariantListItem, variantLabel: string) {
    setCatalogError(null);
    setInventoryAdjustError(null);
    setInventoryAdjustDraft({
      productId,
      variantId: variant.id,
      variantLabel,
      currentQty: variant.inventory_qty ?? 0,
      delta: "",
      note: ""
    });
  }

  async function submitInventoryAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inventoryAdjustDraft) {
      return;
    }

    const deltaQty = Number(inventoryAdjustDraft.delta);
    if (!Number.isInteger(deltaQty) || deltaQty === 0) {
      setInventoryAdjustError("Enter a whole-number adjustment, such as 20 or -5.");
      return;
    }

    const nextQty = inventoryAdjustDraft.currentQty + deltaQty;
    if (nextQty < 0) {
      setInventoryAdjustError("Adjustment would result in negative inventory.");
      return;
    }

    setInventoryAdjustError(null);
    setInventoryAdjustPending(true);

    try {
      const response = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: inventoryAdjustDraft.productId,
          variantId: inventoryAdjustDraft.variantId,
          deltaQty,
          reason: "adjustment",
          note: inventoryAdjustDraft.note.trim() || "Catalog inventory adjustment"
        })
      });

      const payload = (await response.json()) as InventoryAdjustResponse;

      if (!response.ok || !payload.product) {
        setInventoryAdjustError(payload.error ?? "Unable to adjust inventory.");
        return;
      }

      const normalizedProduct: ProductListItem = {
        ...payload.product,
        image_urls: payload.product.image_urls ?? [],
        product_variants: (payload.product.product_variants ?? []).map((variant) => ({
          ...variant,
          sku_mode: variant.sku_mode ?? "manual",
          image_urls: variant.image_urls ?? [],
          group_image_urls: variant.group_image_urls ?? []
        }))
      };

      setProducts((current) =>
        current.map((product) => (product.id === inventoryAdjustDraft.productId ? normalizedProduct : product))
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("inventory:changed"));
      }
      setInventoryAdjustDraft(null);
      notify.success("Inventory updated.");
    } catch (error) {
      setInventoryAdjustError(error instanceof Error ? error.message : "Unable to adjust inventory.");
    } finally {
      setInventoryAdjustPending(false);
    }
  }

  async function applyCatalogVariantMutation(
    product: ProductListItem,
    mutate: (drafts: VariantDraft[]) => VariantDraft[]
  ): Promise<{ ok: boolean; error?: string }> {
    const tierNames = resolveTierNamesForProduct(product);
    const baseDrafts = productVariantsForEditing(product, tierNames);
    const nextDrafts = mutate(baseDrafts);

    if (nextDrafts.length === 0) {
      return { ok: false, error: "At least one variant is required." };
    }

    let parsed: { variants: Array<Record<string, unknown>> } | { error: string };
    try {
      parsed = parseVariantsFromDrafts(nextDrafts, product.sku?.trim() || product.title.trim() || "SKU", {
        strictValidation: false
      });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to process variants." };
    }

    if ("error" in parsed) {
      return { ok: false, error: parsed.error };
    }

    const parsedVariants = parsed.variants as ParsedVariantSubmission[];
    const tierCount = nextDrafts.some((variant) => variant.optionPairs.length >= 2) ? 2 : 1;
    const tierOneName = tierNames[0] ?? "Option";
    const tierTwoName = tierNames[1] ?? "Option 2";
    const nestedVariants = buildNestedVariantsFromParsed(
      parsedVariants,
      true,
      tierCount,
      tierCount === 2 ? [tierOneName, tierTwoName] : [tierOneName]
    );
    const rollupPriceCents = parsedVariants.reduce((minimum, variant) => Math.min(minimum, variant.priceCents), parsedVariants[0]?.priceCents ?? 0);
    const rollupInventoryQty = parsedVariants.reduce((sum, variant) => sum + variant.inventoryQty, 0);

    return updateProduct(
      product.id,
      {
        hasVariants: true,
        variantTiersCount: tierCount,
        variantTierLevels: tierCount === 2 ? [tierOneName, tierTwoName] : [tierOneName],
        sku: null,
        priceCents: rollupPriceCents,
        inventoryQty: rollupInventoryQty,
        variants: nestedVariants
      },
      "catalog"
    );
  }

  async function setCatalogVariantStatus(
    product: ProductListItem,
    variantId: string,
    status: ProductVariantListItem["status"]
  ) {
    const updated = await applyCatalogVariantMutation(product, (drafts) =>
      normalizeVariantDefaults(
        drafts.map((draft) => (draft.id === variantId ? { ...draft, status } : draft))
      )
    );

    if (!updated.ok) {
      setCatalogError(updated.error ?? "Unable to update variant.");
    }
  }

  async function deleteCatalogVariant(product: ProductListItem, variantId: string, label: string) {
    const existingVariants = product.product_variants ?? [];
    if (existingVariants.length <= 1) {
      setCatalogError("You must keep at least one variant.");
      return;
    }

    const validation = await validateVariantRemovals(product.id, [variantId]);
    if (!validation.ok) {
      setCatalogError(validation.error ?? "Unable to delete variant.");
      return;
    }

    const confirmed = await requestDeleteConfirm(`Delete variant "${label}"?`, "This removes the variant from this product.");
    if (!confirmed) {
      return;
    }

    const updated = await applyCatalogVariantMutation(product, (drafts) =>
      normalizeVariantDefaults(drafts.filter((draft) => draft.id !== variantId))
    );

    if (!updated.ok) {
      setCatalogError(updated.error ?? "Unable to delete variant.");
    }
  }

  async function deleteCatalogVariantGroup(product: ProductListItem, variantIds: string[], groupLabel: string) {
    const uniqueIds = [...new Set(variantIds)];
    const existingVariants = product.product_variants ?? [];
    if (uniqueIds.length === 0) {
      return;
    }

    if (existingVariants.length - uniqueIds.length < 1) {
      setCatalogError("You must keep at least one variant.");
      return;
    }

    const validation = await validateVariantRemovals(product.id, uniqueIds);
    if (!validation.ok) {
      setCatalogError(validation.error ?? "Unable to delete variants.");
      return;
    }

    const confirmed = await requestDeleteConfirm(
      `Delete "${groupLabel}" and all of its options?`,
      "This removes all variants in this group from the product."
    );
    if (!confirmed) {
      return;
    }

    const idSet = new Set(uniqueIds);
    const updated = await applyCatalogVariantMutation(product, (drafts) =>
      normalizeVariantDefaults(drafts.filter((draft) => !(draft.id && idSet.has(draft.id))))
    );

    if (!updated.ok) {
      setCatalogError(updated.error ?? "Unable to delete variant group.");
    }
  }

  function openEditFlyout(product: ProductListItem, focus?: { step: "product" | "variant" | "option"; variantId?: string }) {
    setSelectedProductId(product.id);
    lastHandledProductIdFromUrlRef.current = product.id;
    updateProductUrl(product.id);
    setEditOrderedVariantIds(new Set());
    setEditingProductId(product.id);
    setEditTitle(product.title);
    setEditDescription(product.description);
    setEditProductSlug(product.slug ?? "");
    setEditSeoTitle(product.seo_title ?? "");
    setEditSeoDescription(product.seo_description ?? "");
    setEditImageAltText(product.image_alt_text ?? "");
    setEditSku(product.sku ?? "");
    setEditStatus(product.status);
    setEditIsFeatured(product.is_featured);
    setEditImageUrls(product.image_urls ?? []);
    const tierNames = resolveTierNamesForProduct(product);

    const seededVariants = productVariantsForEditing(product, tierNames);
    setEditVariants(seededVariants);
    const maxVariantOptionCount = Math.max(
      0,
      ...(product.product_variants ?? []).map((variant) => Object.keys(variant.option_values ?? {}).length)
    );
    const hasStructuredVariants = maxVariantOptionCount > 0 || (product.product_variants?.length ?? 0) > 1;
    setEditHasVariants(hasStructuredVariants);
    setEditVariantTierCount(maxVariantOptionCount >= 2 ? 2 : 1);
    const targetVariantIndex =
      focus?.variantId ? seededVariants.findIndex((variant) => variant.id === focus.variantId) : -1;
    const canFocusVariant = targetVariantIndex >= 0;
    const nextStep =
      canFocusVariant && focus?.step === "option"
        ? "option"
        : canFocusVariant && focus?.step === "variant"
          ? "variant"
          : "product";
    transitionEditStep(nextStep);
    setEditActiveVariantIndex(canFocusVariant ? targetVariantIndex : null);
    setEditVariantSnapshot(null);
    setEditOptionSnapshot(null);
    setEditSingleInventoryQty(seededVariants[0]?.inventoryQty ?? String(product.inventory_qty ?? 0));
    setEditSingleMadeToOrder(seededVariants[0]?.isMadeToOrder ?? false);
    setEditVariantsSnapshotByMode(null);
    setEditOptionOneName(tierNames[0] ?? "");
    setEditOptionTwoName(tierNames[1] ?? "");
    setEditError(null);
    setEditVariantError(null);
    setIsEditFlyoutOpen(true);
    void (async () => {
      const orderedIds = await fetchOrderedVariantIds(
        product.id,
        (product.product_variants ?? []).map((variant) => variant.id)
      );
      setEditOrderedVariantIds(orderedIds);
    })();
  }

  async function saveEditedProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingProductId) {
      setEditError("No product selected for editing.");
      return;
    }

    setEditError(null);
    setEditVariantError(null);

    if (editStatus === "active" && editHasVariants && editVariants.length === 0) {
      setEditVariantError("Active products must include at least one variant.");
      return;
    }

    setEditPending(true);

    let parsedVariants: ParsedVariantSubmission[];

    try {
      const baseVariant = editVariants[0] ?? createBlankVariant(true);
      const variantsForSubmission = editHasVariants
        ? editVariants
        : [
            {
              ...baseVariant,
              sku: editSku.trim(),
              inventoryQty: editSingleInventoryQty,
              isMadeToOrder: editSingleMadeToOrder,
              optionPairs: []
            }
          ];

      const parsed = parseVariantsFromDrafts(variantsForSubmission, editSku.trim() || editTitle.trim() || "SKU", {
        strictValidation: editStatus === "active",
        lockedSkuVariantIds: editOrderedVariantIds
      });

      if ("error" in parsed) {
        if (editHasVariants) {
          setEditVariantError(parsed.error);
        } else {
          setEditError(parsed.error);
        }
        setEditPending(false);
        return;
      }

      parsedVariants = parsed.variants as ParsedVariantSubmission[];
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "Unable to parse variants.";
      if (editHasVariants) {
        setEditVariantError(message);
      } else {
        setEditError(message);
      }
      setEditPending(false);
      return;
    }

    const nestedVariants = buildNestedVariantsFromParsed(
      parsedVariants,
      editHasVariants,
      editVariantTierCount,
      [editTierOneLabel, editTierTwoLabel]
    );
    const rollupPriceCents = parsedVariants.reduce((minimum, variant) => Math.min(minimum, variant.priceCents), parsedVariants[0]?.priceCents ?? 0);
    const rollupInventoryQty = parsedVariants.reduce((sum, variant) => sum + variant.inventoryQty, 0);

    const updated = await updateProduct(
      editingProductId,
      {
      title: editTitle,
      description: editDescription,
      slug: editProductSlug.trim() || null,
      seoTitle: editSeoTitle.trim() || null,
      seoDescription: editSeoDescription.trim() || null,
      imageAltText: editImageAltText.trim() || null,
      hasVariants: editHasVariants,
      variantTiersCount: editVariantTierCount,
      variantTierLevels: editVariantTierCount === 2 ? [editTierOneLabel, editTierTwoLabel] : [editTierOneLabel],
      sku: editSku.trim() || null,
      imageUrls: editImageUrls,
      isFeatured: editIsFeatured,
      status: editStatus,
      priceCents: rollupPriceCents,
      inventoryQty: rollupInventoryQty,
      variants: nestedVariants
      },
      "edit"
    );

    setEditPending(false);

    if (!updated.ok) {
      return;
    }

    closeEditFlyout();
    notify.success("Product saved.");
  }

  function resetCreateComposer() {
    setTitle("");
    setDescription("");
    setProductSlug("");
    setSeoTitle("");
    setSeoDescription("");
    setImageAltText("");
    setSku("");
    setIsFeatured(false);
    setCreateImageUrls([]);
    setCreateVariants([createBlankVariant(true)]);
    setCreateHasVariants(false);
    setCreateVariantTierCount(1);
    setCreateOptionOneName("");
    setCreateOptionTwoName("");
    setCreateSingleSkuMode("auto");
    setCreateSinglePriceDollars("0.00");
    setCreateSingleInventoryQty("0");
    setCreateSingleMadeToOrder(false);
    setCreateVariantsSnapshotByMode(null);
    transitionCreateStep("product");
    setCreateActiveVariantIndex(null);
    setCreateVariantSnapshot(null);
    setCreateOptionSnapshot(null);
    setCreateError(null);
    setCreateVariantError(null);
  }

  function resetEditComposer() {
    setEditingProductId(null);
    setEditTitle("");
    setEditDescription("");
    setEditProductSlug("");
    setEditSeoTitle("");
    setEditSeoDescription("");
    setEditImageAltText("");
    setEditSku("");
    setEditStatus("draft");
    setEditIsFeatured(false);
    setEditImageUrls([]);
    setEditVariants([createBlankVariant(true)]);
    setEditHasVariants(false);
    setEditVariantTierCount(1);
    transitionEditStep("product");
    setEditActiveVariantIndex(null);
    setEditVariantSnapshot(null);
    setEditOptionSnapshot(null);
    setEditOptionOneName("");
    setEditOptionTwoName("");
    setEditSingleInventoryQty("0");
    setEditSingleMadeToOrder(false);
    setEditVariantsSnapshotByMode(null);
    setEditOrderedVariantIds(new Set());
    setEditError(null);
    setEditVariantError(null);
  }

  function closeEditFlyout() {
    setIsEditFlyoutOpen(false);
    updateProductUrl(null);
    resetEditComposer();
  }

  const isCreateDirty = isCreateFlyoutOpen && createBaseline !== "" && currentCreateSnapshot !== createBaseline;
  const isEditDirty = isEditFlyoutOpen && editBaseline !== "" && currentEditSnapshot !== editBaseline;

  const inferredCreateLevelOneName = createVariants.find((variant) => variant.optionPairs[0]?.name.trim())?.optionPairs[0]?.name.trim() || "";
  const inferredCreateLevelTwoName = createVariants.find((variant) => variant.optionPairs[1]?.name.trim())?.optionPairs[1]?.name.trim() || "";
  const createDefaultLevelOneName = createOptionOneName.trim() || inferredCreateLevelOneName;
  const createDefaultLevelTwoName = createOptionTwoName.trim() || inferredCreateLevelTwoName;
  const createTierOneLabel = createDefaultLevelOneName || "Option";
  const createTierTwoLabel = createDefaultLevelTwoName || "Option 2";
  const createSkuBase = sku.trim() || title.trim() || "SKU";
  const createSingleAutoSku = buildSkuFromParts(title.trim() || "SKU", ["1"]);
  const createSingleSkuValue = createSingleSkuMode === "manual" ? sku : createSingleAutoSku;

  const createVariantGroups = useMemo(() => {
    if (!createHasVariants) {
      return [] as Array<{ key: string; label: string; indexes: number[] }>;
    }

    if (createVariantTierCount === 1) {
      return createVariants.map((variant, index) => ({
        key: `${index}`,
        label: getOptionValue(variant, createTierOneLabel) || `Variant ${index + 1}`,
        indexes: [index]
      }));
    }

    const grouped: Array<{ key: string; label: string; indexes: number[] }> = [];
    const indexByKey = new Map<string, number>();

    createVariants.forEach((variant, index) => {
      const value = getOptionValue(variant, createTierOneLabel) || `Variant ${index + 1}`;
      const key = value.toLowerCase();
      const existing = indexByKey.get(key);
      if (existing === undefined) {
        indexByKey.set(key, grouped.length);
        grouped.push({ key, label: value, indexes: [index] });
      } else {
        grouped[existing]?.indexes.push(index);
      }
    });

    return grouped;
  }, [createHasVariants, createVariantTierCount, createVariants, createTierOneLabel]);

  const activeCreateVariant = createActiveVariantIndex !== null ? createVariants[createActiveVariantIndex] : null;
  const activeCreateGroupIndexes =
    createVariantTierCount === 2 && activeCreateVariant
      ? createVariants
          .map((variant, index) => ({ variant, index }))
          .filter(
            ({ variant }) =>
              getOptionValue(variant, createTierOneLabel).trim().toLowerCase() ===
              getOptionValue(activeCreateVariant, createTierOneLabel).trim().toLowerCase()
          )
          .map(({ index }) => index)
      : activeCreateVariant && createActiveVariantIndex !== null
        ? [createActiveVariantIndex]
        : [];
  const activeCreateGroupImageIndex = activeCreateGroupIndexes[0] ?? createActiveVariantIndex;
  const activeCreateAutoSku =
    activeCreateVariant && createActiveVariantIndex !== null
      ? buildDefaultVariantSku(activeCreateVariant, createSkuBase, createActiveVariantIndex)
      : "";
  const activeCreateSkuValue = activeCreateVariant
    ? activeCreateVariant.skuMode === "manual"
      ? activeCreateVariant.sku
      : activeCreateAutoSku
    : "";
  const activeCreateLevelOneName = activeCreateVariant?.optionPairs[0]?.name ?? createDefaultLevelOneName;
  const activeCreateLevelOneValue = activeCreateVariant?.optionPairs[0]?.value ?? "";
  const activeCreateLevelTwoName = activeCreateVariant?.optionPairs[1]?.name.trim() || createDefaultLevelTwoName || createTierTwoLabel;
  const activeCreateHasSubOptions = createVariantTierCount === 2 && activeCreateGroupIndexes.length > 0;
  const activeCreateVariantImageUrls = activeCreateHasSubOptions
    ? activeCreateGroupImageIndex !== null
      ? (createVariants[activeCreateGroupImageIndex]?.groupImageUrls ?? [])
      : []
    : activeCreateVariant
      ? activeCreateVariant.imageUrls.length > 0
        ? activeCreateVariant.imageUrls
        : activeCreateVariant.groupImageUrls
      : [];
  const activeCreateSubOptionIndexes = activeCreateGroupIndexes.filter((index) => {
    const variant = createVariants[index];
    return variant ? getOptionValue(variant, activeCreateLevelTwoName).trim().length > 0 : false;
  });


  function openCreateVariantEditor(index: number) {
    setCreateVariantSnapshot(cloneVariantDrafts(createVariants));
    setCreateActiveVariantIndex(index);
    transitionCreateStep("variant");
  }

  function openCreateOptionEditor(index: number) {
    setCreateOptionSnapshot(cloneVariantDrafts(createVariants));
    setCreateActiveVariantIndex(index);
    transitionCreateStep("option");
  }

  function addCreateVariantFromProductView() {
    const nextIndex = createVariants.length;
    const nextSkuBase = sku.trim() || title.trim() || "SKU";
    const inheritedLevelOneName = createOptionOneName.trim() || createDefaultLevelOneName.trim();

    const nextVariant: VariantDraft = {
      ...createBlankVariant(false),
      skuMode: "auto",
      sku: buildSkuFromParts(nextSkuBase, [String(nextIndex + 1)]),
      title: `Variant ${nextIndex + 1}`,
      optionPairs: inheritedLevelOneName ? [{ name: inheritedLevelOneName, value: "" }] : []
    };

    setCreateVariantSnapshot(cloneVariantDrafts(createVariants));
    setCreateVariants((current) => normalizeVariantDefaults([...current, nextVariant]));
    setCreateActiveVariantIndex(nextIndex);
    transitionCreateStep("variant");
  }

  function addCreateTierTwoOption() {
    if (createActiveVariantIndex === null) {
      return;
    }

    const baseVariant = createVariants[createActiveVariantIndex];
    if (!baseVariant) {
      return;
    }

    const levelOneName = activeCreateLevelOneName;
    const levelTwoName = activeCreateLevelTwoName || createTierTwoLabel;
    const groupValue = getOptionValue(baseVariant, levelOneName) || `${levelOneName} 1`;
    const nextSkuBase = sku.trim() || title.trim() || "SKU";

    setCreateOptionSnapshot(cloneVariantDrafts(createVariants));
    setCreateVariantTierCount(2);
    setCreateOptionTwoName(levelTwoName);
    setCreateVariants((current) => {
      const groupIndexes = current
        .map((variant, index) => ({ variant, index }))
        .filter(({ variant }) => getOptionValue(variant, levelOneName).trim().toLowerCase() === groupValue.trim().toLowerCase())
        .map(({ index }) => index);

      const existingOptionIndexes = groupIndexes.filter((index) => {
        const value = getOptionValue(current[index] ?? createBlankVariant(false), levelTwoName);
        return value.trim().length > 0;
      });

      if (existingOptionIndexes.length === 0) {
        return normalizeVariantDefaults(
          current.map((variant, index) =>
            index === createActiveVariantIndex
              ? setOptionValue(
                  setOptionValue(variant, levelOneName, groupValue),
                  levelTwoName,
                  getOptionValue(variant, levelTwoName) || `${levelTwoName} 1`
                )
              : variant
          )
        );
      }

      const optionValue = `${levelTwoName} ${existingOptionIndexes.length + 1}`;
      const nextVariant: VariantDraft = {
        ...createBlankVariant(false),
        skuMode: "auto",
        sku: buildSkuFromParts(nextSkuBase, [groupValue, optionValue]),
        title: `${groupValue} • ${optionValue}`,
        optionPairs: [
          { name: levelOneName, value: groupValue },
          { name: levelTwoName, value: optionValue }
        ]
      };
      return normalizeVariantDefaults([...current, nextVariant]);
    });
    setCreateActiveVariantIndex((current) => {
      const base = current ?? createActiveVariantIndex;
      if (base === null) {
        return base;
      }
      const hasExisting = activeCreateGroupIndexes.some((index) => {
        const value = getOptionValue(createVariants[index] ?? createBlankVariant(false), levelTwoName);
        return value.trim().length > 0;
      });
      return hasExisting ? createVariants.length : base;
    });
    transitionCreateStep("option");
  }

  function setCreateSubOptionsEnabled(enabled: boolean) {
    if (createActiveVariantIndex === null) {
      return;
    }
    const baseVariant = createVariants[createActiveVariantIndex];
    if (!baseVariant) {
      return;
    }

    const levelOneName = activeCreateLevelOneName;
    const levelTwoName = activeCreateLevelTwoName || createTierTwoLabel;
    const levelOneValue = getOptionValue(baseVariant, levelOneName) || `${levelOneName} 1`;

    setCreateVariants((current) => {
      const groupIndexes = current
        .map((variant, index) => ({ variant, index }))
        .filter(({ variant }) => getOptionValue(variant, levelOneName).trim().toLowerCase() === levelOneValue.trim().toLowerCase())
        .map(({ index }) => index);

      if (enabled) {
        setCreateVariantTierCount(2);
        setCreateOptionTwoName(levelTwoName);
        return normalizeVariantDefaults(current);
      }

      const keepIndex = createActiveVariantIndex;
      const reduced = current
        .filter((_, index) => !groupIndexes.includes(index) || index === keepIndex)
        .map((variant, index) => {
          if (index !== keepIndex) {
            return variant;
          }
          return {
            ...variant,
            optionPairs: [{ name: levelOneName, value: levelOneValue }]
          };
        });

      setCreateVariantTierCount(reduced.some((variant) => variant.optionPairs.length >= 2) ? 2 : 1);
      return normalizeVariantDefaults(reduced);
    });
  }

  function updateCreateVariantStatuses(indexes: number[], status: "active" | "archived") {
    const indexSet = new Set(indexes);
    setCreateVariants((current) =>
      normalizeVariantDefaults(current.map((variant, index) => (indexSet.has(index) ? { ...variant, status } : variant)))
    );
  }

  async function removeCreateVariants(indexes: number[], label: string) {
    const uniqueIndexes = [...new Set(indexes)].sort((a, b) => a - b);
    if (uniqueIndexes.length === 0) {
      return;
    }

    const confirmed = await requestDeleteConfirm(`Delete ${label}?`, "This removes it from this product.");
    if (!confirmed) {
      return;
    }

    const indexSet = new Set(uniqueIndexes);
    const removedActive = createActiveVariantIndex !== null && indexSet.has(createActiveVariantIndex);
    const removedBeforeActive =
      createActiveVariantIndex === null ? 0 : uniqueIndexes.filter((index) => index < createActiveVariantIndex).length;
    const nextVariantCount = createVariants.length - uniqueIndexes.length;

    setCreateVariants((current) => {
      const filtered = current.filter((_, index) => !indexSet.has(index));
      setCreateVariantTierCount(filtered.some((variant) => variant.optionPairs.length >= 2) ? 2 : 1);
      return filtered.length === 0 ? [] : normalizeVariantDefaults(filtered);
    });

    if (nextVariantCount <= 0) {
      setCreateActiveVariantIndex(null);
      return;
    }

    if (removedActive) {
      const nextActiveIndex = Math.max(0, Math.min(uniqueIndexes[0] ?? 0, nextVariantCount - 1));
      setCreateActiveVariantIndex(nextActiveIndex);
    } else if (createActiveVariantIndex !== null) {
      setCreateActiveVariantIndex(Math.max(0, createActiveVariantIndex - removedBeforeActive));
    }
  }

  function handleCreateFlyoutOpenChange(open: boolean) {
    setIsCreateFlyoutOpen(open);
    if (!open) {
      resetCreateComposer();
    }
  }

  function handleEditFlyoutOpenChange(open: boolean) {
    if (open) {
      setIsEditFlyoutOpen(true);
      return;
    }

    closeEditFlyout();
  }

  function cancelCreateStepChanges() {
    if (createFlowStep === "option") {
      if (createOptionSnapshot) {
        setCreateVariants(createOptionSnapshot);
      }
      setCreateOptionSnapshot(null);
      transitionCreateStep("variant");
      return;
    }

    if (createVariantSnapshot) {
      setCreateVariants(createVariantSnapshot);
    }
    setCreateVariantSnapshot(null);
    transitionCreateStep("product");
    setCreateActiveVariantIndex(null);
  }

  function commitCreateStepChanges() {
    if (createFlowStep === "option") {
      setCreateOptionSnapshot(null);
      transitionCreateStep("variant");
      return;
    }

    setCreateVariantSnapshot(null);
    transitionCreateStep("product");
    setCreateActiveVariantIndex(null);
  }

  const editTierOneLabel = editOptionOneName.trim() || "Option";
  const editTierTwoLabel = editOptionTwoName.trim() || "Option 2";
  const editSkuBase = editSku.trim() || editTitle.trim() || "SKU";

  const editVariantGroups = useMemo(() => {
    if (!editHasVariants) {
      return [] as Array<{ key: string; label: string; indexes: number[] }>;
    }

    if (editVariantTierCount === 1) {
      return editVariants.map((variant, index) => ({
        key: `${index}`,
        label: getOptionValue(variant, editTierOneLabel) || `Variant ${index + 1}`,
        indexes: [index]
      }));
    }

    const grouped: Array<{ key: string; label: string; indexes: number[] }> = [];
    const indexByKey = new Map<string, number>();

    editVariants.forEach((variant, index) => {
      const value = getOptionValue(variant, editTierOneLabel) || `Variant ${index + 1}`;
      const key = value.toLowerCase();
      const existing = indexByKey.get(key);
      if (existing === undefined) {
        indexByKey.set(key, grouped.length);
        grouped.push({ key, label: value, indexes: [index] });
      } else {
        grouped[existing]?.indexes.push(index);
      }
    });

    return grouped;
  }, [editHasVariants, editVariantTierCount, editVariants, editTierOneLabel]);

  const activeEditVariant = editActiveVariantIndex !== null ? editVariants[editActiveVariantIndex] : null;
  const activeEditGroupIndexes =
    editVariantTierCount === 2 && activeEditVariant
      ? editVariants
          .map((variant, index) => ({ variant, index }))
          .filter(
            ({ variant }) =>
              getOptionValue(variant, editTierOneLabel).trim().toLowerCase() ===
              getOptionValue(activeEditVariant, editTierOneLabel).trim().toLowerCase()
          )
          .map(({ index }) => index)
      : activeEditVariant && editActiveVariantIndex !== null
        ? [editActiveVariantIndex]
        : [];
  const activeEditGroupImageIndex = activeEditGroupIndexes[0] ?? editActiveVariantIndex;
  const activeEditAutoSku =
    activeEditVariant && editActiveVariantIndex !== null
      ? buildDefaultVariantSku(activeEditVariant, editSkuBase, editActiveVariantIndex)
      : "";
  const activeEditVariantIsOrdered = activeEditVariant?.id ? editOrderedVariantIds.has(activeEditVariant.id) : false;
  const activeEditGroupHasOrderedVariant = activeEditGroupIndexes.some((index) => {
    const variantId = editVariants[index]?.id;
    return variantId ? editOrderedVariantIds.has(variantId) : false;
  });
  const activeEditSkuValue = activeEditVariant
    ? activeEditVariant.skuMode === "manual" || activeEditVariantIsOrdered
      ? activeEditVariant.sku
      : activeEditAutoSku
    : "";
  const activeEditLevelOneName = activeEditVariant?.optionPairs[0]?.name ?? "";
  const activeEditLevelOneValue = activeEditVariant?.optionPairs[0]?.value ?? "";
  const activeEditLevelTwoName = activeEditVariant?.optionPairs[1]?.name.trim() || editTierTwoLabel;
  const activeEditHasSubOptions = editVariantTierCount === 2 && activeEditGroupIndexes.length > 0;
  const activeEditVariantImageUrls = activeEditHasSubOptions
    ? activeEditGroupImageIndex !== null
      ? (editVariants[activeEditGroupImageIndex]?.groupImageUrls ?? [])
      : []
    : activeEditVariant
      ? activeEditVariant.imageUrls.length > 0
        ? activeEditVariant.imageUrls
        : activeEditVariant.groupImageUrls
      : [];
  const activeEditSubOptionIndexes = activeEditGroupIndexes.filter((index) => {
    const variant = editVariants[index];
    return variant ? getOptionValue(variant, activeEditLevelTwoName).trim().length > 0 : false;
  });


  function openEditVariantEditor(index: number) {
    setEditVariantSnapshot(cloneVariantDrafts(editVariants));
    setEditActiveVariantIndex(index);
    transitionEditStep("variant");
  }

  function openEditOptionEditor(index: number) {
    setEditOptionSnapshot(cloneVariantDrafts(editVariants));
    setEditActiveVariantIndex(index);
    transitionEditStep("option");
  }

  function addEditVariantFromProductView() {
    const nextIndex = editVariants.length;
    const nextSkuBase = editSku.trim() || editTitle.trim() || "SKU";
    const inheritedLevelOneName = editTierOneLabel.trim();

    const nextVariant: VariantDraft = {
      ...createBlankVariant(false),
      skuMode: "auto",
      sku: buildSkuFromParts(nextSkuBase, [String(nextIndex + 1)]),
      title: `Variant ${nextIndex + 1}`,
      optionPairs: inheritedLevelOneName ? [{ name: inheritedLevelOneName, value: "" }] : []
    };

    setEditVariantSnapshot(cloneVariantDrafts(editVariants));
    setEditVariants((current) => normalizeVariantDefaults([...current, nextVariant]));
    setEditActiveVariantIndex(nextIndex);
    transitionEditStep("variant");
  }

  function addEditTierTwoOption() {
    if (editActiveVariantIndex === null) {
      return;
    }

    const baseVariant = editVariants[editActiveVariantIndex];
    if (!baseVariant) {
      return;
    }

    const levelOneName = activeEditLevelOneName;
    const levelTwoName = activeEditLevelTwoName || editTierTwoLabel;
    const groupValue = getOptionValue(baseVariant, levelOneName) || `${levelOneName} 1`;
    const nextSkuBase = editSku.trim() || editTitle.trim() || "SKU";

    setEditOptionSnapshot(cloneVariantDrafts(editVariants));
    setEditVariantTierCount(2);
    setEditOptionTwoName(levelTwoName);
    setEditVariants((current) => {
      const groupIndexes = current
        .map((variant, index) => ({ variant, index }))
        .filter(({ variant }) => getOptionValue(variant, levelOneName).trim().toLowerCase() === groupValue.trim().toLowerCase())
        .map(({ index }) => index);

      const existingOptionIndexes = groupIndexes.filter((index) => {
        const value = getOptionValue(current[index] ?? createBlankVariant(false), levelTwoName);
        return value.trim().length > 0;
      });

      if (existingOptionIndexes.length === 0) {
        return normalizeVariantDefaults(
          current.map((variant, index) =>
            index === editActiveVariantIndex
              ? setOptionValue(
                  setOptionValue(variant, levelOneName, groupValue),
                  levelTwoName,
                  getOptionValue(variant, levelTwoName) || `${levelTwoName} 1`
                )
              : variant
          )
        );
      }

      const optionValue = `${levelTwoName} ${existingOptionIndexes.length + 1}`;
      const nextVariant: VariantDraft = {
        ...createBlankVariant(false),
        skuMode: "auto",
        sku: buildSkuFromParts(nextSkuBase, [groupValue, optionValue]),
        title: `${groupValue} • ${optionValue}`,
        optionPairs: [
          { name: levelOneName, value: groupValue },
          { name: levelTwoName, value: optionValue }
        ]
      };
      return normalizeVariantDefaults([...current, nextVariant]);
    });
    setEditActiveVariantIndex((current) => {
      const base = current ?? editActiveVariantIndex;
      if (base === null) {
        return base;
      }
      const hasExisting = activeEditGroupIndexes.some((index) => {
        const value = getOptionValue(editVariants[index] ?? createBlankVariant(false), levelTwoName);
        return value.trim().length > 0;
      });
      return hasExisting ? editVariants.length : base;
    });
    transitionEditStep("option");
  }

  function setEditSubOptionsEnabled(enabled: boolean) {
    if (editActiveVariantIndex === null) {
      return;
    }
    const baseVariant = editVariants[editActiveVariantIndex];
    if (!baseVariant) {
      return;
    }

    const levelOneName = activeEditLevelOneName;
    const levelTwoName = activeEditLevelTwoName || editTierTwoLabel;
    const levelOneValue = getOptionValue(baseVariant, levelOneName) || `${levelOneName} 1`;

    setEditVariants((current) => {
      const groupIndexes = current
        .map((variant, index) => ({ variant, index }))
        .filter(({ variant }) => getOptionValue(variant, levelOneName).trim().toLowerCase() === levelOneValue.trim().toLowerCase())
        .map(({ index }) => index);

      if (enabled) {
        setEditVariantTierCount(2);
        setEditOptionTwoName(levelTwoName);
        return normalizeVariantDefaults(current);
      }

      const keepIndex = editActiveVariantIndex;
      const reduced = current
        .filter((_, index) => !groupIndexes.includes(index) || index === keepIndex)
        .map((variant, index) => {
          if (index !== keepIndex) {
            return variant;
          }
          return {
            ...variant,
            optionPairs: [{ name: levelOneName, value: levelOneValue }]
          };
        });

      setEditVariantTierCount(reduced.some((variant) => variant.optionPairs.length >= 2) ? 2 : 1);
      return normalizeVariantDefaults(reduced);
    });
  }

  function updateEditVariantStatuses(indexes: number[], status: "active" | "archived") {
    const indexSet = new Set(indexes);
    setEditVariants((current) =>
      normalizeVariantDefaults(current.map((variant, index) => (indexSet.has(index) ? { ...variant, status } : variant)))
    );
  }

  async function removeEditVariants(indexes: number[], label: string) {
    const uniqueIndexes = [...new Set(indexes)].sort((a, b) => a - b);
    if (uniqueIndexes.length === 0) {
      return;
    }

    const confirmed = await requestDeleteConfirm(
      `Delete ${label}?`,
      "This is blocked on save if it has existing order references; use Archive in that case."
    );
    if (!confirmed) {
      return;
    }

    if (!editingProductId) {
      setEditError("No product selected for editing.");
      return;
    }

    const persistedVariantIds = uniqueIndexes
      .map((index) => editVariants[index]?.id)
      .filter((variantId): variantId is string => Boolean(variantId));

    if (persistedVariantIds.length > 0) {
      setEditVariantError(null);
      const validation = await validateVariantRemovals(editingProductId, persistedVariantIds);
      if (!validation.ok) {
        setEditVariantError(validation.error);
        return;
      }
    }

    const indexSet = new Set(uniqueIndexes);
    const removedActive = editActiveVariantIndex !== null && indexSet.has(editActiveVariantIndex);
    const removedBeforeActive =
      editActiveVariantIndex === null ? 0 : uniqueIndexes.filter((index) => index < editActiveVariantIndex).length;
    const nextVariantCount = editVariants.length - uniqueIndexes.length;

    setEditVariants((current) => {
      const filtered = current.filter((_, index) => !indexSet.has(index));
      setEditVariantTierCount(filtered.some((variant) => variant.optionPairs.length >= 2) ? 2 : 1);
      return filtered.length === 0 ? [] : normalizeVariantDefaults(filtered);
    });

    if (nextVariantCount <= 0) {
      setEditActiveVariantIndex(null);
      return;
    }

    if (removedActive) {
      const nextActiveIndex = Math.max(0, Math.min(uniqueIndexes[0] ?? 0, nextVariantCount - 1));
      setEditActiveVariantIndex(nextActiveIndex);
    } else if (editActiveVariantIndex !== null) {
      setEditActiveVariantIndex(Math.max(0, editActiveVariantIndex - removedBeforeActive));
    }
  }

  function cancelEditStepChanges() {
    if (editFlowStep === "option") {
      if (editOptionSnapshot) {
        setEditVariants(editOptionSnapshot);
      }
      setEditOptionSnapshot(null);
      transitionEditStep("variant");
      return;
    }

    if (editVariantSnapshot) {
      setEditVariants(editVariantSnapshot);
    }
    setEditVariantSnapshot(null);
    transitionEditStep("product");
    setEditActiveVariantIndex(null);
  }

  function commitEditStepChanges() {
    if (editFlowStep === "option") {
      setEditOptionSnapshot(null);
      transitionEditStep("variant");
      return;
    }

    setEditVariantSnapshot(null);
    transitionEditStep("product");
    setEditActiveVariantIndex(null);
  }

  const createStepIndex = createFlowStep === "product" ? 0 : createFlowStep === "variant" ? 1 : 2;
  const createFlyoutTitle = (
    <span className="block overflow-hidden">
      <span
        className="flex w-[300%] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${createStepIndex * 33.3333}%)` }}
      >
        <span className="w-1/3">Create product</span>
        <span className="w-1/3">Configure variant</span>
        <span className="w-1/3">Configure option</span>
      </span>
    </span>
  );
  const createFlyoutDescription = (
    <span className="block overflow-hidden">
      <span
        className="flex w-[300%] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${createStepIndex * 33.3333}%)` }}
      >
        <span className="w-1/3">Add a new product with multiple variants and independent pricing.</span>
        <span className="w-1/3">Configure this variant group and its sellable options.</span>
        <span className="w-1/3">Configure one sellable option under this variant.</span>
      </span>
    </span>
  );
  const createFlyoutFooter = ({ requestClose }: { requestClose: () => void }) => (
    <div className="overflow-hidden">
      <div
        className="flex w-[300%] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${createStepIndex * 33.3333}%)` }}
      >
        <div className="flex w-1/3 items-center justify-end gap-2">
          <AppAlert compact variant="error" message={createError} className="mr-auto text-sm" />
          <Button type="button" variant="outline" onClick={requestClose}>
            Close
          </Button>
          <Button disabled={createPending} type="submit" form="create-product-form">
            {createPending ? "Saving..." : "Add Product"}
          </Button>
        </div>
        <div className="flex w-1/3 justify-end gap-2">
          <Button type="button" variant="outline" onClick={cancelCreateStepChanges}>
            Cancel
          </Button>
          <Button type="button" onClick={commitCreateStepChanges}>
            Done
          </Button>
        </div>
        <div className="flex w-1/3 justify-end gap-2">
          <Button type="button" variant="outline" onClick={cancelCreateStepChanges}>
            Cancel
          </Button>
          <Button type="button" onClick={commitCreateStepChanges}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );

  const editStepIndex = editFlowStep === "product" ? 0 : editFlowStep === "variant" ? 1 : 2;
  const isEditReadOnly = editStatus === "archived";

  useEffect(() => {
    const panel = createActivePanelRef.current;
    if (!panel) {
      return;
    }

    const width = panel.getBoundingClientRect().width || 320;
    const fromX = createStepDirection === "forward" ? width * 0.92 : -(width * 0.92);
    const animation = panel.animate(
      [
        { transform: `translateX(${fromX}px)`, opacity: 0.7 },
        { transform: "translateX(0px)", opacity: 1 }
      ],
      { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }
    );
    return () => animation.cancel();
  }, [createStepMotionKey, createStepDirection]);

  useEffect(() => {
    const panel = editActivePanelRef.current;
    if (!panel) {
      return;
    }

    const width = panel.getBoundingClientRect().width || 320;
    const fromX = editStepDirection === "forward" ? width * 0.92 : -(width * 0.92);
    const animation = panel.animate(
      [
        { transform: `translateX(${fromX}px)`, opacity: 0.7 },
        { transform: "translateX(0px)", opacity: 1 }
      ],
      { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }
    );
    return () => animation.cancel();
  }, [editStepMotionKey, editStepDirection]);
  const editFlyoutTitle = (
    <div className="flex items-start justify-between gap-3">
      <span className="block min-w-0 flex-1 overflow-hidden">
        <span
          className="flex w-[300%] transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${editStepIndex * 33.3333}%)` }}
        >
          <span className="w-1/3">Edit product</span>
          <span className="w-1/3">Configure variant</span>
          <span className="w-1/3">Configure option</span>
        </span>
      </span>
    </div>
  );
  const editFlyoutDescription = (
    <span className="block overflow-hidden">
      <span
        className="flex w-[300%] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${editStepIndex * 33.3333}%)` }}
      >
        <span className="w-1/3">Update product content, image, and variant pricing/inventory.</span>
        <span className="w-1/3">Configure this variant group and its sellable options.</span>
        <span className="w-1/3">Configure one sellable option under this variant.</span>
      </span>
    </span>
  );
  const editFlyoutFooter = ({ requestClose }: { requestClose: () => void }) => (
    <div className="overflow-hidden">
      <div
        className="flex w-[300%] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${editStepIndex * 33.3333}%)` }}
      >
        <div className="flex w-1/3 items-center justify-end gap-2">
          <AppAlert compact variant="error" message={editError} className="mr-auto text-sm" />
          <Button type="button" variant="outline" onClick={requestClose}>
            Close
          </Button>
          <Button disabled={editPending || isEditReadOnly} type="submit" form="edit-product-form">
            {editPending ? "Saving..." : "Save product"}
          </Button>
        </div>
        <div className="flex w-1/3 justify-end gap-2">
          <Button type="button" variant="outline" onClick={cancelEditStepChanges} disabled={isEditReadOnly}>
            Cancel
          </Button>
          <Button type="button" onClick={commitEditStepChanges} disabled={isEditReadOnly}>
            Done
          </Button>
        </div>
        <div className="flex w-1/3 justify-end gap-2">
          <Button type="button" variant="outline" onClick={cancelEditStepChanges} disabled={isEditReadOnly}>
            Cancel
          </Button>
          <Button type="button" onClick={commitEditStepChanges} disabled={isEditReadOnly}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );

  const createImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const createReplaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const editReplaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const createSuppressNextImageClickRef = useRef(false);
  const editSuppressNextImageClickRef = useRef(false);
  const [createReplaceImageIndex, setCreateReplaceImageIndex] = useState<number | null>(null);
  const [editReplaceImageIndex, setEditReplaceImageIndex] = useState<number | null>(null);
  const [createDragOverImageIndex, setCreateDragOverImageIndex] = useState<number | null>(null);
  const [editDragOverImageIndex, setEditDragOverImageIndex] = useState<number | null>(null);

  function beginImageTileDrag(event: React.DragEvent<HTMLDivElement>, index: number, mode: "create" | "edit") {
    const suppressClickRef = mode === "create" ? createSuppressNextImageClickRef : editSuppressNextImageClickRef;
    const setDraggingIndex = mode === "create" ? setCreateDraggingImageIndex : setEditDraggingImageIndex;

    suppressClickRef.current = true;
    setDraggingIndex(index);

    const tile = event.currentTarget;
    const rect = tile.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.dropEffect = "move";
    event.dataTransfer.setData("text/plain", String(index));
    event.dataTransfer.setDragImage(tile, offsetX, offsetY);
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Catalog and Inventory</h2>
            <p className="text-sm text-muted-foreground">Add products with configurable variants and independent pricing/inventory.</p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setTitle("");
              setDescription("");
              setSku("");
              setIsFeatured(false);
              setCreateImageUrls([]);
              setCreateVariants([createBlankVariant(true)]);
              setCreateHasVariants(false);
              setCreateVariantTierCount(1);
              transitionCreateStep("product");
              setCreateActiveVariantIndex(null);
              setCreateVariantSnapshot(null);
              setCreateOptionSnapshot(null);
              setCreateSingleSkuMode("auto");
              setCreateSinglePriceDollars("0.00");
              setCreateSingleInventoryQty("0");
              setCreateOptionOneName("");
              setCreateOptionTwoName("");
              setCreateVariantsSnapshotByMode(null);
              setIsCreateFlyoutOpen(true);
            }}
          >
            Create Product
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, SKU, or option value" className="pl-9" />
          </div>
          <Select aria-label="Status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ProductRecord["status"])}>
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>
        <FeedbackMessage type="error" message={catalogError} />
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="space-y-3 rounded-md border border-border">
          <div className="px-3 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Products</p>
          </div>
          <Table>
            <TableHeader className="bg-muted/45">
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProducts.length === 0 ? (
                <TableRow>
                  <TableCell className="py-3 text-muted-foreground" colSpan={6}>
                    No products match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                visibleProducts.map((product) => {
                  const sortedVariants = sortVariants(product.product_variants ?? []);
                  const productPreviewImage = product.image_urls?.[0] ?? null;
                  const variantProduct = hasStructuredVariants(product);
                  const isSelected = selectedProduct?.id === product.id;
                  const singleVariantForInventory = !variantProduct ? sortedVariants[0] : null;

                  return (
                    <TableRow
                      key={product.id}
                      className={isSelected ? "bg-primary/5" : undefined}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <TableCell>
                        <div className="flex items-stretch gap-2">
                          {productPreviewImage ? (
                            <div className="relative w-12 min-h-12 min-w-12 overflow-hidden rounded-md border border-border">
                              <Image src={productPreviewImage} alt={`${product.title} preview`} fill unoptimized className="object-cover" />
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            <p className="font-medium">{product.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                              {richTextToPlainText(product.description).replace(/\s+/g, " ").trim()}
                            </p>
                            {product.is_featured ? (
                              <Badge className="mt-1 bg-amber-100 text-amber-800 hover:bg-amber-100">featured</Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={product.status}
                          onChange={(event) =>
                            void updateProduct(product.id, { status: event.target.value as ProductRecord["status"] })
                          }
                        >
                          {statusOptions.map((status) => (
                            <option key={`${product.id}-${status}`} value={status}>
                              {status}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>{resolvePriceRange(sortedVariants)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-center tabular-nums">{product.inventory_qty}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2"
                            aria-label={`Adjust inventory for ${product.title}`}
                            disabled={!singleVariantForInventory}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (singleVariantForInventory) {
                                openInventoryAdjustModal(product.id, singleVariantForInventory, singleVariantForInventory.title?.trim() || product.title);
                              }
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground">
                          {sortedVariants.length} variant{sortedVariants.length === 1 ? "" : "s"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="ml-auto h-7 w-7 p-0"
                              aria-label={`Open actions for ${product.title}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditFlyout(product)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void updateProduct(product.id, { isFeatured: !product.is_featured })}>
                              {product.is_featured ? "Unfeature" : "Feature"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={deletePendingProductId === product.id}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              onClick={() => void deleteProduct(product)}
                            >
                              {deletePendingProductId === product.id ? "Deleting..." : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </section>

        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspector</p>
              <h3 className="text-lg font-semibold">{selectedProduct?.title ?? "No product selected"}</h3>
            </div>
            {selectedProduct ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => openEditFlyout(selectedProduct)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void updateProduct(selectedProduct.id, { isFeatured: !selectedProduct.is_featured })}
                >
                  {selectedProduct.is_featured ? "Unfeature" : "Feature"}
                </Button>
              </div>
            ) : null}
          </div>

          {selectedProduct ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {(["overview", "variants", "inventory", "media"] as const).map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    size="sm"
                    variant={catalogInspectorTab === tab ? "default" : "outline"}
                    onClick={() => setCatalogInspectorTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase()}
                    {tab.slice(1)}
                  </Button>
                ))}
              </div>

              {catalogInspectorTab === "overview" ? (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {richTextToPlainText(selectedProduct.description).replace(/\s+/g, " ").trim() || "No description yet."}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p>
                      <span className="font-medium">Status:</span> {selectedProduct.status}
                    </p>
                    <p>
                      <span className="font-medium">SKU:</span> {selectedProduct.sku ?? "—"}
                    </p>
                    <p>
                      <span className="font-medium">Price range:</span> {resolvePriceRange(sortVariants(selectedProduct.product_variants ?? []))}
                    </p>
                    <p>
                      <span className="font-medium">Inventory:</span> {selectedProduct.inventory_qty}
                    </p>
                  </div>
                </div>
              ) : null}

              {catalogInspectorTab === "variants" ? (() => {
                const sortedVariants = sortVariants(selectedProduct.product_variants ?? []);
                const tierNames = resolveTierNamesForProduct(selectedProduct);
                const tierOneName = tierNames[0] ?? "";
                const tierOneDisplayName = normalizeTierDisplayLabel(tierOneName) || "first option";
                const tierTwoName = tierNames[1] ?? "";
                const groupedVariants = (() => {
                  const groups = new Map<string, { label: string; variants: ProductVariantListItem[] }>();
                  for (const variant of sortedVariants) {
                    const label = tierOneName ? variant.option_values?.[tierOneName] ?? "Unassigned" : "Variants";
                    const key = label.toLowerCase();
                    if (!groups.has(key)) {
                      groups.set(key, { label, variants: [] });
                    }
                    groups.get(key)?.variants.push(variant);
                  }
                  return [...groups.values()];
                })();

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Manage variant-level pricing, stock, and status.</p>
                      <Select value={variantInspectorMode} onChange={(event) => setVariantInspectorMode(event.target.value as "flat" | "grouped")}>
                        <option value="flat">Flat list</option>
                        <option value="grouped">Grouped by {tierOneDisplayName}</option>
                      </Select>
                    </div>

                    {variantInspectorMode === "grouped" && tierOneName ? (
                      <div className="space-y-2">
                        {groupedVariants.map((group) => (
                          <div key={`${selectedProduct.id}-group-${group.label}`} className="rounded-md border border-border p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">
                                {tierOneDisplayName}: {group.label}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openEditFlyout(selectedProduct, {
                                      step: "variant",
                                      variantId: group.variants[0]?.id
                                    })
                                  }
                                >
                                  Edit group
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive"
                                  onClick={() =>
                                    void deleteCatalogVariantGroup(
                                      selectedProduct,
                                      group.variants.map((variant) => variant.id),
                                      group.label
                                    )
                                  }
                                >
                                  Delete group
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {group.variants.map((variant) => (
                                <div key={variant.id} className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-2 py-1.5 text-xs">
                                  <span>{tierTwoName ? variant.option_values?.[tierTwoName] ?? formatVariantLabel(variant) : formatVariantLabel(variant)}</span>
                                  <span className="text-muted-foreground">
                                    {variant.inventory_qty} in stock • {variant.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/35 text-xs text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left">Variant</th>
                              <th className="px-3 py-2 text-left">Price</th>
                              <th className="px-3 py-2 text-left">Inventory</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedVariants.map((variant) => {
                              const variantLabel = formatVariantLabel(variant);
                              return (
                                <tr key={`${selectedProduct.id}-${variant.id}`} className="border-t border-border">
                                  <td className="px-3 py-2">{variantLabel}</td>
                                  <td className="px-3 py-2">${((variant.price_cents ?? 0) / 100).toFixed(2)}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="w-10 text-center tabular-nums">{variant.inventory_qty}</span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2"
                                        onClick={() => openInventoryAdjustModal(selectedProduct.id, variant, variantLabel)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Select
                                      value={variant.status}
                                      onChange={(event) =>
                                        void setCatalogVariantStatus(
                                          selectedProduct,
                                          variant.id,
                                          event.target.value as ProductVariantListItem["status"]
                                        )
                                      }
                                    >
                                      {variantStatusOptions.map((status) => (
                                        <option key={`${variant.id}-status-${status}`} value={status}>
                                          {status}
                                        </option>
                                      ))}
                                    </Select>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() =>
                                            openEditFlyout(selectedProduct, {
                                              step: tierTwoName ? "option" : "variant",
                                              variantId: variant.id
                                            })
                                          }
                                        >
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                          onClick={() => void deleteCatalogVariant(selectedProduct, variant.id, variantLabel)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })() : null}

              {catalogInspectorTab === "inventory" ? (() => {
                const sortedVariants = sortVariants(selectedProduct.product_variants ?? []);
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Inventory totals roll up from variant rows.</p>
                    <div className="rounded-md border border-border p-3 text-sm">
                      <span className="font-medium">Product inventory total:</span> {selectedProduct.inventory_qty}
                    </div>
                    <div className="space-y-2">
                      {sortedVariants.map((variant) => {
                        const variantLabel = formatVariantLabel(variant);
                        return (
                          <div key={`${selectedProduct.id}-inventory-${variant.id}`} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                            <span>{variantLabel}</span>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums">{variant.inventory_qty}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openInventoryAdjustModal(selectedProduct.id, variant, variantLabel)}
                              >
                                Adjust
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : null}

              {catalogInspectorTab === "media" ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Product-level media and variant image coverage.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedProduct.image_urls ?? []).slice(0, 6).map((imageUrl) => (
                      <div key={`${selectedProduct.id}-media-${imageUrl}`} className="relative aspect-square overflow-hidden rounded-md border border-border">
                        <Image src={imageUrl} alt={`${selectedProduct.title} image`} fill unoptimized className="object-cover" />
                      </div>
                    ))}
                    {(selectedProduct.image_urls ?? []).length === 0 ? (
                      <p className="col-span-3 text-sm text-muted-foreground">No product images uploaded.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a product to inspect and edit details.</p>
          )}
        </section>
      </div>
      </section>

      <Flyout
        open={isCreateFlyoutOpen}
        onOpenChange={handleCreateFlyoutOpenChange}
        confirmDiscardOnClose
        isDirty={isCreateDirty}
        onDiscardConfirm={resetCreateComposer}
        discardTitle="Discard product changes?"
        discardDescription="Are you sure you want to discard your changes?"
        title={createFlyoutTitle}
        description={createFlyoutDescription}
        footer={createFlyoutFooter}
      >
        <form id="create-product-form" onSubmit={createProduct} className="space-y-3">
          <div className="overflow-x-hidden overflow-y-visible py-1">
            <div>
                <div
                  key={`create-step-0-${createStepMotionKey}`}
                  ref={(node) => {
                    if (createStepIndex === 0) {
                      createActivePanelRef.current = node;
                    }
                  }}
                  className={createStepIndex === 0 ? "w-full space-y-3 pl-1 pr-3" : "hidden"}
                >
                <FormField label="Title">
                  <Input required minLength={2} placeholder="Everyday Hand Cream" value={title} onChange={(event) => setTitle(event.target.value)} />
                </FormField>
                <FormField label="Description">
                  <RichTextEditor
                    required
                    minLength={1}
                    rows={6}
                    placeholder="Describe ingredients, scent profile, and how to use."
                    value={description}
                    onChange={setDescription}
                    previewLabel="Description preview"
                    imageUpload={{ folder: "products/rich-text" }}
                  />
                </FormField>
                <FormField label="Slug" description="Optional. Leave blank to auto-generate from title.">
                  <Input placeholder="everyday-hand-cream" value={productSlug} onChange={(event) => setProductSlug(event.target.value)} />
                </FormField>
                <FormField label="SEO Title" description="Optional override used in page metadata.">
                  <Input maxLength={120} placeholder="Everyday Hand Cream | Sunset Mercantile" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
                </FormField>
                <FormField label="SEO Description" description="Optional override for meta description.">
                  <Input
                    maxLength={320}
                    placeholder="A lightweight hand cream for everyday moisture and a clean finish."
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                  />
                </FormField>
                <FormField label="Primary Image Alt Text" description="Describe the product image for accessibility and SEO.">
                  <Input
                    maxLength={240}
                    placeholder="Minimal tube of hand cream beside a folded towel."
                    value={imageAltText}
                    onChange={(event) => setImageAltText(event.target.value)}
                  />
                </FormField>
                <label className="flex items-center gap-2">
                  <Checkbox checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} />
                  <span className="text-sm font-medium">Featured product</span>
                </label>
                <FormField label="Image">
                  <input
                    ref={createImageInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={async (event) => {
                      const files = [...(event.target.files ?? [])];
                      if (files.length === 0) {
                        return;
                      }

                      try {
                        const uploaded = await uploadProductImages(files);
                        setCreateImageUrls((current) => [...new Set([...current, ...uploaded])]);
                      } catch (uploadError) {
                        setCreateError(uploadError instanceof Error ? uploadError.message : "Unable to upload product image.");
                      } finally {
                        event.target.value = "";
                      }
                    }}
                  />
                  <input
                    ref={createReplaceImageInputRef}
                    type="file"
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      const targetIndex = createReplaceImageIndex;

                      if (!file || targetIndex === null) {
                        event.target.value = "";
                        return;
                      }

                      try {
                        const uploaded = await uploadProductImage(file);
                        setCreateImageUrls((current) =>
                          current.map((imageUrl, index) => (index === targetIndex ? uploaded : imageUrl))
                        );
                      } catch (uploadError) {
                        setCreateError(uploadError instanceof Error ? uploadError.message : "Unable to upload product image.");
                      } finally {
                        setCreateReplaceImageIndex(null);
                        event.target.value = "";
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {createImageUrls.map((imageUrl, imageIndex) => (
                      <div
                        key={`create-product-image-${imageUrl}-${imageIndex}`}
                        className={`group relative h-24 w-24 cursor-grab overflow-hidden rounded-md border border-border bg-muted/15 transition-transform hover:scale-[1.02] active:cursor-grabbing ${createDragOverImageIndex === imageIndex && createDraggingImageIndex !== imageIndex ? "ring-2 ring-primary/70 ring-offset-1" : ""}`}
                        draggable
                        onDragStart={(event) => beginImageTileDrag(event, imageIndex, "create")}
                        onDragEnd={() => {
                          setCreateDraggingImageIndex(null);
                          setCreateDragOverImageIndex(null);
                          setTimeout(() => {
                            createSuppressNextImageClickRef.current = false;
                          }, 0);
                        }}
                        onDragEnter={() => {
                          if (createDraggingImageIndex !== null && createDraggingImageIndex !== imageIndex) {
                            setCreateDragOverImageIndex(imageIndex);
                          }
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDragLeave={() => {
                          if (createDragOverImageIndex === imageIndex) {
                            setCreateDragOverImageIndex(null);
                          }
                        }}
                        onDrop={() => {
                          if (createDraggingImageIndex === null) {
                            return;
                          }
                          createSuppressNextImageClickRef.current = true;
                          setCreateImageUrls((current) => reorderImageUrls(current, createDraggingImageIndex, imageIndex));
                          setCreateDraggingImageIndex(null);
                          setCreateDragOverImageIndex(null);
                        }}
                        onClick={() => {
                          if (createSuppressNextImageClickRef.current) {
                            createSuppressNextImageClickRef.current = false;
                            return;
                          }
                          setCreateReplaceImageIndex(imageIndex);
                          createReplaceImageInputRef.current?.click();
                        }}
                      >
                        <Image src={imageUrl} alt="Product image preview" fill unoptimized className="object-cover" />
                        <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <Pencil className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" />
                        </div>
                        <button
                          type="button"
                          className="absolute left-1 top-1 rounded-full bg-white/90 p-1 text-amber-500 transition hover:bg-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCreateImageUrls((current) => promotePrimaryImage(current, imageIndex));
                          }}
                          aria-label={imageIndex === 0 ? "Primary image" : "Set as primary image"}
                          title={imageIndex === 0 ? "Primary image" : "Set as primary image"}
                        >
                          <Star className={`h-3.5 w-3.5 ${imageIndex === 0 ? "fill-current" : ""}`} />
                        </button>
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCreateImageUrls((current) => current.filter((_, index) => index !== imageIndex));
                          }}
                          aria-label="Remove product image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
                      onClick={() => createImageInputRef.current?.click()}
                      aria-label="Upload image"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </FormField>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={createHasVariants}
                      onChange={(event) => {
                        const nextValue = event.target.checked;
                        setCreateHasVariants(nextValue);
                        transitionCreateStep("product");
                        setCreateActiveVariantIndex(null);
                        setCreateVariantSnapshot(null);
                        setCreateOptionSnapshot(null);
                        if (nextValue) {
                          const restored = createVariantsSnapshotByMode ? cloneVariantDrafts(createVariantsSnapshotByMode) : null;
                          if (restored && restored.length > 0 && hasStructuredVariantDrafts(restored)) {
                            setCreateVariants(normalizeVariantDefaults(restored));
                            const restoredTierCount = restored.some((variant) => variant.optionPairs.length >= 2) ? 2 : 1;
                            setCreateVariantTierCount(restoredTierCount);
                          } else {
                            setCreateVariants([]);
                            setCreateVariantTierCount(1);
                          }
                        } else {
                          const snapshotSource = cloneVariantDrafts(createVariants);
                          setCreateVariantsSnapshotByMode(hasStructuredVariantDrafts(snapshotSource) ? snapshotSource : null);
                          const baseVariant = pickPrimaryVariant(createVariants);
                          setSku((current) => current || baseVariant.sku);
                          setCreateSingleSkuMode(baseVariant.sku.trim() ? "manual" : "auto");
                          setCreateSinglePriceDollars(baseVariant.priceDollars || "0.00");
                          setCreateSingleInventoryQty(baseVariant.inventoryQty || "0");
                          setCreateSingleMadeToOrder(baseVariant.isMadeToOrder ?? false);
                          setCreateVariants([{ ...baseVariant, optionPairs: [] }]);
                        }
                      }}
                    />
                    <span className="text-sm font-medium">Has variants</span>
                  </label>
                  {createHasVariants ? (
                    <Button type="button" variant="outline" size="sm" onClick={addCreateVariantFromProductView}>
                      Add variant
                    </Button>
                  ) : null}
                </div>

                {createHasVariants ? (
                  <div className="space-y-3 rounded-md border border-border bg-white p-3">
                    <p className="text-sm font-medium">Variants</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Create variants, then define option names and values inside each variant.</p>
                        {createVariantError ? <p className="text-xs font-medium text-destructive">{createVariantError}</p> : null}
                      </div>
                      {createVariantGroups.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No variants yet.</p>
                      ) : (
                        createVariantGroups.map((group, index) => (
                          <div key={`create-group-${group.key}-${index}`} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2">
                            <div>
                              <p className="text-sm font-medium">{group.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {createVariantTierCount === 2 ? `${group.indexes.length} ${createTierTwoLabel.toLowerCase()} options` : "1 option"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {group.indexes.some((variantIndex) => createVariants[variantIndex]?.status === "archived") ? (
                                <Badge variant="secondary">archived</Badge>
                              ) : null}
                              <Button type="button" variant="outline" size="sm" onClick={() => openCreateVariantEditor(group.indexes[0] ?? 0)}>
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateCreateVariantStatuses(
                                    group.indexes,
                                    group.indexes.some((variantIndex) => createVariants[variantIndex]?.status === "archived")
                                      ? "active"
                                      : "archived"
                                  )
                                }
                              >
                                {group.indexes.some((variantIndex) => createVariants[variantIndex]?.status === "archived")
                                  ? "Unarchive"
                                  : "Archive"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => removeCreateVariants(group.indexes, `variant "${group.label}"`)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FormField label="SKU">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="BALM-LAVENDER"
                          value={createSingleSkuValue}
                          readOnly={createSingleSkuMode === "auto"}
                          onChange={(event) => {
                            setCreateSingleSkuMode("manual");
                            setSku(event.target.value);
                          }}
                        />
                        {createSingleSkuMode === "auto" ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Override SKU"
                            title="Override SKU"
                            onClick={() => {
                              setCreateSingleSkuMode("manual");
                              setSku(createSingleAutoSku);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Reset SKU to auto"
                            title="Reset SKU to auto"
                            onClick={() => setCreateSingleSkuMode("auto")}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </FormField>
                    <FormField label="Price">
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={createSinglePriceDollars}
                        onChange={(event) => setCreateSinglePriceDollars(event.target.value)}
                      />
                    </FormField>
                    <FormField label="Inventory">
                      <Input inputMode="numeric" placeholder="0" value={createSingleInventoryQty} onChange={(event) => setCreateSingleInventoryQty(event.target.value)} />
                    </FormField>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={createSingleMadeToOrder} onChange={(event) => setCreateSingleMadeToOrder(event.target.checked)} />
                      <span className="text-sm font-medium">Enable made to order</span>
                    </label>
                  </div>
                )}
                </div>

                <div
                  key={`create-step-1-${createStepMotionKey}`}
                  ref={(node) => {
                    if (createStepIndex === 1) {
                      createActivePanelRef.current = node;
                    }
                  }}
                  className={createStepIndex === 1 ? "w-full space-y-3 px-3" : "hidden"}
                >
                {activeCreateVariant ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Variant details</p>
                      {createVariantError ? <p className="text-xs font-medium text-destructive">{createVariantError}</p> : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Option name">
                      <Input
                        placeholder="e.g. Scent"
                        value={activeCreateLevelOneName}
                        onChange={(event) => {
                          const nextName = event.target.value;
                          const previousName = activeCreateLevelOneName;
                          setCreateOptionOneName(nextName);
                          setCreateVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                activeCreateGroupIndexes.includes(index)
                                  ? !previousName.trim()
                                    ? nextName.trim()
                                      ? setOptionValue(variant, nextName, variant.optionPairs[0]?.value ?? "")
                                      : variant
                                    : !nextName.trim()
                                      ? removeOptionName(variant, previousName)
                                      : renameOptionName(variant, previousName, nextName)
                                  : variant
                              )
                            )
                          );
                        }}
                      />
                    </FormField>
                    <FormField label="Option value">
                      <Input
                        placeholder={activeCreateLevelOneName.trim() ? `e.g. ${activeCreateLevelOneName} value` : "Set option name first"}
                        value={activeCreateLevelOneValue}
                        disabled={!activeCreateLevelOneName.trim()}
                        onChange={(event) =>
                          setCreateVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                activeCreateGroupIndexes.includes(index) ? setOptionValue(variant, activeCreateLevelOneName, event.target.value) : variant
                              )
                            )
                          )
                        }
                      />
                    </FormField>
                    </div>
                    <FormField label="Variant image (optional)">
                      <input
                        id={`create-variant-group-image-${activeCreateGroupImageIndex ?? "none"}`}
                        type="file"
                        className="hidden"
                        multiple
                        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={async (event) => {
                          const files = [...(event.target.files ?? [])];
                          if (files.length === 0) {
                            return;
                          }

                          try {
                            const uploadedUrls = await uploadProductImages(files);
                            setCreateVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  activeCreateHasSubOptions
                                    ? activeCreateGroupIndexes.includes(index)
                                      ? { ...variant, groupImageUrls: [...new Set([...(variant.groupImageUrls ?? []), ...uploadedUrls])] }
                                      : variant
                                    : index === createActiveVariantIndex
                                      ? { ...variant, imageUrls: [...new Set([...(variant.imageUrls ?? []), ...uploadedUrls])] }
                                      : variant
                                )
                              )
                            );
                          } catch (uploadError) {
                            setCreateVariantError(uploadError instanceof Error ? uploadError.message : "Unable to upload variant image.");
                          } finally {
                            event.target.value = "";
                          }
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        {activeCreateVariantImageUrls.map((imageUrl, imageIndex) => (
                          <div key={`create-variant-group-image-preview-${imageUrl}-${imageIndex}`} className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted/15">
                            <Image src={imageUrl} alt="Variant image preview" fill unoptimized className="object-cover" />
                            <button
                              type="button"
                              className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
                              onClick={() =>
                                setCreateVariants((current) =>
                                  normalizeVariantDefaults(
                                    current.map((variant, index) =>
                                      activeCreateHasSubOptions
                                        ? activeCreateGroupIndexes.includes(index)
                                          ? {
                                              ...variant,
                                              groupImageUrls: (variant.groupImageUrls ?? []).filter((_, currentIndex) => currentIndex !== imageIndex)
                                            }
                                          : variant
                                        : index === createActiveVariantIndex
                                          ? {
                                              ...variant,
                                              imageUrls: (variant.imageUrls ?? []).filter((_, currentIndex) => currentIndex !== imageIndex)
                                            }
                                          : variant
                                    )
                                  )
                                )
                              }
                              aria-label="Remove variant image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <label
                          htmlFor={`create-variant-group-image-${activeCreateGroupImageIndex ?? "none"}`}
                          className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
                        >
                          <Plus className="h-5 w-5" />
                        </label>
                      </div>
                    </FormField>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={activeCreateHasSubOptions}
                          onChange={(event) => setCreateSubOptionsEnabled(event.target.checked)}
                        />
                        <span className="text-sm font-medium">Has options</span>
                      </label>
                      {activeCreateHasSubOptions ? (
                        <Button type="button" variant="outline" size="sm" onClick={addCreateTierTwoOption}>
                          Add option
                        </Button>
                      ) : null}
                    </div>
                    {!activeCreateHasSubOptions ? (
                      <>
                        <FormField label="SKU">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="BALM-LAVENDER"
                              value={activeCreateSkuValue}
                              readOnly={activeCreateVariant.skuMode === "auto"}
                              onChange={(event) =>
                                setCreateVariants((current) =>
                                  normalizeVariantDefaults(
                                    current.map((variant, index) =>
                                      index === createActiveVariantIndex
                                        ? { ...variant, skuMode: "manual", sku: event.target.value }
                                        : variant
                                    )
                                  )
                                )
                              }
                            />
                            {activeCreateVariant.skuMode === "auto" ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label="Override SKU"
                                title="Override SKU"
                                onClick={() =>
                                  setCreateVariants((current) =>
                                    normalizeVariantDefaults(
                                      current.map((variant, index) =>
                                        index === createActiveVariantIndex ? { ...variant, skuMode: "manual", sku: activeCreateAutoSku } : variant
                                      )
                                    )
                                  )
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label="Reset SKU to auto"
                                title="Reset SKU to auto"
                                onClick={() =>
                                  setCreateVariants((current) =>
                                    normalizeVariantDefaults(
                                      current.map((variant, index) =>
                                        index === createActiveVariantIndex
                                          ? { ...variant, skuMode: "auto", sku: buildDefaultVariantSku(variant, createSkuBase, index) }
                                          : variant
                                      )
                                    )
                                  )
                                }
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </FormField>
                        <FormField label="Price">
                          <Input
                            inputMode="decimal"
                            placeholder="0.00"
                            value={activeCreateVariant.priceDollars}
                            onChange={(event) =>
                              setCreateVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === createActiveVariantIndex ? { ...variant, priceDollars: event.target.value } : variant
                                  )
                                )
                              )
                            }
                          />
                        </FormField>
                        <FormField label="Inventory">
                          <Input
                            inputMode="numeric"
                            placeholder="0"
                            value={activeCreateVariant.inventoryQty}
                            onChange={(event) =>
                              setCreateVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === createActiveVariantIndex ? { ...variant, inventoryQty: event.target.value } : variant
                                  )
                                )
                              )
                            }
                          />
                        </FormField>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={activeCreateVariant.isMadeToOrder}
                            onChange={(event) =>
                              setCreateVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === createActiveVariantIndex ? { ...variant, isMadeToOrder: event.target.checked } : variant
                                  )
                                )
                              )
                            }
                          />
                          <span className="text-sm font-medium">Enable made to order</span>
                        </label>
                      </>
                    ) : (
                      <div className="space-y-3 rounded-md border border-border bg-white p-3">
                        <p className="text-sm font-medium">Options</p>
                        <p className="text-sm text-muted-foreground">Add options for this variant, then configure price, SKU, inventory, and images for each option.</p>
                        <div className="space-y-2">
                          {activeCreateSubOptionIndexes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No options yet.</p>
                          ) : null}
                          {activeCreateSubOptionIndexes.map((index) => {
                            const option = createVariants[index];
                            if (!option) {
                              return null;
                            }

                            return (
                              <div key={`create-tier2-${index}`} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2">
                                <div>
                                  <p className="text-sm font-medium">{getOptionValue(option, activeCreateLevelTwoName) || `${activeCreateLevelTwoName} option`}</p>
                                  <p className="text-xs text-muted-foreground">
                                    ${option.priceDollars || "0.00"} · Inv {option.inventoryQty || "0"} · {option.status}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button type="button" variant="outline" size="sm" onClick={() => openCreateOptionEditor(index)}>
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateCreateVariantStatuses([index], option.status === "archived" ? "active" : "archived")}
                                  >
                                    {option.status === "archived" ? "Unarchive" : "Archive"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                      if (activeCreateSubOptionIndexes.length <= 1) {
                                        setCreateSubOptionsEnabled(false);
                                        return;
                                      }
                                      void removeCreateVariants([index], "option");
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select or add a variant from the product view.</p>
                )}
                </div>

                <div
                  key={`create-step-2-${createStepMotionKey}`}
                  ref={(node) => {
                    if (createStepIndex === 2) {
                      createActivePanelRef.current = node;
                    }
                  }}
                  className={createStepIndex === 2 ? "w-full space-y-3 pl-3 pr-1" : "hidden"}
                >
                {activeCreateVariant ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Option details</p>
                      {createVariantError ? <p className="text-xs font-medium text-destructive">{createVariantError}</p> : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="Option name">
                        <Input
                          placeholder="e.g. Size"
                          value={activeCreateLevelTwoName}
                          onChange={(event) => {
                            const nextName = event.target.value;
                            const previousName = activeCreateLevelTwoName;
                            setCreateOptionTwoName(nextName);
                            if (!nextName.trim()) {
                              return;
                            }
                            setCreateVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  activeCreateGroupIndexes.includes(index) ? renameOptionName(variant, previousName, nextName) : variant
                                )
                              )
                            );
                          }}
                        />
                      </FormField>
                      <FormField label="Option value">
                        <Input
                          placeholder={`${activeCreateLevelTwoName} value`}
                          value={getOptionValue(activeCreateVariant, activeCreateLevelTwoName)}
                          onChange={(event) =>
                            setCreateVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  index === createActiveVariantIndex ? setOptionValue(variant, activeCreateLevelTwoName, event.target.value) : variant
                                )
                              )
                            )
                          }
                        />
                      </FormField>
                    </div>
                    <FormField label="Option image (optional)">
                      <input
                        id={`create-option-image-${createActiveVariantIndex ?? "none"}`}
                        type="file"
                        className="hidden"
                        multiple
                        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={async (event) => {
                          const files = [...(event.target.files ?? [])];
                          if (files.length === 0) {
                            return;
                          }

                          try {
                            const uploadedUrls = await uploadProductImages(files);
                            setCreateVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  index === createActiveVariantIndex
                                    ? { ...variant, imageUrls: [...new Set([...(variant.imageUrls ?? []), ...uploadedUrls])] }
                                    : variant
                                )
                              )
                            );
                          } catch (uploadError) {
                            setCreateVariantError(uploadError instanceof Error ? uploadError.message : "Unable to upload option image.");
                          } finally {
                            event.target.value = "";
                          }
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        {activeCreateVariant.imageUrls.map((imageUrl, imageIndex) => (
                          <div key={`create-option-image-preview-${imageUrl}-${imageIndex}`} className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted/15">
                            <Image src={imageUrl} alt="Option image preview" fill unoptimized className="object-cover" />
                            <button
                              type="button"
                              className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
                              onClick={() =>
                                setCreateVariants((current) =>
                                  normalizeVariantDefaults(
                                    current.map((variant, index) =>
                                      index === createActiveVariantIndex
                                        ? { ...variant, imageUrls: (variant.imageUrls ?? []).filter((_, currentIndex) => currentIndex !== imageIndex) }
                                        : variant
                                    )
                                  )
                                )
                              }
                              aria-label="Remove option image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <label
                          htmlFor={`create-option-image-${createActiveVariantIndex ?? "none"}`}
                          className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
                        >
                          <Plus className="h-5 w-5" />
                        </label>
                      </div>
                    </FormField>
                    <FormField label="SKU">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="BALM-LAVENDER-2OZ"
                          value={activeCreateSkuValue}
                          readOnly={activeCreateVariant.skuMode === "auto"}
                          onChange={(event) =>
                            setCreateVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  index === createActiveVariantIndex
                                    ? { ...variant, skuMode: "manual", sku: event.target.value }
                                    : variant
                                )
                              )
                            )
                          }
                        />
                        {activeCreateVariant.skuMode === "auto" ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Override SKU"
                            title="Override SKU"
                            onClick={() =>
                              setCreateVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === createActiveVariantIndex ? { ...variant, skuMode: "manual", sku: activeCreateAutoSku } : variant
                                  )
                                )
                              )
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Reset SKU to auto"
                            title="Reset SKU to auto"
                            onClick={() =>
                              setCreateVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === createActiveVariantIndex
                                      ? { ...variant, skuMode: "auto", sku: buildDefaultVariantSku(variant, createSkuBase, index) }
                                      : variant
                                  )
                                )
                              )
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </FormField>
                    <FormField label="Price">
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={activeCreateVariant.priceDollars}
                        onChange={(event) =>
                          setCreateVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                index === createActiveVariantIndex ? { ...variant, priceDollars: event.target.value } : variant
                              )
                            )
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Inventory">
                      <Input
                        inputMode="numeric"
                        placeholder="0"
                        value={activeCreateVariant.inventoryQty}
                        onChange={(event) =>
                          setCreateVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                index === createActiveVariantIndex ? { ...variant, inventoryQty: event.target.value } : variant
                              )
                            )
                          )
                        }
                      />
                    </FormField>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={activeCreateVariant.isMadeToOrder}
                        onChange={(event) =>
                          setCreateVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                index === createActiveVariantIndex ? { ...variant, isMadeToOrder: event.target.checked } : variant
                              )
                            )
                          )
                        }
                      />
                      <span className="text-sm font-medium">Enable made to order</span>
                    </label>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select an option to configure.</p>
                )}
                </div>
            </div>
          </div>
        </form>
      </Flyout>

      <Flyout
        open={isEditFlyoutOpen}
        onOpenChange={handleEditFlyoutOpenChange}
        confirmDiscardOnClose
        isDirty={isEditDirty}
        onDiscardConfirm={resetEditComposer}
        discardTitle="Discard product changes?"
        discardDescription="Are you sure you want to discard your changes?"
        title={editFlyoutTitle}
        description={editFlyoutDescription}
        footer={editFlyoutFooter}
      >
        <form id="edit-product-form" onSubmit={saveEditedProduct} className="space-y-3">
          {isEditReadOnly ? (
            <p className="rounded-md border border-border bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
              Archived products are read-only. Unarchive from the catalog list to make edits.
            </p>
          ) : null}
          <div className="overflow-x-hidden overflow-y-visible py-1">
            <fieldset disabled={isEditReadOnly || editPending} className="space-y-0">
            <div>
                <div
                  key={`edit-step-0-${editStepMotionKey}`}
                  ref={(node) => {
                    if (editStepIndex === 0) {
                      editActivePanelRef.current = node;
                    }
                  }}
                  className={editStepIndex === 0 ? "w-full space-y-3 pl-1 pr-3" : "hidden"}
                >
                <FormField label="Title">
                  <Input required minLength={2} placeholder="Everyday Hand Cream" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                </FormField>
                <FormField label="Description">
                  <RichTextEditor
                    required
                    minLength={1}
                    rows={6}
                    placeholder="Describe ingredients, scent profile, and how to use."
                    value={editDescription}
                    onChange={setEditDescription}
                    previewLabel="Description preview"
                    disabled={isEditReadOnly || editPending}
                    imageUpload={{ folder: "products/rich-text" }}
                  />
                </FormField>
                <FormField label="Slug" description="Optional. Leave blank to auto-generate from title.">
                  <Input
                    placeholder="everyday-hand-cream"
                    value={editProductSlug}
                    onChange={(event) => setEditProductSlug(event.target.value)}
                    disabled={isEditReadOnly || editPending}
                  />
                </FormField>
                <FormField label="SEO Title" description="Optional override used in page metadata.">
                  <Input
                    maxLength={120}
                    placeholder="Everyday Hand Cream | Sunset Mercantile"
                    value={editSeoTitle}
                    onChange={(event) => setEditSeoTitle(event.target.value)}
                    disabled={isEditReadOnly || editPending}
                  />
                </FormField>
                <FormField label="SEO Description" description="Optional override for meta description.">
                  <Input
                    maxLength={320}
                    placeholder="A lightweight hand cream for everyday moisture and a clean finish."
                    value={editSeoDescription}
                    onChange={(event) => setEditSeoDescription(event.target.value)}
                    disabled={isEditReadOnly || editPending}
                  />
                </FormField>
                <FormField label="Primary Image Alt Text" description="Describe the product image for accessibility and SEO.">
                  <Input
                    maxLength={240}
                    placeholder="Minimal tube of hand cream beside a folded towel."
                    value={editImageAltText}
                    onChange={(event) => setEditImageAltText(event.target.value)}
                    disabled={isEditReadOnly || editPending}
                  />
                </FormField>
                <FormField label="Status">
                  <Select value={editStatus} onChange={(event) => setEditStatus(event.target.value as ProductRecord["status"])}>
                    {statusOptions.map((status) => (
                      <option key={`edit-status-${status}`} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <label className="flex items-center gap-2">
                  <Checkbox checked={editIsFeatured} onChange={(event) => setEditIsFeatured(event.target.checked)} />
                  <span className="text-sm font-medium">Featured product</span>
                </label>
                <FormField label="Image">
                  <input
                    ref={editImageInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={async (event) => {
                      const files = [...(event.target.files ?? [])];
                      if (files.length === 0) {
                        return;
                      }

                      try {
                        const uploaded = await uploadProductImages(files);
                        setEditImageUrls((current) => [...new Set([...current, ...uploaded])]);
                      } catch (uploadError) {
                        setEditError(uploadError instanceof Error ? uploadError.message : "Unable to upload product image.");
                      } finally {
                        event.target.value = "";
                      }
                    }}
                  />
                  <input
                    ref={editReplaceImageInputRef}
                    type="file"
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      const targetIndex = editReplaceImageIndex;

                      if (!file || targetIndex === null) {
                        event.target.value = "";
                        return;
                      }

                      try {
                        const uploaded = await uploadProductImage(file);
                        setEditImageUrls((current) =>
                          current.map((imageUrl, index) => (index === targetIndex ? uploaded : imageUrl))
                        );
                      } catch (uploadError) {
                        setEditError(uploadError instanceof Error ? uploadError.message : "Unable to upload product image.");
                      } finally {
                        setEditReplaceImageIndex(null);
                        event.target.value = "";
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {editImageUrls.map((imageUrl, imageIndex) => (
                      <div
                        key={`edit-product-image-${imageUrl}-${imageIndex}`}
                        className={`group relative h-24 w-24 cursor-grab overflow-hidden rounded-md border border-border bg-muted/15 transition-transform hover:scale-[1.02] active:cursor-grabbing ${editDragOverImageIndex === imageIndex && editDraggingImageIndex !== imageIndex ? "ring-2 ring-primary/70 ring-offset-1" : ""}`}
                        draggable
                        onDragStart={(event) => beginImageTileDrag(event, imageIndex, "edit")}
                        onDragEnd={() => {
                          setEditDraggingImageIndex(null);
                          setEditDragOverImageIndex(null);
                          setTimeout(() => {
                            editSuppressNextImageClickRef.current = false;
                          }, 0);
                        }}
                        onDragEnter={() => {
                          if (editDraggingImageIndex !== null && editDraggingImageIndex !== imageIndex) {
                            setEditDragOverImageIndex(imageIndex);
                          }
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDragLeave={() => {
                          if (editDragOverImageIndex === imageIndex) {
                            setEditDragOverImageIndex(null);
                          }
                        }}
                        onDrop={() => {
                          if (editDraggingImageIndex === null) {
                            return;
                          }
                          editSuppressNextImageClickRef.current = true;
                          setEditImageUrls((current) => reorderImageUrls(current, editDraggingImageIndex, imageIndex));
                          setEditDraggingImageIndex(null);
                          setEditDragOverImageIndex(null);
                        }}
                        onClick={() => {
                          if (editSuppressNextImageClickRef.current) {
                            editSuppressNextImageClickRef.current = false;
                            return;
                          }
                          setEditReplaceImageIndex(imageIndex);
                          editReplaceImageInputRef.current?.click();
                        }}
                      >
                        <Image src={imageUrl} alt="Edited product image preview" fill unoptimized className="object-cover" />
                        <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <Pencil className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" />
                        </div>
                        <button
                          type="button"
                          className="absolute left-1 top-1 rounded-full bg-white/90 p-1 text-amber-500 transition hover:bg-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditImageUrls((current) => promotePrimaryImage(current, imageIndex));
                          }}
                          aria-label={imageIndex === 0 ? "Primary image" : "Set as primary image"}
                          title={imageIndex === 0 ? "Primary image" : "Set as primary image"}
                        >
                          <Star className={`h-3.5 w-3.5 ${imageIndex === 0 ? "fill-current" : ""}`} />
                        </button>
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditImageUrls((current) => current.filter((_, index) => index !== imageIndex));
                          }}
                          aria-label="Remove image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
                      onClick={() => editImageInputRef.current?.click()}
                      aria-label="Upload image"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </FormField>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={editHasVariants}
                      onChange={(event) => {
                        const nextValue = event.target.checked;
                        setEditHasVariants(nextValue);
                        transitionEditStep("product");
                        setEditActiveVariantIndex(null);
                        setEditVariantSnapshot(null);
                        setEditOptionSnapshot(null);
                        if (nextValue) {
                          const restored = editVariantsSnapshotByMode ? cloneVariantDrafts(editVariantsSnapshotByMode) : null;
                          if (restored && restored.length > 0 && hasStructuredVariantDrafts(restored)) {
                            setEditVariants(normalizeVariantDefaults(restored));
                            const restoredTierCount = restored.some((variant) => variant.optionPairs.length >= 2) ? 2 : 1;
                            setEditVariantTierCount(restoredTierCount);
                          } else {
                            setEditVariants([]);
                            setEditVariantTierCount(1);
                          }
                        } else {
                          const snapshotSource = cloneVariantDrafts(editVariants);
                          setEditVariantsSnapshotByMode(hasStructuredVariantDrafts(snapshotSource) ? snapshotSource : null);
                          const baseVariant = pickPrimaryVariant(editVariants);
                          setEditSku((current) => current || baseVariant.sku);
                          setEditSingleInventoryQty(baseVariant.inventoryQty || "0");
                          setEditSingleMadeToOrder(baseVariant.isMadeToOrder ?? false);
                          setEditVariants([{ ...baseVariant, optionPairs: [] }]);
                        }
                      }}
                    />
                    <span className="text-sm font-medium">Has variants</span>
                  </label>
                  {editHasVariants ? (
                    <Button type="button" variant="outline" size="sm" onClick={addEditVariantFromProductView}>
                      Add variant
                    </Button>
                  ) : null}
                </div>

                {editHasVariants ? (
                  <div className="space-y-3 rounded-md border border-border bg-white p-3">
                    <p className="text-sm font-medium">Variants</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Create variants, then define option names and values inside each variant.</p>
                        {editVariantError ? <p className="text-xs font-medium text-destructive">{editVariantError}</p> : null}
                      </div>
                      {editVariantGroups.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No variants yet.</p>
                      ) : (
                        editVariantGroups.map((group, index) => (
                          <div key={`edit-group-${group.key}-${index}`} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2">
                            <div>
                              <p className="text-sm font-medium">{group.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {editVariantTierCount === 2 ? `${group.indexes.length} ${editTierTwoLabel.toLowerCase()} options` : "1 option"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {group.indexes.some((variantIndex) => editVariants[variantIndex]?.status === "archived") ? (
                                <Badge variant="secondary">archived</Badge>
                              ) : null}
                              <Button type="button" variant="outline" size="sm" onClick={() => openEditVariantEditor(group.indexes[0] ?? 0)}>
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateEditVariantStatuses(
                                    group.indexes,
                                    group.indexes.some((variantIndex) => editVariants[variantIndex]?.status === "archived")
                                      ? "active"
                                      : "archived"
                                  )
                                }
                              >
                                {group.indexes.some((variantIndex) => editVariants[variantIndex]?.status === "archived")
                                  ? "Unarchive"
                                  : "Archive"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => removeEditVariants(group.indexes, `variant "${group.label}"`)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FormField label="SKU">
                      <Input
                        value={editSku}
                        placeholder={buildSkuFromParts(editTitle.trim() || "SKU", ["1"])}
                        onChange={(event) => setEditSku(event.target.value)}
                      />
                    </FormField>
                    <FormField label="Inventory">
                      <Input inputMode="numeric" placeholder="0" value={editSingleInventoryQty} onChange={(event) => setEditSingleInventoryQty(event.target.value)} />
                    </FormField>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={editSingleMadeToOrder} onChange={(event) => setEditSingleMadeToOrder(event.target.checked)} />
                      <span className="text-sm font-medium">Enable made to order</span>
                    </label>
                  </div>
                )}
                </div>

                <div
                  key={`edit-step-1-${editStepMotionKey}`}
                  ref={(node) => {
                    if (editStepIndex === 1) {
                      editActivePanelRef.current = node;
                    }
                  }}
                  className={editStepIndex === 1 ? "w-full space-y-3 px-3" : "hidden"}
                >
                {activeEditVariant ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Variant details</p>
                      {editVariantError ? <p className="text-xs font-medium text-destructive">{editVariantError}</p> : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Option name">
                      <Input
                        placeholder="e.g. Scent"
                        value={activeEditLevelOneName}
                        disabled={activeEditGroupHasOrderedVariant}
                        onChange={(event) => {
                          const nextName = event.target.value;
                          const previousName = activeEditLevelOneName;
                          setEditOptionOneName(nextName);
                          setEditVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                activeEditGroupIndexes.includes(index)
                                  ? !previousName.trim()
                                    ? nextName.trim()
                                      ? setOptionValue(variant, nextName, variant.optionPairs[0]?.value ?? "")
                                      : variant
                                    : !nextName.trim()
                                      ? removeOptionName(variant, previousName)
                                      : renameOptionName(variant, previousName, nextName)
                                  : variant
                              )
                            )
                          );
                        }}
                      />
                    </FormField>
                    <FormField label="Option value">
                      <Input
                        placeholder={activeEditLevelOneName.trim() ? `e.g. ${activeEditLevelOneName} value` : "Set option name first"}
                        value={activeEditLevelOneValue}
                        disabled={activeEditGroupHasOrderedVariant || !activeEditLevelOneName.trim()}
                        onChange={(event) =>
                          setEditVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                activeEditGroupIndexes.includes(index) ? setOptionValue(variant, activeEditLevelOneName, event.target.value) : variant
                              )
                            )
                          )
                        }
                      />
                    </FormField>
                    </div>
                    <FormField label="Variant image (optional)">
                      <input
                        id={`edit-variant-group-image-${activeEditGroupImageIndex ?? "none"}`}
                        type="file"
                        className="hidden"
                        multiple
                        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={async (event) => {
                          const files = [...(event.target.files ?? [])];
                          if (files.length === 0) {
                            return;
                          }

                          try {
                            const uploadedUrls = await uploadProductImages(files);
                            setEditVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  activeEditHasSubOptions
                                    ? activeEditGroupIndexes.includes(index)
                                      ? { ...variant, groupImageUrls: [...new Set([...(variant.groupImageUrls ?? []), ...uploadedUrls])] }
                                      : variant
                                    : index === editActiveVariantIndex
                                      ? { ...variant, imageUrls: [...new Set([...(variant.imageUrls ?? []), ...uploadedUrls])] }
                                      : variant
                                )
                              )
                            );
                          } catch (uploadError) {
                            setEditVariantError(uploadError instanceof Error ? uploadError.message : "Unable to upload variant image.");
                          } finally {
                            event.target.value = "";
                          }
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        {activeEditVariantImageUrls.map((imageUrl, imageIndex) => (
                          <div key={`edit-variant-group-image-preview-${imageUrl}-${imageIndex}`} className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted/15">
                            <Image src={imageUrl} alt="Variant image preview" fill unoptimized className="object-cover" />
                            <button
                              type="button"
                              className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
                              onClick={() =>
                                setEditVariants((current) =>
                                  normalizeVariantDefaults(
                                    current.map((variant, index) =>
                                      activeEditHasSubOptions
                                        ? activeEditGroupIndexes.includes(index)
                                          ? {
                                              ...variant,
                                              groupImageUrls: (variant.groupImageUrls ?? []).filter((_, currentIndex) => currentIndex !== imageIndex)
                                            }
                                          : variant
                                        : index === editActiveVariantIndex
                                          ? {
                                              ...variant,
                                              imageUrls: (variant.imageUrls ?? []).filter((_, currentIndex) => currentIndex !== imageIndex)
                                            }
                                          : variant
                                    )
                                  )
                                )
                              }
                              aria-label="Remove variant image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <label
                          htmlFor={`edit-variant-group-image-${activeEditGroupImageIndex ?? "none"}`}
                          className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
                        >
                          <Plus className="h-5 w-5" />
                        </label>
                      </div>
                    </FormField>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={activeEditHasSubOptions}
                          disabled={activeEditGroupHasOrderedVariant}
                          onChange={(event) => setEditSubOptionsEnabled(event.target.checked)}
                        />
                        <span className="text-sm font-medium">Has options</span>
                      </label>
                      {activeEditHasSubOptions ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addEditTierTwoOption}
                          disabled={activeEditGroupHasOrderedVariant}
                        >
                          Add option
                        </Button>
                      ) : null}
                    </div>
                    {!activeEditHasSubOptions ? (
                      <>
                        <FormField label="SKU">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="BALM-LAVENDER"
                              value={activeEditSkuValue}
                              readOnly={activeEditVariant.skuMode === "auto" || activeEditVariantIsOrdered}
                              onChange={(event) =>
                                setEditVariants((current) =>
                                  normalizeVariantDefaults(
                                    current.map((variant, index) =>
                                      index === editActiveVariantIndex
                                        ? { ...variant, skuMode: "manual", sku: event.target.value }
                                        : variant
                                    )
                                  )
                                )
                              }
                            />
                            {activeEditVariant.skuMode === "auto" ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label="Override SKU"
                                title="Override SKU"
                                disabled={activeEditVariantIsOrdered}
                                onClick={() =>
                                  setEditVariants((current) =>
                                    normalizeVariantDefaults(
                                      current.map((variant, index) =>
                                        index === editActiveVariantIndex ? { ...variant, skuMode: "manual", sku: activeEditAutoSku } : variant
                                      )
                                    )
                                  )
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label="Reset SKU to auto"
                                title="Reset SKU to auto"
                                disabled={activeEditVariantIsOrdered}
                                onClick={() =>
                                  setEditVariants((current) =>
                                    normalizeVariantDefaults(
                                      current.map((variant, index) =>
                                        index === editActiveVariantIndex
                                          ? { ...variant, skuMode: "auto", sku: buildDefaultVariantSku(variant, editSkuBase, index) }
                                          : variant
                                      )
                                    )
                                  )
                                }
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {activeEditVariantIsOrdered ? (
                            <p className="mt-1 text-xs text-muted-foreground">SKU is locked because this variant has orders.</p>
                          ) : null}
                        </FormField>
                        <FormField label="Price">
                          <Input
                            inputMode="decimal"
                            placeholder="0.00"
                            value={activeEditVariant.priceDollars}
                            onChange={(event) =>
                              setEditVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === editActiveVariantIndex ? { ...variant, priceDollars: event.target.value } : variant
                                  )
                                )
                              )
                            }
                          />
                        </FormField>
                        <FormField label="Inventory">
                          <Input
                            inputMode="numeric"
                            placeholder="0"
                            value={activeEditVariant.inventoryQty}
                            onChange={(event) =>
                              setEditVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === editActiveVariantIndex ? { ...variant, inventoryQty: event.target.value } : variant
                                  )
                                )
                              )
                            }
                          />
                        </FormField>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={activeEditVariant.isMadeToOrder}
                            onChange={(event) =>
                              setEditVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === editActiveVariantIndex ? { ...variant, isMadeToOrder: event.target.checked } : variant
                                  )
                                )
                              )
                            }
                          />
                          <span className="text-sm font-medium">Enable made to order</span>
                        </label>
                      </>
                    ) : (
                      <div className="space-y-3 rounded-md border border-border bg-white p-3">
                        <p className="text-sm font-medium">Options</p>
                        <p className="text-sm text-muted-foreground">Add options for this variant, then configure price, SKU, inventory, and images for each option.</p>
                        <div className="space-y-2">
                          {activeEditSubOptionIndexes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No options yet.</p>
                          ) : null}
                          {activeEditSubOptionIndexes.map((index) => {
                            const option = editVariants[index];
                            if (!option) {
                              return null;
                            }

                            return (
                              <div key={`edit-tier2-${index}`} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2">
                                <div>
                                  <p className="text-sm font-medium">{getOptionValue(option, activeEditLevelTwoName) || `${activeEditLevelTwoName} option`}</p>
                                  <p className="text-xs text-muted-foreground">
                                    ${option.priceDollars || "0.00"} · Inv {option.inventoryQty || "0"} · {option.status}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button type="button" variant="outline" size="sm" onClick={() => openEditOptionEditor(index)}>
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateEditVariantStatuses([index], option.status === "archived" ? "active" : "archived")}
                                  >
                                    {option.status === "archived" ? "Unarchive" : "Archive"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                      if (activeEditSubOptionIndexes.length <= 1) {
                                        setEditSubOptionsEnabled(false);
                                        return;
                                      }
                                      void removeEditVariants([index], "option");
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select or add a variant from the product view.</p>
                )}
                </div>

                <div
                  key={`edit-step-2-${editStepMotionKey}`}
                  ref={(node) => {
                    if (editStepIndex === 2) {
                      editActivePanelRef.current = node;
                    }
                  }}
                  className={editStepIndex === 2 ? "w-full space-y-3 pl-3 pr-1" : "hidden"}
                >
                {activeEditVariant ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Option details</p>
                      {editVariantError ? <p className="text-xs font-medium text-destructive">{editVariantError}</p> : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="Option name">
                        <Input
                          placeholder="e.g. Size"
                          value={activeEditLevelTwoName}
                          disabled={activeEditGroupHasOrderedVariant}
                          onChange={(event) => {
                            const nextName = event.target.value;
                            const previousName = activeEditLevelTwoName;
                            setEditOptionTwoName(nextName);
                            if (!nextName.trim()) {
                              return;
                            }
                            setEditVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  activeEditGroupIndexes.includes(index) ? renameOptionName(variant, previousName, nextName) : variant
                                )
                              )
                            );
                          }}
                        />
                      </FormField>
                      <FormField label="Option value">
                        <Input
                          placeholder={`${activeEditLevelTwoName} value`}
                          value={getOptionValue(activeEditVariant, activeEditLevelTwoName)}
                          disabled={activeEditVariantIsOrdered}
                          onChange={(event) =>
                            setEditVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  index === editActiveVariantIndex ? setOptionValue(variant, activeEditLevelTwoName, event.target.value) : variant
                                )
                              )
                            )
                          }
                        />
                      </FormField>
                      <div className="sm:col-span-2">
                        <FormField label="Option image (optional)">
                          <input
                            id={`edit-option-image-${editActiveVariantIndex ?? "none"}`}
                            type="file"
                            className="hidden"
                            multiple
                            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={async (event) => {
                              const files = [...(event.target.files ?? [])];
                              if (files.length === 0) {
                                return;
                              }

                              try {
                                const uploadedUrls = await uploadProductImages(files);
                                setEditVariants((current) =>
                                  normalizeVariantDefaults(
                                    current.map((variant, index) =>
                                      index === editActiveVariantIndex
                                        ? { ...variant, imageUrls: [...new Set([...(variant.imageUrls ?? []), ...uploadedUrls])] }
                                        : variant
                                    )
                                  )
                                );
                              } catch (uploadError) {
                                setEditVariantError(uploadError instanceof Error ? uploadError.message : "Unable to upload option image.");
                              } finally {
                                event.target.value = "";
                              }
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            {activeEditVariant.imageUrls.map((imageUrl, imageIndex) => (
                              <div key={`edit-option-image-preview-${imageUrl}-${imageIndex}`} className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted/15">
                                <Image src={imageUrl} alt="Option image preview" fill unoptimized className="object-cover" />
                                <button
                                  type="button"
                                  className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
                                  onClick={() =>
                                    setEditVariants((current) =>
                                      normalizeVariantDefaults(
                                        current.map((variant, index) =>
                                          index === editActiveVariantIndex
                                            ? { ...variant, imageUrls: (variant.imageUrls ?? []).filter((_, currentIndex) => currentIndex !== imageIndex) }
                                            : variant
                                        )
                                      )
                                    )
                                  }
                                  aria-label="Remove option image"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                            <label
                              htmlFor={`edit-option-image-${editActiveVariantIndex ?? "none"}`}
                              className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
                            >
                              <Plus className="h-5 w-5" />
                            </label>
                          </div>
                        </FormField>
                      </div>
                    </div>
                    <FormField label="SKU">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="BALM-LAVENDER-2OZ"
                          value={activeEditSkuValue}
                          readOnly={activeEditVariant.skuMode === "auto" || activeEditVariantIsOrdered}
                          onChange={(event) =>
                            setEditVariants((current) =>
                              normalizeVariantDefaults(
                                current.map((variant, index) =>
                                  index === editActiveVariantIndex
                                    ? { ...variant, skuMode: "manual", sku: event.target.value }
                                    : variant
                                )
                              )
                            )
                          }
                        />
                        {activeEditVariant.skuMode === "auto" ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Override SKU"
                            title="Override SKU"
                            disabled={activeEditVariantIsOrdered}
                            onClick={() =>
                              setEditVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === editActiveVariantIndex ? { ...variant, skuMode: "manual", sku: activeEditAutoSku } : variant
                                  )
                                )
                              )
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Reset SKU to auto"
                            title="Reset SKU to auto"
                            disabled={activeEditVariantIsOrdered}
                            onClick={() =>
                              setEditVariants((current) =>
                                normalizeVariantDefaults(
                                  current.map((variant, index) =>
                                    index === editActiveVariantIndex
                                      ? { ...variant, skuMode: "auto", sku: buildDefaultVariantSku(variant, editSkuBase, index) }
                                      : variant
                                  )
                                )
                              )
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {activeEditVariantIsOrdered ? (
                        <p className="mt-1 text-xs text-muted-foreground">SKU is locked because this variant has orders.</p>
                      ) : null}
                    </FormField>
                    <FormField label="Price">
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={activeEditVariant.priceDollars}
                        onChange={(event) =>
                          setEditVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                index === editActiveVariantIndex ? { ...variant, priceDollars: event.target.value } : variant
                              )
                            )
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Inventory">
                      <Input
                        inputMode="numeric"
                        placeholder="0"
                        value={activeEditVariant.inventoryQty}
                        onChange={(event) =>
                          setEditVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                index === editActiveVariantIndex ? { ...variant, inventoryQty: event.target.value } : variant
                              )
                            )
                          )
                        }
                      />
                    </FormField>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={activeEditVariant.isMadeToOrder}
                        onChange={(event) =>
                          setEditVariants((current) =>
                            normalizeVariantDefaults(
                              current.map((variant, index) =>
                                index === editActiveVariantIndex ? { ...variant, isMadeToOrder: event.target.checked } : variant
                              )
                            )
                          )
                        }
                      />
                      <span className="text-sm font-medium">Enable made to order</span>
                    </label>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select an option to configure.</p>
                )}
                </div>
            </div>
            </fieldset>
          </div>
        </form>
      </Flyout>

      <DialogPrimitive.Root
        open={Boolean(inventoryAdjustDraft)}
        onOpenChange={(open) => {
          if (!open) {
            setInventoryAdjustDraft(null);
            setInventoryAdjustError(null);
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[61] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-6 shadow-lg">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Adjust inventory</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
              {inventoryAdjustDraft ? `Update stock for ${inventoryAdjustDraft.variantLabel}.` : "Update stock for this variant."}
            </DialogPrimitive.Description>
            <form className="mt-4 space-y-3" onSubmit={submitInventoryAdjustment}>
              <div className="rounded-md border border-border bg-muted/20 p-2 text-sm">
                <p>
                  Current quantity: <span className="font-semibold tabular-nums">{inventoryAdjustDraft?.currentQty ?? 0}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  New quantity:{" "}
                  <span className="font-semibold tabular-nums">
                    {(inventoryAdjustDraft?.currentQty ?? 0) + (Number(inventoryAdjustDraft?.delta || 0) || 0)}
                  </span>
                </p>
              </div>
              <FormField label="Adjust by" description="Use positive values to restock and negative values to reduce inventory.">
                <Input
                  type="number"
                  step={1}
                  inputMode="numeric"
                  placeholder="20 or -5"
                  value={inventoryAdjustDraft?.delta ?? ""}
                  onChange={(event) =>
                    setInventoryAdjustDraft((current) =>
                      current
                        ? {
                            ...current,
                            delta: event.target.value
                          }
                        : current
                    )
                  }
                />
              </FormField>
              <FormField label="Note" description="Optional internal reason shown in your inventory movement log.">
                <Input
                  placeholder="Restock shipment or correction note"
                  value={inventoryAdjustDraft?.note ?? ""}
                  onChange={(event) =>
                    setInventoryAdjustDraft((current) =>
                      current
                        ? {
                            ...current,
                            note: event.target.value
                          }
                        : current
                    )
                  }
                />
              </FormField>
              <div className="flex items-center justify-between gap-3">
                <AppAlert compact variant="error" message={inventoryAdjustError} className="text-sm" />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setInventoryAdjustDraft(null);
                      setInventoryAdjustError(null);
                    }}
                    disabled={inventoryAdjustPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inventoryAdjustPending}>
                    {inventoryAdjustPending ? "Saving..." : "Save adjustment"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root
        open={isDeleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            resolveDeleteConfirm(false);
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[61] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-6 shadow-lg">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{deleteConfirmTitle}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">{deleteConfirmDescription}</DialogPrimitive.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => resolveDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => resolveDeleteConfirm(true)}>
                {deleteConfirmLabel}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
