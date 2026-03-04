import Link from "next/link";
import { cn } from "@/lib/utils";

type StoreSettingsNavItem = {
  href: string;
  label: string;
  description: string;
};

const STORE_SETTINGS_NAV_ITEMS: StoreSettingsNavItem[] = [
  { href: "/dashboard/store", label: "Workspace", description: "Overview of settings areas" },
  { href: "/dashboard/store/profile", label: "Store Profile", description: "Name and publishing status" },
  { href: "/dashboard/store/branding", label: "Branding", description: "Logo, colors, layout, navigation" },
  { href: "/dashboard/store/operations", label: "Policies & Checkout", description: "Contact, shipping, returns, checkout options" },
  { href: "/dashboard/store/content", label: "Content Blocks", description: "Homepage narrative blocks" },
  { href: "/dashboard/store/promotions", label: "Promotions", description: "Discount code management" }
];

type StoreSettingsNavProps = {
  activeHref: string;
};

export function StoreSettingsNav({ activeHref }: StoreSettingsNavProps) {
  return (
    <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {STORE_SETTINGS_NAV_ITEMS.map((item) => {
        const isActive = activeHref === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40",
              isActive ? "border-primary/45 bg-primary/5" : ""
            )}
          >
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </Link>
        );
      })}
    </nav>
  );
}
