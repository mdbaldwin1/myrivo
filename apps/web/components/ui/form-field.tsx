import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label: string;
  description?: string;
  className?: string;
  labelClassName?: string;
  children: ReactNode;
};

export function FormField({ label, description, className, labelClassName, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className={labelClassName}>{label}</Label>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}
