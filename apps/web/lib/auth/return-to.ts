const DEFAULT_RETURN_TO = "/dashboard";

const ALLOWED_PREFIXES = [
  "/",
  "/dashboard",
  "/account",
  "/profile",
  "/settings",
  "/docs",
  "/s/",
  "/products",
  "/cart",
  "/checkout",
  "/about",
  "/policies",
  "/pricing",
  "/legal",
  "/invite/",
  "/order/"
] as const;

function startsWithAllowedPrefix(pathname: string) {
  return ALLOWED_PREFIXES.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }
    return pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix);
  });
}

export function sanitizeReturnTo(input: string | null | undefined, fallback = DEFAULT_RETURN_TO) {
  if (!input) {
    return fallback;
  }

  const candidate = input.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || candidate.includes("\n") || candidate.includes("\r")) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate, "http://localhost");
  } catch {
    return fallback;
  }

  const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!startsWithAllowedPrefix(parsed.pathname)) {
    return fallback;
  }

  return normalizedPath || fallback;
}

export function withReturnTo(path: string, returnTo: string | null | undefined) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const safeReturnTo = sanitizeReturnTo(returnTo, DEFAULT_RETURN_TO);
  const params = new URLSearchParams({ returnTo: safeReturnTo });
  return `${safePath}?${params.toString()}`;
}
