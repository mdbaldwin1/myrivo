import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/http/read-json-body";

type ParsedJsonRequestSuccess<T> = {
  ok: true;
  data: T;
};

type ParsedJsonRequestFailure = {
  ok: false;
  response: NextResponse;
};

export type ParsedJsonRequestResult<T> = ParsedJsonRequestSuccess<T> | ParsedJsonRequestFailure;

export async function parseJsonRequest<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema
): Promise<ParsedJsonRequestResult<z.infer<TSchema>>> {
  const rawBody = await readJsonBody(request);
  if (!rawBody.ok) {
    return rawBody;
  }

  const parsed = schema.safeParse(rawBody.data);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })
    };
  }

  return {
    ok: true,
    data: parsed.data
  };
}
