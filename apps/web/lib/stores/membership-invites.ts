import { createHash, randomBytes } from "node:crypto";

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createInviteToken() {
  return randomBytes(24).toString("hex");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function resolveInviteExpiry(days = 7) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

