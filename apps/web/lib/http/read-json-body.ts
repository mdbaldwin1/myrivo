import { NextRequest, NextResponse } from "next/server";

export type JsonBodyReadResult =
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function readJsonBody(request: NextRequest): Promise<JsonBodyReadResult> {
  try {
    return {
      ok: true,
      data: await request.json()
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
    };
  }
}
