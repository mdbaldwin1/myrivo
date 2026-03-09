import { getServerEnv } from "@/lib/env";

export function resolvePlatformNotificationFromAddress() {
  const env = getServerEnv();
  return env.MYRIVO_EMAIL_PLATFORM_FROM?.trim() || env.MYRIVO_EMAIL_FROM?.trim() || "no-reply@myrivo.app";
}

export function resolvePlatformNotificationReplyTo() {
  const env = getServerEnv();
  return env.MYRIVO_EMAIL_REPLY_TO?.trim() || null;
}
