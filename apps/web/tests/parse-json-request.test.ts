import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";

describe("parseJsonRequest", () => {
  test("returns parsed data for valid json payload", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const request = new NextRequest("http://localhost:3000/api/example", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Myrivo" })
    });

    const result = await parseJsonRequest(request, schema);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Myrivo");
    }
  });

  test("returns 400 for malformed json", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const request = new NextRequest("http://localhost:3000/api/example", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });

    const result = await parseJsonRequest(request, schema);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const payload = (await result.response.json()) as { error: string };
      expect(payload.error).toContain("Invalid JSON");
    }
  });
});
