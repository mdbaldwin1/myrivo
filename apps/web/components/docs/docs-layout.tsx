import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Compass, Megaphone, Palette, Settings2, type LucideIcon } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";
import { getOwnerDocsByCategory } from "@/lib/docs/content";

type DocsLayoutProps = {
  children: ReactNode;
  currentSlug?: string;
};

export function DocsLayout({ children, currentSlug }: DocsLayoutProps) {
  const categories = getOwnerDocsByCategory();
  const categoryIcons: Record<string, LucideIcon> = {
    "Getting Started": Compass,
    Operations: Settings2,
    Storefront: Palette,
    Team: Megaphone,
    Reporting: BarChart3
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-4">
        <SectionCard title="Docs Navigation" description="Store owner and staff guides.">
          <nav aria-label="Documentation navigation" className="space-y-4">
            {categories.map((entry) => {
              const CategoryIcon = categoryIcons[entry.category] ?? Compass;
              return (
                <div key={entry.category} className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <CategoryIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{entry.category}</span>
                  </p>
                  <ul className="space-y-1">
                    {entry.docs.map((doc) => {
                      const active = currentSlug === doc.slug;
                      return (
                        <li key={doc.slug}>
                          <Link
                            href={`/docs/${doc.slug}`}
                            className={cn(
                              "block rounded-md border px-2 py-1.5 text-sm transition-colors",
                              active
                                ? "border-border bg-muted/55 text-foreground"
                                : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/25 hover:text-foreground"
                            )}
                            aria-current={active ? "page" : undefined}
                          >
                            <span className="flex items-center gap-2">
                              <CategoryIcon className="h-4 w-4 shrink-0" />
                              <span>{doc.title}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        </SectionCard>
      </aside>
      <div>{children}</div>
    </div>
  );
}
