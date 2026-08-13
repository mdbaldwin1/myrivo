import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { processDigitalDeliveryBatch } from "@/lib/digital-products/delivery-worker";

function credentialDigest(value: string) {
  return createHash("sha256").update(value).digest();
}

function isAuthorized(request: NextRequest, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return timingSafeEqual(
    credentialDigest(authorization),
    credentialDigest(expected),
  );
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const secret = env.DIGITAL_DELIVERY_PROCESS_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Digital delivery processor is not configured." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processDigitalDeliveryBatch();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { error: "Digital delivery processing failed." },
      { status: 500 },
    );
  }
}
