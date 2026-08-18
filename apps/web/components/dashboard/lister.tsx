"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { HintTooltip } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * The product editor lists three kinds of thing - files, variants, and the
 * options under a variant - and they are the same kind of list. These are the
 * pieces they share, so a row of one reads and behaves like a row of another
 * and an action means the same thing wherever it appears.
 */

export type ListerAction = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export function Lister({
  title,
  addLabel,
  onAdd,
  addDisabled = false,
  addControl,
  description,
  meta,
  error,
  children,
}: {
  title: string;
  /** Names the add control for assistive tech; it shows only an icon. */
  addLabel?: string;
  onAdd?: () => void;
  addDisabled?: boolean;
  /** For lists whose add control is a file picker rather than a button. */
  addControl?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  error?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        {addControl ??
          (onAdd ? (
            <HintTooltip hint={addLabel}>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                aria-label={addLabel}
                disabled={addDisabled}
                onClick={onAdd}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </HintTooltip>
          ) : null)}
      </div>

      {description || meta ? (
        <div className="space-y-1">
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
        </div>
      ) : null}

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

      {children}
    </div>
  );
}

export function ListerRows({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="space-y-2">
      {children}
    </ul>
  );
}

export function ListerEmpty({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function ListerRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li aria-label={label} className="rounded-md border border-border bg-muted/20 p-2">
      {children}
    </li>
  );
}

export function ListerRowBody({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center justify-between gap-2">{children}</div>;
}

export function ListerRowMain({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1 space-y-0.5">{children}</div>;
}

export function ListerRowControls({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-2">{children}</div>;
}

/** The row's own name, doubling as its primary action when there is one. */
export function ListerRowLabel({
  onClick,
  disabled = false,
  title,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  if (!onClick) {
    return <p className="truncate text-sm font-medium">{children}</p>;
  }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="-mx-1 block max-w-full truncate rounded px-1 text-left text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {children}
    </button>
  );
}

export function ListerRowMeta({ children }: { children: ReactNode }) {
  return <p className="truncate text-xs text-muted-foreground">{children}</p>;
}

export function ListerActionsMenu({
  label,
  actions,
  disabled = false,
  triggerRef,
}: {
  /** The row this menu belongs to, so its trigger has a distinct name. */
  label: string;
  actions: ListerAction[];
  disabled?: boolean;
  /** For actions that open a file picker and must hand focus back here. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  if (actions.length === 0) return null;
  return (
    // Non-modal: menu items open a confirmation dialog, and a modal menu's
    // pointer-events lock can outlive the menu when a dialog mounts during its
    // close transition, leaving the page unclickable.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={disabled}
          aria-label={`Manage ${label}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.disabled}
            className={action.destructive ? "text-destructive focus:bg-destructive/10 focus:text-destructive" : undefined}
            onClick={action.onSelect}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
