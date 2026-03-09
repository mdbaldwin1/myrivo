import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusChipVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-sky-200 bg-sky-100 text-sky-800",
        success: "border-emerald-200 bg-emerald-100 text-emerald-800",
        warning: "border-amber-200 bg-amber-100 text-amber-800",
        danger: "border-rose-200 bg-rose-100 text-rose-800"
      }
    },
    defaultVariants: {
      tone: "neutral"
    }
  }
);

type StatusChipProps = {
  label: string;
  className?: string;
} & VariantProps<typeof statusChipVariants>;

export function StatusChip({ label, tone, className }: StatusChipProps) {
  return <span className={cn(statusChipVariants({ tone }), className)}>{label}</span>;
}
