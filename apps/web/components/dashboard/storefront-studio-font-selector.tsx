"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useHasMounted } from "@/components/use-has-mounted";
import { STOREFRONT_FONT_OPTIONS, type StorefrontFontFamily } from "@/lib/theme/storefront-theme";
import { cn } from "@/lib/utils";

type StorefrontStudioFontSelectorProps = {
  id?: string;
  "aria-describedby"?: string;
  value: StorefrontFontFamily;
  onChange: (value: StorefrontFontFamily) => void;
};

export function StorefrontStudioFontSelector({ id, "aria-describedby": ariaDescribedBy, value, onChange }: StorefrontStudioFontSelectorProps) {
  const hasMounted = useHasMounted();
  const activeOption =
    STOREFRONT_FONT_OPTIONS.find((option) => option.id === value) ??
    STOREFRONT_FONT_OPTIONS[0]!;

  const trigger = (
    <button
      id={id}
      type="button"
      aria-describedby={ariaDescribedBy}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition",
        "hover:border-primary/20 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
      disabled={!hasMounted}
    >
      <span className={cn("truncate", activeOption.previewClassName)}>{activeOption.label}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );

  if (!hasMounted) {
    return trigger;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[18rem] p-1">
        <DropdownMenuGroup>
          {STOREFRONT_FONT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.id}
              className="gap-3 rounded-xl px-3 py-2.5"
              onSelect={() => onChange(option.id)}
            >
              <span className={cn("flex-1 text-base", option.previewClassName)}>{option.label}</span>
              {option.id === value ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
