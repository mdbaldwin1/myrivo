import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedCustomerUser } from "@/lib/customer/account";
import {
  enforceAuthenticatedDigitalAccessRateLimits,
  issueAuthenticatedCustomerDigitalAccess,
  type DigitalAccessRateLimitResult,
} from "@/lib/digital-products/customer-access";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ orderId: z.string().uuid() });

type RouteContext = { params: Promise<{ orderId: string }> };

type AuthenticatedUser = { id: string; email: string | null };

type HandlerDependencies = {
  authenticate: () => Promise<AuthenticatedUser | null>;
  enforceRateLimits: (input: {
    userId: string;
    orderId: string;
  }) => Promise<DigitalAccessRateLimitResult>;
  issueAccess: (input: {
    orderId: string;
    actorUserId: string;
    email: string;
  }) => Promise<{ accessUrl: string; expiresAt: string } | null>;
};

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function defaultDependencies(): HandlerDependencies {
  return {
    authenticate: async () => {
      const supabase = await createSupabaseServerClient();
      const auth = await requireAuthenticatedCustomerUser(supabase);
      if (!auth.user) return null;
      return { id: auth.user.id, email: auth.user.email ?? null };
    },
    enforceRateLimits: (input) =>
      enforceAuthenticatedDigitalAccessRateLimits(input),
    issueAccess: (input) => issueAuthenticatedCustomerDigitalAccess(input),
  };
}

export function createAuthenticatedDigitalAccessHandler(
  dependencies: HandlerDependencies = defaultDependencies(),
) {
  return async function handleAuthenticatedDigitalAccess(
    request: NextRequest,
    context: RouteContext,
  ) {
    const originFailure = enforceTrustedOrigin(request);
    if (originFailure) return originFailure;
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) return response({ error: "Invalid order id." }, 400);
    const user = await dependencies.authenticate();
    if (!user) return response({ error: "Unauthorized" }, 401);
    const email = user.email?.trim().toLowerCase();
    if (!email) return response({ error: "Order not found." }, 404);
    const limited = await dependencies.enforceRateLimits({
      userId: user.id,
      orderId: parsed.data.orderId,
    });
    if (!limited.allowed) {
      return "unavailable" in limited
        ? response({ error: "Digital access is temporarily unavailable." }, 503)
        : NextResponse.json(
            { error: "Too many requests. Please retry shortly." },
            {
              status: 429,
              headers: {
                "Cache-Control": "private, no-store, max-age=0",
                "Retry-After": String(limited.retryAfterSeconds),
              },
            },
          );
    }
    let issued;
    try {
      issued = await dependencies.issueAccess({
        orderId: parsed.data.orderId,
        actorUserId: user.id,
        email,
      });
    } catch {
      return response({ error: "Digital access is temporarily unavailable." }, 503);
    }
    if (!issued) return response({ error: "Order not found." }, 404);
    const url = new URL(issued.accessUrl);
    if (!/^\/downloads\/[A-Za-z0-9_-]{43}$/.test(url.pathname)) {
      return response({ error: "Digital access is temporarily unavailable." }, 503);
    }
    return response(
      { accessUrl: url.pathname, expiresAt: issued.expiresAt },
      201,
    );
  };
}
