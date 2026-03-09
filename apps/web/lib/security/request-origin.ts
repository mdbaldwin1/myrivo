import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function appendHost(target: Set<string>, candidate: string | null | undefined) {
  if (!candidate) {
    return;
  }

  const normalized = candidate.trim();
  if (!normalized) {
    return;
  }

  if (normalized.includes("://")) {
    try {
      target.add(new URL(normalized).host.toLowerCase());
      return;
    } catch {
      return;
    }
  }

  target.add(normalized.toLowerCase());
}

function resolveAllowedHosts(request: NextRequest) {
  const hosts = new Set<string>();
  appendHost(hosts, request.headers.get("x-forwarded-host"));
  appendHost(hosts, request.headers.get("host"));
  appendHost(hosts, process.env.NEXT_PUBLIC_APP_URL);
  appendHost(hosts, process.env.VERCEL_PROJECT_PRODUCTION_URL);
  appendHost(hosts, process.env.VERCEL_URL);
  return hosts;
}

export function enforceTrustedOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");

  if (!origin) {
    return NextResponse.json({ error: "Missing Origin header" }, { status: 403 });
  }

  let originHost: string;

  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid Origin header" }, { status: 403 });
  }

  const allowedHosts = resolveAllowedHosts(request);

  if (allowedHosts.size === 0 || !allowedHosts.has(originHost)) {
    return NextResponse.json({ error: "Untrusted request origin" }, { status: 403 });
  }

  return null;
}
