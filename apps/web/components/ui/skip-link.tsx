import React from "react";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";

type SkipLinkProps = {
  label?: string;
};

export function SkipLink({ label = "Skip to main content" }: SkipLinkProps) {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only fixed left-4 top-4 z-[120] rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-lg outline-none transition focus:not-sr-only focus-visible:not-sr-only"
    >
      {label}
    </a>
  );
}
