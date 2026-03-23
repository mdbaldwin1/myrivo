import { afterEach, describe, expect, test, vi } from "vitest";
import { envSchema, publicEnvSchema, serverEnvSchema, shippingEnvSchema, stripeEnvSchema, stripeModeEnvSchema } from "@/lib/env";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.MYRIVO_PUBLIC_APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  vi.resetModules();
});

describe("env schema", () => {
  test("public env validates browser-safe keys", () => {
    const parsed = publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon"
    });

    expect(parsed.success).toBe(true);
  });

  test("server env validates service role key", () => {
    const parsed = serverEnvSchema.safeParse({
      SUPABASE_SERVICE_ROLE_KEY: "service-role"
    });

    expect(parsed.success).toBe(true);
  });

  test("stripe env validates checkout keys", () => {
    const parsed = stripeEnvSchema.safeParse({
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123"
    });

    expect(parsed.success).toBe(true);
  });

  test("shipping env validates webhook security keys", () => {
    const parsed = shippingEnvSchema.safeParse({
      SHIPPING_ALLOW_QUERY_TOKEN: "true",
      SHIPPING_WEBHOOK_SIGNING_SECRET: "signing_secret",
      SHIPPING_WEBHOOK_REQUIRE_SIGNATURE: "true",
      SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: "300"
    });

    expect(parsed.success).toBe(true);
  });

  test("stripe mode env allows stub toggle", () => {
    const parsed = stripeModeEnvSchema.safeParse({
      STRIPE_STUB_MODE: "true"
    });

    expect(parsed.success).toBe(true);
  });

  test("accepts full config", () => {
    const parsed = envSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      STRIPE_STUB_MODE: "false",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      SHIPPING_WEBHOOK_SIGNING_SECRET: "signing_secret",
      VERCEL_PROJECT_PRODUCTION_URL: "myrivo.vercel.app"
    });

    expect(parsed.success).toBe(true);
  });

  test("accepts stub config without live stripe keys", () => {
    const parsed = envSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      STRIPE_STUB_MODE: "true",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000"
    });

    expect(parsed.success).toBe(true);
  });

  test("prefers the canonical public URL for external links", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.MYRIVO_PUBLIC_APP_URL = "https://www.myrivo.app";

    const { getExternalAppUrl } = await import("@/lib/env");

    expect(getExternalAppUrl()).toBe("https://www.myrivo.app");
  });

  test("falls back to the app URL for external links when no public override is set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.myrivo.app";

    const { getExternalAppUrl } = await import("@/lib/env");

    expect(getExternalAppUrl()).toBe("https://staging.myrivo.app");
  });
});
