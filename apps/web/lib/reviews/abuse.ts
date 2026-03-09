import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

type ReviewAbuseInput = {
  reviewerEmail: string;
  reviewerName?: string | null;
  title?: string | null;
  body?: string | null;
  ipAddress?: string | null;
};

export type ReviewAbuseEvaluation = {
  fingerprint: string;
  holdForModeration: boolean;
  reasons: string[];
  normalizedTitle: string;
  normalizedBody: string;
  normalizedEmail: string;
};

export type ReviewSubmissionRateLimitResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: "REVIEWS_RATE_LIMIT_IP" | "REVIEWS_RATE_LIMIT_EMAIL";
      retryAfterSeconds: number;
    };

const DEFAULT_BLOCKED_TERMS = ["http://", "https://", "bit.ly", "tinyurl", "telegram", "whatsapp", "viagra", "casino"];

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeReviewText(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  return normalizeWhitespace(value).toLowerCase();
}

export function resolveReviewAbuseConfig() {
  const env = getServerEnv();
  const blockedTerms = (env.REVIEWS_BLOCKED_TERMS ?? "")
    .split(",")
    .map((entry) => normalizeReviewText(entry))
    .filter(Boolean);

  return {
    maxSubmissionsPerIpPerHour: parsePositiveInt(env.REVIEWS_MAX_SUBMISSIONS_PER_IP_PER_HOUR, 8),
    maxSubmissionsPerEmailPerDay: parsePositiveInt(env.REVIEWS_MAX_SUBMISSIONS_PER_EMAIL_PER_DAY, 5),
    blockedTerms: blockedTerms.length > 0 ? blockedTerms : DEFAULT_BLOCKED_TERMS
  };
}

export function buildReviewFingerprint(input: {
  storeId: string;
  productId?: string | null;
  reviewerEmail: string;
  title?: string | null;
  body?: string | null;
}) {
  const normalizedEmail = normalizeReviewText(input.reviewerEmail);
  const normalizedTitle = normalizeReviewText(input.title);
  const normalizedBody = normalizeReviewText(input.body);
  const source = `${input.storeId}|${input.productId ?? "store"}|${normalizedEmail}|${normalizedTitle}|${normalizedBody}`;
  return createHash("sha256").update(source).digest("hex").slice(0, 32);
}

export function hashReviewSignal(value: string | null | undefined) {
  const normalized = normalizeReviewText(value);
  if (!normalized) {
    return null;
  }
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function getRequestIpAddress(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) {
      return ip;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || null;
}

function countUrlLikeTokens(value: string) {
  const matches = value.match(/https?:\/\//g);
  return matches?.length ?? 0;
}

function hasRepeatedCharacterRun(value: string) {
  return /(.)\1{7,}/.test(value);
}

function hasShoutingPattern(value: string) {
  const letters = value.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 16) {
    return false;
  }
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length >= 0.9;
}

function includesBlockedTerm(value: string, blockedTerms: string[]) {
  return blockedTerms.some((term) => term && value.includes(term));
}

export function evaluateReviewForModeration(input: ReviewAbuseInput & { storeId: string; productId?: string | null }): ReviewAbuseEvaluation {
  const config = resolveReviewAbuseConfig();
  const rawTitle = normalizeWhitespace(input.title ?? "");
  const rawBody = normalizeWhitespace(input.body ?? "");
  const normalizedTitle = normalizeReviewText(input.title);
  const normalizedBody = normalizeReviewText(input.body);
  const normalizedEmail = normalizeReviewText(input.reviewerEmail);
  const normalizedName = normalizeReviewText(input.reviewerName);
  const content = `${normalizedTitle} ${normalizedBody}`.trim();
  const rawContent = `${rawTitle} ${rawBody}`.trim();

  const reasons: string[] = [];

  if (!normalizedEmail.includes("@")) {
    reasons.push("invalid_email_format");
  }

  if (content.length > 0 && countUrlLikeTokens(content) >= 2) {
    reasons.push("contains_multiple_urls");
  }

  if (content.length > 0 && hasRepeatedCharacterRun(content)) {
    reasons.push("contains_repeated_character_run");
  }

  if (rawContent.length > 0 && hasShoutingPattern(rawContent)) {
    reasons.push("contains_shouting_pattern");
  }

  if (content.length > 0 && includesBlockedTerm(content, config.blockedTerms)) {
    reasons.push("contains_blocked_term");
  }

  if (normalizedName && /^test\b|\btest$/.test(normalizedName) && content.length > 0) {
    reasons.push("suspicious_reviewer_name");
  }

  const fingerprint = buildReviewFingerprint({
    storeId: input.storeId,
    productId: input.productId ?? null,
    reviewerEmail: normalizedEmail,
    title: normalizedTitle,
    body: normalizedBody
  });

  return {
    fingerprint,
    holdForModeration: reasons.length > 0,
    reasons,
    normalizedTitle,
    normalizedBody,
    normalizedEmail
  };
}

export async function enforceReviewSubmissionRateLimits(input: {
  admin: SupabaseClient;
  storeId: string;
  reviewerEmail: string;
  ipHash: string | null;
  now?: Date;
}): Promise<ReviewSubmissionRateLimitResult> {
  const config = resolveReviewAbuseConfig();
  const now = input.now ?? new Date();

  if (input.ipHash) {
    const oneHourAgoIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count: ipCount, error: ipError } = await input.admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("store_id", input.storeId)
      .contains("metadata", { ip_hash: input.ipHash })
      .gte("created_at", oneHourAgoIso);

    if (ipError) {
      throw new Error(ipError.message);
    }

    if ((ipCount ?? 0) >= config.maxSubmissionsPerIpPerHour) {
      return {
        ok: false,
        code: "REVIEWS_RATE_LIMIT_IP",
        retryAfterSeconds: 60 * 60
      };
    }
  }

  const oneDayAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count: emailCount, error: emailError } = await input.admin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("store_id", input.storeId)
    .eq("reviewer_email", normalizeReviewText(input.reviewerEmail))
    .gte("created_at", oneDayAgoIso);

  if (emailError) {
    throw new Error(emailError.message);
  }

  if ((emailCount ?? 0) >= config.maxSubmissionsPerEmailPerDay) {
    return {
      ok: false,
      code: "REVIEWS_RATE_LIMIT_EMAIL",
      retryAfterSeconds: 24 * 60 * 60
    };
  }

  return { ok: true };
}
