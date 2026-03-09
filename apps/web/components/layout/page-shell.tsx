import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  maxWidthClassName?: string;
};

export function PageShell({ children, maxWidthClassName = "max-w-5xl" }: PageShellProps) {
  return <main className={`mx-auto w-full px-4 py-6 md:px-8 md:py-8 ${maxWidthClassName}`}>{children}</main>;
}
