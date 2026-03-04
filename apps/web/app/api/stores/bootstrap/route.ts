import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Store bootstrap is disabled in single-store mode." },
    { status: 410 }
  );
}

