import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  attachDigitalRecoverySession,
  enforceDigitalRecoveryRateLimits,
  getDigitalRecoverySession,
  queueCustomerDigitalAccessRecovery,
  type DigitalAccessRateLimitResult,
} from "@/lib/digital-products/customer-access";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import { getServerEnv } from "@/lib/env";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";

const payloadSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().trim().email().max(254),
});

const NEUTRAL_RESPONSE = {
  success: true,
  message:
    "If the order details match, a fresh download link will arrive by email.",
} as const;

type HandlerDependencies = {
  nowMs: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  enforceRateLimits: (input: {
    clientSubjectHash: string;
    pairSubjectHash: string;
  }) => Promise<DigitalAccessRateLimitResult>;
  queueRecovery: (input: {
    orderId: string;
    email: string;
  }) => Promise<{ queued: boolean }>;
};

function hardenedJson(
  body: Record<string, unknown>,
  init: { status: number; headers?: Record<string, string> },
) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...init.headers,
    },
  });
}

function defaultDependencies(): HandlerDependencies {
  return {
    nowMs: () => performance.now(),
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    enforceRateLimits: (input) => enforceDigitalRecoveryRateLimits(input),
    queueRecovery: (input) => {
      const secret = getServerEnv().DIGITAL_DELIVERY_TOKEN_SECRET?.trim();
      if (!secret) return Promise.resolve({ queued: false });
      return queueCustomerDigitalAccessRecovery({
        ...input,
        tokenSecret: secret,
      });
    },
  };
}

export function createDigitalLinkRequestHandler(
  dependencies: HandlerDependencies = defaultDependencies(),
) {
  return async function handleDigitalLinkRequest(request: NextRequest) {
    const originFailure = enforceTrustedOrigin(request);
    if (originFailure) return originFailure;

    const parsed = await parseJsonRequest(request, payloadSchema);
    if (!parsed.ok) return parsed.response;
    const input = {
      orderId: parsed.data.orderId,
      email: parsed.data.email.trim().toLowerCase(),
    };
    const startedAt = dependencies.nowMs();
    let session;
    try {
      session = getDigitalRecoverySession(request, input.orderId, input.email);
    } catch {
      return hardenedJson(
        { error: "Download recovery is temporarily unavailable." },
        { status: 503 },
      );
    }

    const limited = await dependencies.enforceRateLimits({
      clientSubjectHash: session.clientSubjectHash,
      pairSubjectHash: session.pairSubjectHash,
    });
    if (!limited.allowed) {
      const response = "unavailable" in limited
        ? hardenedJson(
            { error: "Download recovery is temporarily unavailable." },
            { status: 503 },
          )
        : hardenedJson(
            { error: "Too many requests. Please retry later." },
            {
              status: 429,
              headers: { "Retry-After": String(limited.retryAfterSeconds) },
            },
          );
      return attachDigitalRecoverySession(response, session);
    }

    await dependencies.queueRecovery(input);
    const elapsed = Math.max(0, dependencies.nowMs() - startedAt);
    const remaining = Math.max(
      0,
      DIGITAL_PRODUCT_CONFIG.recoveryResponsePaddingMs - elapsed,
    );
    if (remaining > 0) await dependencies.sleep(remaining);
    return attachDigitalRecoverySession(
      hardenedJson(NEUTRAL_RESPONSE, { status: 202 }),
      session,
    );
  };
}
