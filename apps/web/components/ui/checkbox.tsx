import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = {
  id?: string;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (event: { target: { checked: boolean } }) => void;
};

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ id, className, checked, defaultChecked, disabled, onChange }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      id={id}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={(next) => {
        onChange?.({ target: { checked: next === true } });
      }}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
