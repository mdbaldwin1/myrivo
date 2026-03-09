import { cn } from "@/lib/utils";

function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) {
  return <div className={cn(orientation === "horizontal" ? "h-px w-full" : "h-full w-px", "bg-border", className)} />;
}

export { Separator };
