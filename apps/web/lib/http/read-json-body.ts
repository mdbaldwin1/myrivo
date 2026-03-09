import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/http/api-response";

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
      response: fail(400, "Invalid JSON payload.")
    };
  }
}
