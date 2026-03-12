import { sanitizeInviteToken } from "@/lib/auth/invite-token";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

const DEFAULT_RETURN_TO = "/dashboard";
const INVITE_PREFIX = "/invite/";

function parseInviteTokenFromPath(path: string) {
  const normalized = sanitizeReturnTo(path, DEFAULT_RETURN_TO);
  if (!normalized.startsWith(INVITE_PREFIX)) {
    return null;
  }

  const pathname = new URL(normalized, "http://localhost").pathname;
  const token = pathname.slice(INVITE_PREFIX.length);
  return sanitizeInviteToken(token);
}

export function extractPendingStoreInviteTokenFromReturnTo(returnTo: string | null | undefined) {
  if (!returnTo) {
    return null;
  }

  return parseInviteTokenFromPath(returnTo);
}

export function getPendingStoreInviteTokenFromMetadata(userMetadata: unknown) {
  if (!userMetadata || typeof userMetadata !== "object") {
    return null;
  }

  const token = Reflect.get(userMetadata, "pending_store_invite_token");
  return typeof token === "string" ? sanitizeInviteToken(token) : null;
}

export function getPendingStoreInvitePath(token: string | null | undefined) {
  const safeToken = sanitizeInviteToken(token);
  return safeToken ? `${INVITE_PREFIX}${safeToken}` : null;
}

export function resolvePostAuthReturnTo(requestedReturnTo: string | null | undefined, userMetadata: unknown) {
  const safeReturnTo = sanitizeReturnTo(requestedReturnTo, DEFAULT_RETURN_TO);
  if (safeReturnTo.startsWith(INVITE_PREFIX)) {
    return safeReturnTo;
  }

  if (safeReturnTo !== DEFAULT_RETURN_TO && safeReturnTo !== "/") {
    return safeReturnTo;
  }

  const pendingInvitePath = getPendingStoreInvitePath(getPendingStoreInviteTokenFromMetadata(userMetadata));
  return pendingInvitePath ?? safeReturnTo;
}
