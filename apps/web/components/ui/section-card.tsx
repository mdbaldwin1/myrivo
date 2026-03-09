import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  children: ReactNode;
  description?: string;
  className?: string;
  contentClassName?: string;
  action?: ReactNode;
};

export function SectionCard({ title, children, description, className, contentClassName, action }: SectionCardProps) {
  return (
    <section className={cn("space-y-5 rounded-xl border border-border/70 bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
