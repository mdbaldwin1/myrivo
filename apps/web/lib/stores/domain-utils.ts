export function normalizeHost(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const host = value.trim().toLowerCase().replace(/\.$/, "").split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) {
    return null;
  }

  return host;
}

export function normalizeDomainInput(value: string) {
  const trimmed = value.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0]?.trim() ?? "";
  const withoutTrailingDot = withoutPath.replace(/\.$/, "");

  if (
    !withoutTrailingDot ||
    withoutTrailingDot.length < 3 ||
    withoutTrailingDot.length > 255 ||
    withoutTrailingDot.includes("..") ||
    withoutTrailingDot.startsWith(".") ||
    withoutTrailingDot.endsWith(".") ||
    !/^[a-z0-9.-]+$/.test(withoutTrailingDot)
  ) {
    return null;
  }

  return withoutTrailingDot;
}
