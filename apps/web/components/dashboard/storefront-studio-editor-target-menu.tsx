"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useHasMounted } from "@/components/use-has-mounted";
import { cn } from "@/lib/utils";

type StorefrontStudioEditorTargetMenuItem = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type StorefrontStudioEditorTargetMenuSection = {
  label: string;
  items: StorefrontStudioEditorTargetMenuItem[];
};

type StorefrontStudioEditorTargetMenuProps = {
  activeTargetId: string;
  activeTargetLabel: string;
  activeTargetDescription: string;
  activeTargetIcon: LucideIcon;
  sections: StorefrontStudioEditorTargetMenuSection[];
  onSelect: (targetId: string) => void;
};

export function StorefrontStudioEditorTargetMenu({
  activeTargetId,
  activeTargetLabel,
  activeTargetDescription,
  activeTargetIcon: ActiveIcon,
  sections,
  onSelect
}: StorefrontStudioEditorTargetMenuProps) {
  const hasMounted = useHasMounted();

  const trigger = (
    <button
      type="button"
      aria-label={`Editing ${activeTargetLabel}. Choose a different Studio section.`}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-3 text-left transition",
        "hover:border-primary/20 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
      disabled={!hasMounted}
    >
      <span className="flex min-w-0 items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <ActiveIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 space-y-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Editing</span>
          <span className="block text-sm font-semibold text-foreground">{activeTargetLabel}</span>
          <span className="block text-xs leading-relaxed text-muted-foreground">{activeTargetDescription}</span>
        </span>
      </span>
      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );

  if (!hasMounted) {
    return trigger;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={12}
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0"
      >
        <div className="max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height))] overflow-x-hidden overflow-y-auto p-2">
          {sections.map((section, index) => (
            <div key={section.label}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {section.label}
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                {section.items.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    className={cn(
                      "group items-start gap-3 rounded-xl px-2 py-2.5",
                      item.id === activeTargetId &&
                        "bg-primary/8 text-foreground focus:bg-primary focus:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground"
                    )}
                    onSelect={() => onSelect(item.id)}
                  >
                    <span
                      className={cn(
                        "mt-0.5 rounded-lg p-1.5",
                        item.id === activeTargetId
                          ? "bg-primary/12 text-primary group-data-[highlighted]:bg-primary-foreground/15 group-data-[highlighted]:text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className={cn("block text-sm font-medium", item.id === activeTargetId && "group-data-[highlighted]:text-primary-foreground")}>
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          "block text-xs leading-relaxed text-muted-foreground transition-colors group-data-[highlighted]:text-foreground/85",
                          item.id === activeTargetId && "text-foreground/80 group-data-[highlighted]:text-primary-foreground/85"
                        )}
                      >
                        {item.description}
                      </span>
                    </span>
                    {item.id === activeTargetId ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary group-data-[highlighted]:text-primary-foreground" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
