"use client";

import { createContext, useContext, type ReactNode, type RefObject } from "react";

type SurfacePortalContextValue = {
  portalContainerRef: RefObject<HTMLElement | null>;
};

const SurfacePortalContext = createContext<SurfacePortalContextValue | null>(null);

type SurfacePortalProviderProps = {
  value: SurfacePortalContextValue;
  children: ReactNode;
};

export function SurfacePortalProvider({ value, children }: SurfacePortalProviderProps) {
  return <SurfacePortalContext.Provider value={value}>{children}</SurfacePortalContext.Provider>;
}

export function useOptionalSurfacePortalContainer() {
  return useContext(SurfacePortalContext)?.portalContainerRef.current ?? null;
}
