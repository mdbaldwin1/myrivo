import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useOptionalSurfacePortalContainer } from "@/components/ui/surface-portal-context";
import { useHasMounted } from "@/components/use-has-mounted";
import { cn } from "@/lib/utils";

type OptionConfig = {
  value: string;
  label: string;
  disabled?: boolean;
};

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => getNodeText(child)).join("");
  }

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return getNodeText(element.props.children);
  }

  return "";
}

type SelectProps = {
  id?: string;
  className?: string;
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  icon?: "down" | "up-down";
  onOpenChange?: (open: boolean) => void;
  onChange?: (event: { target: { value: string } }) => void;
};

function extractOptions(children: React.ReactNode) {
  const options: OptionConfig[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || typeof child.type !== "string" || child.type !== "option") {
      return;
    }

    const option = child as React.ReactElement<{ value?: string; children?: React.ReactNode; disabled?: boolean }>;
    const value = option.props.value;
    if (typeof value !== "string") {
      return;
    }

    const label = getNodeText(option.props.children).trim() || value;

    options.push({
      value,
      label,
      disabled: Boolean(option.props.disabled)
    });
  });

  return options;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ id, className, children, value, defaultValue, disabled, onOpenChange, onChange, placeholder, icon = "down" }, ref) => {
    const options = React.useMemo(() => extractOptions(children), [children]);
    const portalContainer = useOptionalSurfacePortalContainer();
    const hasMounted = useHasMounted();
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? options[0]?.value ?? "");
    const selectedValue = typeof value === "string" ? value : internalValue;

    if (!hasMounted) {
      return (
        <select
          id={id}
          value={selectedValue}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          onChange={(event) => {
            if (typeof value !== "string") {
              setInternalValue(event.target.value);
            }
            onChange?.({ target: { value: event.target.value } });
          }}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <SelectPrimitive.Root
        value={selectedValue}
        onOpenChange={onOpenChange}
        onValueChange={(nextValue) => {
          if (typeof value !== "string") {
            setInternalValue(nextValue);
          }
          onChange?.({ target: { value: nextValue } });
        }}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm whitespace-nowrap ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <SelectPrimitive.Value className="block max-w-[calc(100%-1.5rem)] truncate" placeholder={placeholder ?? "Select"} />
          <SelectPrimitive.Icon>
            {icon === "up-down" ? <ChevronsUpDown className="h-4 w-4 opacity-50" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal container={portalContainer ?? undefined}>
          <SelectPrimitive.Content className="relative z-[100] max-h-96 w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:transition-none motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none">
            <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
              <ChevronUp className="h-4 w-4" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  }
);
Select.displayName = "Select";

export { Select };
