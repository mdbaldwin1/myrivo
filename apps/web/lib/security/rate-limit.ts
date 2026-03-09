import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

function buildRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: "Too many requests. Please retry shortly."
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds)
      }
    }
  );
}

function checkRateLimitInMemory(bucketKey: string, windowMs: number, limit: number): NextResponse | null {
  const now = Date.now();
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs
    });
    return null;
  }

  if (existing.count >= limit) {
    return buildRateLimitResponse(Math.ceil((existing.resetAt - now) / 1000));
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
  return null;
}

export async function checkRateLimit(
  request: NextRequest,
  options: {
    key: string;
    limit: number;
    windowMs: number;
  }
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const bucketKey = `${options.key}:${ip}`;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("check_api_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: options.limit,
      p_window_ms: options.windowMs
    });

    if (error) {
      console.error("shared rate-limit rpc failed; using in-memory fallback", error.message);
      return checkRateLimitInMemory(bucketKey, options.windowMs, options.limit);
    }

    const row = (Array.isArray(data) ? data[0] : data) as { allowed?: boolean; retry_after_seconds?: number } | null;
    if (row?.allowed === false) {
      return buildRateLimitResponse(Math.max(1, row.retry_after_seconds ?? 1));
    }
    return null;
  } catch (error) {
    console.error("shared rate-limit execution failed; using in-memory fallback", error);
    return checkRateLimitInMemory(bucketKey, options.windowMs, options.limit);
  }
}
