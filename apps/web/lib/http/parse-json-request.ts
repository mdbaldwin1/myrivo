import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/http/api-response";
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
      response: fail(400, "Invalid payload", parsed.error.flatten())
    };
  }

  return {
    ok: true,
    data: parsed.data
  };
}
