import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { digitalAcceptanceControlSchema, executeDigitalAcceptanceControl } from "@/lib/digital-products/acceptance-control";

function equal(left: string, right: string) {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export async function POST(request: NextRequest) {
  const acceptanceEnvironment = process.env.MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT;
  const approvedOrigin = process.env.MYRIVO_DIGITAL_ACCEPTANCE_ORIGIN;
  const approvedProject = process.env.MYRIVO_DIGITAL_ACCEPTANCE_PROJECT_REF;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || !["test", "preview"].includes(acceptanceEnvironment ?? "")
    || !approvedOrigin || new URL(request.url).origin !== approvedOrigin || !approvedProject?.match(/^[a-z0-9-]{6,64}$/)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const secret = process.env.MYRIVO_DIGITAL_ACCEPTANCE_CONTROL_SECRET?.trim();
  if (!secret || secret.length < 32 || !equal(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = digitalAcceptanceControlSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid control request" }, { status: 400 });
  try { return NextResponse.json(await executeDigitalAcceptanceControl(parsed.data)); }
  catch { return NextResponse.json({ error: "Acceptance control failed" }, { status: 500 }); }
}
