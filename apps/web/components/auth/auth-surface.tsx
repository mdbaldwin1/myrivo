import type { ReactNode } from "react";

type AuthSurfaceProps = {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  notice?: ReactNode;
};

export function AuthSurface({ title, description, children, notice }: AuthSurfaceProps) {
  return (
    <div className="rounded-[2rem] border border-border/70 bg-white/92 p-6 shadow-[0_26px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8">
      <div className="space-y-3">
        <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight text-foreground sm:text-[2.15rem]">
          {title}
        </h2>
        <p className="max-w-xl text-base leading-8 text-muted-foreground">{description}</p>
        {notice ? <div className="pt-2">{notice}</div> : null}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
