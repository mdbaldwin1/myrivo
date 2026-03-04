import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type OptionConfig = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  id?: string;
  className?: string;
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
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

    const label =
      typeof option.props.children === "string" ? option.props.children : String(option.props.children ?? value);

    options.push({
      value,
      label,
      disabled: Boolean(option.props.disabled)
    });
  });

  return options;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ id, className, children, value, defaultValue, disabled, onChange, placeholder }, ref) => {
    const options = React.useMemo(() => extractOptions(children), [children]);
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? options[0]?.value ?? "");
    const selectedValue = typeof value === "string" ? value : internalValue;
    const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? placeholder ?? "Select";

    return (
      <SelectPrimitive.Root
        value={selectedValue}
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
          <SelectPrimitive.Value asChild>
            <span className="block max-w-[calc(100%-1.5rem)] truncate">{selectedLabel}</span>
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out">
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
