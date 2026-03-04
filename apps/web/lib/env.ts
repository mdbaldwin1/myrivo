import { z } from "zod";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MYRIVO_SINGLE_STORE_SLUG: z.string().optional(),
  OWNER_ACCESS_EMAILS: z.string().optional(),
  MYRIVO_ALLOW_PUBLIC_SIGNUP: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MYRIVO_EMAIL_FROM: z.string().optional(),
  MYRIVO_ORDER_ALERT_EMAILS: z.string().optional()
});

export const appUrlEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  VERCEL_URL: z.string().min(1).optional()
});

export const stripeModeEnvSchema = z.object({
  STRIPE_STUB_MODE: z.string().optional()
});

export const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1)
});

export const shippingEnvSchema = z.object({
  SHIPPING_PROVIDER: z.enum(["none", "easypost"]).optional(),
  EASYPOST_API_KEY: z.string().min(1).optional(),
  SHIPPING_WEBHOOK_SECRET: z.string().min(1).optional()
});

export const envSchema = publicEnvSchema
  .merge(serverEnvSchema)
  .merge(stripeModeEnvSchema)
  .merge(shippingEnvSchema)
  .merge(stripeEnvSchema.partial())
  .merge(appUrlEnvSchema);

let cachedPublicEnv: z.infer<typeof publicEnvSchema> | null = null;
let cachedServerEnv: z.infer<typeof serverEnvSchema> | null = null;
let cachedStripeEnv: z.infer<typeof stripeEnvSchema> | null = null;
let cachedStripeStubMode: boolean | null = null;
let cachedAppUrl: string | null = null;
let cachedShippingEnv: z.infer<typeof shippingEnvSchema> | null = null;

export function getPublicEnv() {
  if (!cachedPublicEnv) {
    cachedPublicEnv = publicEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
  }

  return cachedPublicEnv;
}

export function getServerEnv() {
  if (!cachedServerEnv) {
    cachedServerEnv = serverEnvSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      MYRIVO_SINGLE_STORE_SLUG: process.env.MYRIVO_SINGLE_STORE_SLUG,
      OWNER_ACCESS_EMAILS: process.env.OWNER_ACCESS_EMAILS,
      MYRIVO_ALLOW_PUBLIC_SIGNUP: process.env.MYRIVO_ALLOW_PUBLIC_SIGNUP,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      MYRIVO_EMAIL_FROM: process.env.MYRIVO_EMAIL_FROM,
      MYRIVO_ORDER_ALERT_EMAILS: process.env.MYRIVO_ORDER_ALERT_EMAILS
    });
  }

  return cachedServerEnv;
}

export function getStripeEnv() {
  if (!cachedStripeEnv) {
    cachedStripeEnv = stripeEnvSchema.parse({
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
    });
  }

  return cachedStripeEnv;
}

export function getShippingEnv() {
  if (!cachedShippingEnv) {
    cachedShippingEnv = shippingEnvSchema.parse({
      SHIPPING_PROVIDER: process.env.SHIPPING_PROVIDER,
      EASYPOST_API_KEY: process.env.EASYPOST_API_KEY,
      SHIPPING_WEBHOOK_SECRET: process.env.SHIPPING_WEBHOOK_SECRET
    });
  }

  return cachedShippingEnv;
}

export function isStripeStubMode() {
  if (cachedStripeStubMode === null) {
    const parsed = stripeModeEnvSchema.parse({ STRIPE_STUB_MODE: process.env.STRIPE_STUB_MODE });
    const normalized = parsed.STRIPE_STUB_MODE?.trim().toLowerCase();
    cachedStripeStubMode = normalized === "true" || normalized === "1" || normalized === "yes";
  }

  return cachedStripeStubMode;
}

function normalizeHostOrUrl(value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

export function getAppUrl() {
  if (!cachedAppUrl) {
    const env = appUrlEnvSchema.parse({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
      VERCEL_URL: process.env.VERCEL_URL
    });
    const candidate = env.NEXT_PUBLIC_APP_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;

    if (!candidate) {
      throw new Error("Missing app URL configuration (NEXT_PUBLIC_APP_URL or Vercel URL fallback).");
    }

    cachedAppUrl = z.string().url().parse(normalizeHostOrUrl(candidate));
  }

  return cachedAppUrl;
}

export function getEnv() {
  return { ...getPublicEnv(), ...getServerEnv(), ...getStripeEnv(), NEXT_PUBLIC_APP_URL: getAppUrl() };
}
