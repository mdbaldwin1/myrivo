import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type AuthSplitLayoutProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
};

export function AuthSplitLayout({ children, eyebrow, title, description, highlights }: AuthSplitLayoutProps) {
  return (
    <div className="min-h-[100svh] bg-[linear-gradient(180deg,#f7fbfb,#eef6f5)] text-foreground lg:h-[100svh] lg:overflow-hidden">
      <div className="grid min-h-[100svh] lg:h-full lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <aside className="relative overflow-hidden bg-[linear-gradient(160deg,#0f7b84_0%,#136b71_44%,#123d40_100%)] text-white lg:h-full lg:overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-white/12 blur-3xl" />
            <div className="absolute right-[-5rem] top-[-3rem] h-72 w-72 rounded-full bg-[#6fd4d0]/18 blur-3xl" />
            <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-[#f4cf9f]/14 blur-3xl" />
          </div>

          <div className="relative flex min-h-[21rem] flex-col px-6 py-6 sm:px-8 sm:py-8 lg:h-full lg:px-12 lg:py-10">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm font-medium text-white/88 transition hover:bg-white/12 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to site
              </Link>
            </div>

            <div className="flex flex-1 items-center py-10 lg:py-8">
              <div className="mx-auto w-full max-w-md">
                <div className="inline-flex rounded-[1.75rem] bg-white/10 p-[clamp(0.55rem,1.4vh,0.9rem)] shadow-[0_22px_70px_rgba(7,26,28,0.26)] ring-1 ring-white/16 backdrop-blur-sm">
                  <Image
                    src="/brand/myrivo-logo-stacked.svg"
                    alt="Myrivo"
                    width={180}
                    height={202}
                    priority
                    className="h-auto w-[clamp(7rem,18vh,11rem)]"
                  />
                </div>

                <div className="mt-6 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{eyebrow}</p>
                  <h1 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight text-white sm:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-white/78">{description}</p>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {highlights.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.35rem] border border-white/14 bg-white/9 px-4 py-3 text-sm font-medium text-white/88 shadow-[0_16px_50px_rgba(7,26,28,0.12)] backdrop-blur-sm"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="max-w-xl text-sm leading-7 text-white/62">
              Branded storefront, checkout, fulfillment, and seller operations in one place.
            </p>
          </div>
        </aside>

        <main className="flex min-h-[100svh] items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,250,249,0.98))] px-5 py-8 sm:px-8 lg:h-full lg:overflow-y-auto lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
