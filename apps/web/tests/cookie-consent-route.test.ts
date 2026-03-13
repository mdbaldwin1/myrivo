import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/cookies/consent/route";

describe("cookie consent route", () => {
  test("records analytics consent and redirects back", async () => {
    const formData = new FormData();
    formData.set("analytics", "true");
    formData.set("returnTo", "/s/apothecary?store=apothecary");

    const response = await POST(
      new NextRequest("http://localhost:3000/cookies/consent", {
        method: "POST",
        body: formData
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/s/apothecary?store=apothecary");
    expect(response.cookies.get("myrivo_cookie_consent")?.value).toContain("\"analytics\":true");
  });

  test("rejects unsafe returnTo values", async () => {
    const formData = new FormData();
    formData.set("analytics", "false");
    formData.set("returnTo", "https://malicious.example");

    const response = await POST(
      new NextRequest("http://localhost:3000/cookies/consent", {
        method: "POST",
        body: formData
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(response.cookies.get("myrivo_cookie_consent")?.value).toContain("\"analytics\":false");
    expect(response.cookies.get("myrivo_analytics_sid")?.maxAge).toBe(0);
    expect(response.cookies.get("myrivo_marketing_sid")?.maxAge).toBe(0);
  });
});
