import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";

function makeRequest(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/test", { headers });
}

describe("enforceTrustedOrigin", () => {
  test("allows matching origin and host", () => {
    const response = enforceTrustedOrigin(
      makeRequest({
        origin: "http://localhost:3000",
        host: "localhost:3000"
      })
    );

    expect(response).toBeNull();
  });

  test("rejects missing origin", async () => {
    const response = enforceTrustedOrigin(makeRequest({ host: "localhost:3000" }));

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({ error: "Missing Origin header" });
  });

  test("rejects untrusted origin", async () => {
    const response = enforceTrustedOrigin(
      makeRequest({
        origin: "https://attacker.example",
        host: "localhost:3000"
      })
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({ error: "Untrusted request origin" });
  });
});
