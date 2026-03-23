import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("middleware", () => {
  test("redirects bare homepage auth codes into the auth callback route", () => {
    const response = middleware(new NextRequest("http://localhost:3000/?code=abc123"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/auth/callback?code=abc123");
  });

  test("keeps root requests without auth codes on the normal path", () => {
    const response = middleware(new NextRequest("http://localhost:3000/"));

    expect(response.status).toBe(200);
  });
});
