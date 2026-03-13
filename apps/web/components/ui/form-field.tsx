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

const FIELD_CONTROL_TAGS = new Set(["input", "select", "textarea", "button"]);

function cloneFirstControl(
  node: ReactNode,
  props: Record<string, unknown>,
  didCloneRef: { current: boolean }
): ReactNode {
  if (didCloneRef.current) {
    return node;
  }

  if (!isValidElement(node)) {
    return node;
  }

  const element = node as ReactElement<Record<string, unknown>>;

  if (typeof element.type === "string" && FIELD_CONTROL_TAGS.has(element.type)) {
    didCloneRef.current = true;
    return cloneElement(element, {
      ...props,
      "aria-describedby": [element.props["aria-describedby"], props["aria-describedby"]].filter(Boolean).join(" ") || undefined,
      "aria-labelledby": [element.props["aria-labelledby"], props["aria-labelledby"]].filter(Boolean).join(" ") || undefined
    });
  }

  const childNodes = React.Children.map(element.props.children as ReactNode, (child) => cloneFirstControl(child, props, didCloneRef));
  if (!didCloneRef.current) {
    return element;
  }

  return cloneElement(element, undefined, childNodes);
}

export function FormField({ label, description, className, labelClassName, inputId, children }: FormFieldProps) {
  const generatedId = useId();
  const resolvedInputId = inputId ?? `field-${generatedId}`;
  const labelId = `${resolvedInputId}-label`;
  const descriptionId = description ? `${resolvedInputId}-description` : undefined;
  const childElement = isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const usesWrappedLabel = childElement && typeof childElement.type === "string" && childElement.type === "label";
  const resolvedChildren = usesWrappedLabel
    ? cloneFirstControl(
        children,
        {
          id: resolvedInputId,
          "aria-labelledby": labelId,
          "aria-describedby": descriptionId
        },
        { current: false }
      )
    : childElement && !childElement.props.id
      ? cloneElement(childElement, {
          id: resolvedInputId,
          "aria-describedby": [childElement.props["aria-describedby"], descriptionId].filter(Boolean).join(" ") || undefined
        })
      : children;

  return (
    <div className={cn("space-y-1", className)}>
      {usesWrappedLabel ? (
        <p id={labelId} className={cn("text-sm font-medium leading-none", labelClassName)}>
          {label}
        </p>
      ) : (
        <Label htmlFor={resolvedInputId} className={labelClassName}>
          {label}
        </Label>
      )}
      {resolvedChildren}
      {description ? <p id={descriptionId} className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}
