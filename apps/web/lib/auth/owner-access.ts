function parseEmailList(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isOwnerAccessEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  const allowlist = parseEmailList(process.env.OWNER_ACCESS_EMAILS);
  if (allowlist.size === 0) {
    return false;
  }

  return allowlist.has(email.trim().toLowerCase());
}

export function isPublicSignupAllowed(): boolean {
  const value = process.env.MYRIVO_ALLOW_PUBLIC_SIGNUP?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
