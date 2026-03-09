import { NextRequest, NextResponse } from "next/server";
import { dispatchWeeklyDigests } from "@/lib/notifications/digest/weekly";

function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.NOTIFICATIONS_CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!process.env.NOTIFICATIONS_CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "Notifications cron secret is not configured." }, { status: 503 });
  }

  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dispatchWeeklyDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
