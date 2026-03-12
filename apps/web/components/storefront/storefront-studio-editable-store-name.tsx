"use client";

import type { ElementType } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";

type StorefrontStudioEditableStoreNameProps = {
  value: string;
  as?: ElementType;
  placeholder?: string;
  wrapperClassName?: string;
  displayClassName?: string;
  editorClassName?: string;
  buttonClassName?: string;
};

export function StorefrontStudioEditableStoreName({
  value,
  as = "span",
  placeholder = "Store name",
  wrapperClassName,
  displayClassName,
  editorClassName,
  buttonClassName
}: StorefrontStudioEditableStoreNameProps) {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    const Component = as;
    return <Component className={displayClassName}>{value}</Component>;
  }

  return (
    <StorefrontStudioEditableText
      as={as}
      value={value}
      placeholder={placeholder}
      wrapperClassName={wrapperClassName}
      displayClassName={displayClassName}
      editorClassName={editorClassName}
      buttonClassName={buttonClassName}
      onChange={(nextValue) => document.setStoreDraft((current) => ({ ...current, name: nextValue }))}
    />
  );
}
