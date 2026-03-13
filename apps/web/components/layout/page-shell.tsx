import React, { type ReactNode } from "react";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";

type PageShellProps = {
  children: ReactNode;
  maxWidthClassName?: string;
};

export function PageShell({ children, maxWidthClassName = "max-w-5xl" }: PageShellProps) {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className={`mx-auto w-full px-4 py-6 md:px-8 md:py-8 ${maxWidthClassName} focus:outline-none`}>
      {children}
    </main>
  );
}
