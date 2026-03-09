import type { ReactNode } from "react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { cn } from "@/lib/utils";

type DashboardPageScaffoldProps = {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export function DashboardPageScaffold({
  title,
  description,
  action,
  children,
  className,
  headerClassName,
  contentClassName
}: DashboardPageScaffoldProps) {
  return (
    <section className={cn("space-y-4 px-4 py-4 lg:px-6 lg:py-5", className)}>
      <DashboardPageHeader title={title} description={description} action={action} className={headerClassName} />
      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}
