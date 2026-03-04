import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Myrivo",
  description: "Commerce platform for independent makers",
  icons: {
    icon: [
      { url: "/brand/myrivo-favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    shortcut: ["/brand/myrivo-favicon.svg"],
    apple: ["/icon.svg"]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
