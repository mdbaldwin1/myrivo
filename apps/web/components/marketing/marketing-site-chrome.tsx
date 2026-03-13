import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { CookiePreferencesButton } from "@/components/privacy/cookie-preferences-button";
import { Button } from "@/components/ui/button";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { withReturnTo } from "@/lib/auth/return-to";
import { cn } from "@/lib/utils";

type MarketingSiteChromeProps = {
  children: ReactNode;
  activePath: "/" | "/features" | "/pricing" | "/compare" | "/for";
  isAuthenticated?: boolean;
};

const navItems: Array<{ href: "/" | "/features" | "/pricing" | "/compare" | "/for"; label: string }> = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/for", label: "Solutions" }
];

export function MarketingSiteChrome({ children, activePath, isAuthenticated = false }: MarketingSiteChromeProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground [font-family:'Manrope','Avenir Next','Segoe UI',sans-serif]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-[hsl(var(--accent))]/20 blur-3xl" />
        <div className="absolute right-[-6rem] top-[-3rem] h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/4 h-96 w-96 rounded-full bg-[hsl(var(--muted-foreground))]/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={28} height={28} className="h-7 w-7 rounded-sm" />
            <span className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-lg font-semibold text-foreground">Myrivo</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  activePath === item.href ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-primary/10"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button className="h-9 rounded-full px-4">Dashboard</Button>
                </Link>
                <Link href="/account" className="hidden sm:inline-flex">
                  <Button variant="outline" className="h-9 rounded-full px-4">
                    Account
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href={withReturnTo("/login", activePath)} className="hidden sm:inline-flex">
                  <Button variant="outline" className="h-9 rounded-full px-4">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="h-9 rounded-full px-4">Start free</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 focus:outline-none sm:px-6">
        {children}
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-lg font-semibold text-foreground">Myrivo</p>
            <p className="text-sm text-muted-foreground">Commerce operations OS for serious operators.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href="/features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/docs" className="hover:text-foreground">
              Docs
            </Link>
            <Link href="/accessibility" className="hover:text-foreground">
              Accessibility
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:text-foreground">
              Cookies
            </Link>
            <CookiePreferencesButton className="hover:text-foreground">
              Manage cookies
            </CookiePreferencesButton>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
