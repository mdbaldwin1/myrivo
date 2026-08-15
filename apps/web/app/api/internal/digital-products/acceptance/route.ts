import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { digitalAcceptanceControlSchema, executeDigitalAcceptanceControl } from "@/lib/digital-products/acceptance-control";

function equal(left: string, right: string) {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

function resolveRequestOrigin(request: NextRequest) {
  // request.url reflects the server's own bind address behind an edge, so the
  // approved-origin comparison must use the forwarded request identity.
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0]?.trim().toLowerCase();
  if (!host) return null;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase()
    ?? new URL(request.url).protocol.replace(/:$/, "");
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const acceptanceEnvironment = process.env.MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT;
  const approvedOrigin = process.env.MYRIVO_DIGITAL_ACCEPTANCE_ORIGIN;
  const approvedProject = process.env.MYRIVO_DIGITAL_ACCEPTANCE_PROJECT_REF;
  const previewDeployment = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "preview";
  const localTestDeployment = process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV === "preview";
  if ((!previewDeployment && !localTestDeployment) || process.env.MYRIVO_DIGITAL_ACCEPTANCE_BUILD !== "enabled" || !["test", "preview"].includes(acceptanceEnvironment ?? "")
    || !approvedOrigin || resolveRequestOrigin(request) !== approvedOrigin || !approvedProject?.match(/^[a-z0-9-]{6,64}$/)) {
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
