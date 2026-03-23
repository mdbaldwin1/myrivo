"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { withReturnTo } from "@/lib/auth/return-to";
import { cn } from "@/lib/utils";

type MarketingNavHref = "/" | "/features" | "/pricing" | "/compare" | "/for";

type MarketingMobileNavSheetProps = {
  activePath: MarketingNavHref;
  isAuthenticated?: boolean;
  navItems: Array<{ href: MarketingNavHref; label: string }>;
};

export function MarketingMobileNavSheet({ activePath, isAuthenticated = false, navItems }: MarketingMobileNavSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Open site navigation menu" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[88vw] max-w-sm flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-4 pr-14">
          <SheetTitle>Site navigation</SheetTitle>
          <SheetDescription>Browse public pages and jump into your account from one place.</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                  activePath === item.href
                    ? "bg-[hsl(var(--brand-secondary))] text-[hsl(var(--brand-secondary-foreground))]"
                    : "text-foreground hover:bg-[hsl(var(--brand-secondary))]/10"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{isAuthenticated ? "Account" : "Get started"}</p>
            <div className="mt-3 grid gap-3">
              {isAuthenticated ? (
                <>
                  <Button asChild className="w-full rounded-full">
                    <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                      Dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full rounded-full">
                    <Link href="/profile" onClick={() => setIsOpen(false)} className="inline-flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full rounded-full">
                    <Link href={withReturnTo("/login", activePath)} onClick={() => setIsOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild className="w-full rounded-full">
                    <Link href="/signup" onClick={() => setIsOpen(false)}>
                      Start free
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
