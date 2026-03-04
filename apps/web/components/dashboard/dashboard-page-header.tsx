"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  title: string;
  description: string;
  className?: string;
  action?: ReactNode;
};

export function DashboardPageHeader({ title, description, className, action }: DashboardPageHeaderProps) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    let frame = 0;

    const updateStickyState = () => {
      frame = 0;
      const element = headerRef.current;
      if (!element) {
        return;
      }

      const stickyTop = Number.parseFloat(window.getComputedStyle(element).top || "0");
      const nextIsStuck = element.getBoundingClientRect().top <= stickyTop + 0.5;
      setIsStuck((current) => (current === nextIsStuck ? current : nextIsStuck));
    };

    const onScrollOrResize = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(updateStickyState);
    };

    updateStickyState();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-6 z-40 rounded-xl border border-border/70 bg-card p-5 transition-shadow duration-300 ease-in-out",
        isStuck ? "shadow-[0_10px_30px_-16px_rgba(0,0,0,0.45)]" : "shadow-none",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
