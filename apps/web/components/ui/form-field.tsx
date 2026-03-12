import * as React from "react";
import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label: string;
  description?: string;
  className?: string;
  labelClassName?: string;
  inputId?: string;
  children: ReactNode;
};

export function FormField({ label, description, className, labelClassName, inputId, children }: FormFieldProps) {
  const generatedId = useId();
  const resolvedInputId = inputId ?? `field-${generatedId}`;
  const descriptionId = description ? `${resolvedInputId}-description` : undefined;
  const childElement = isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const resolvedChildren =
    childElement && !childElement.props.id
      ? cloneElement(childElement, {
          id: resolvedInputId,
          "aria-describedby": [childElement.props["aria-describedby"], descriptionId].filter(Boolean).join(" ") || undefined
        })
      : children;

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={resolvedInputId} className={labelClassName}>
        {label}
      </Label>
      {resolvedChildren}
      {description ? <p id={descriptionId} className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}
