import { cn } from "@/lib/utils";

type DataStatProps = {
  label: string;
  value: string;
  className?: string;
};

export function DataStat({ label, value, className }: DataStatProps) {
  return (
    <div className={cn("rounded-md border border-border bg-card px-3 py-2", className)}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
