import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RowActionsProps = {
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
};

export function RowActions({ children, className, align = "end" }: RowActionsProps) {
  return <div className={cn("flex flex-wrap gap-2", align === "end" ? "ml-auto" : "", className)}>{children}</div>;
}

type RowActionButtonProps = React.ComponentProps<typeof Button>;

export function RowActionButton({ className, variant = "outline", size = "sm", ...props }: RowActionButtonProps) {
  return <Button variant={variant} size={size} className={cn("h-7 text-xs", className)} {...props} />;
}
