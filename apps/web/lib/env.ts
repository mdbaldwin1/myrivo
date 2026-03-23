import { z } from "zod";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional()
});

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  MYRIVO_ONBOARDING_AI_PROVIDER: z.enum(["openai", "deterministic"]).optional(),
  MYRIVO_ONBOARDING_AI_MODEL: z.string().optional(),
  MYRIVO_SINGLE_STORE_SLUG: z.string().optional(),
  MYRIVO_EMAIL_PROVIDER: z.enum(["resend"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  MYRIVO_EMAIL_FROM: z.string().optional(),
  MYRIVO_EMAIL_PLATFORM_FROM: z.string().optional(),
  MYRIVO_EMAIL_REPLY_TO: z.string().optional(),
  MYRIVO_EMAIL_BRANDED_LOCAL_PART: z.string().optional(),
  MYRIVO_BRANDED_EMAIL_POLICY: z.enum(["disabled", "allowlist", "all"]).optional(),
  MYRIVO_BRANDED_EMAIL_STORE_IDS: z.string().optional(),
  MYRIVO_ORDER_ALERT_EMAILS: z.string().optional(),
  REVIEWS_MAX_SUBMISSIONS_PER_IP_PER_HOUR: z.string().optional(),
  REVIEWS_MAX_SUBMISSIONS_PER_EMAIL_PER_DAY: z.string().optional(),
  REVIEWS_BLOCKED_TERMS: z.string().optional(),
  REVIEWS_MEDIA_MAX_IMAGES_PER_REVIEW: z.string().optional(),
  REVIEWS_MEDIA_MAX_FILE_SIZE_BYTES: z.string().optional(),
  REVIEWS_MEDIA_MAX_WIDTH: z.string().optional(),
  REVIEWS_MEDIA_MAX_HEIGHT: z.string().optional(),
  VERCEL_API_TOKEN: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional()
});

export const appUrlEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  MYRIVO_PUBLIC_APP_URL: z.string().url().optional(),
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
  SHIPPING_ALLOW_QUERY_TOKEN: z.string().optional(),
  SHIPPING_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
  SHIPPING_WEBHOOK_REQUIRE_SIGNATURE: z.string().optional(),
  SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: z.string().optional()
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
let cachedExternalAppUrl: string | null = null;
let cachedShippingEnv: z.infer<typeof shippingEnvSchema> | null = null;

export function getPublicEnv() {
  if (!cachedPublicEnv) {
    cachedPublicEnv = publicEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    });
  }

  return cachedPublicEnv;
}

export function getServerEnv() {
  if (!cachedServerEnv) {
    cachedServerEnv = serverEnvSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      MYRIVO_ONBOARDING_AI_PROVIDER: process.env.MYRIVO_ONBOARDING_AI_PROVIDER,
      MYRIVO_ONBOARDING_AI_MODEL: process.env.MYRIVO_ONBOARDING_AI_MODEL,
      MYRIVO_SINGLE_STORE_SLUG: process.env.MYRIVO_SINGLE_STORE_SLUG,
      MYRIVO_EMAIL_PROVIDER: process.env.MYRIVO_EMAIL_PROVIDER,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      MYRIVO_EMAIL_FROM: process.env.MYRIVO_EMAIL_FROM,
      MYRIVO_EMAIL_PLATFORM_FROM: process.env.MYRIVO_EMAIL_PLATFORM_FROM,
      MYRIVO_EMAIL_REPLY_TO: process.env.MYRIVO_EMAIL_REPLY_TO,
      MYRIVO_EMAIL_BRANDED_LOCAL_PART: process.env.MYRIVO_EMAIL_BRANDED_LOCAL_PART,
      MYRIVO_BRANDED_EMAIL_POLICY: process.env.MYRIVO_BRANDED_EMAIL_POLICY,
      MYRIVO_BRANDED_EMAIL_STORE_IDS: process.env.MYRIVO_BRANDED_EMAIL_STORE_IDS,
      MYRIVO_ORDER_ALERT_EMAILS: process.env.MYRIVO_ORDER_ALERT_EMAILS,
      REVIEWS_MAX_SUBMISSIONS_PER_IP_PER_HOUR: process.env.REVIEWS_MAX_SUBMISSIONS_PER_IP_PER_HOUR,
      REVIEWS_MAX_SUBMISSIONS_PER_EMAIL_PER_DAY: process.env.REVIEWS_MAX_SUBMISSIONS_PER_EMAIL_PER_DAY,
      REVIEWS_BLOCKED_TERMS: process.env.REVIEWS_BLOCKED_TERMS,
      REVIEWS_MEDIA_MAX_IMAGES_PER_REVIEW: process.env.REVIEWS_MEDIA_MAX_IMAGES_PER_REVIEW,
      REVIEWS_MEDIA_MAX_FILE_SIZE_BYTES: process.env.REVIEWS_MEDIA_MAX_FILE_SIZE_BYTES,
      REVIEWS_MEDIA_MAX_WIDTH: process.env.REVIEWS_MEDIA_MAX_WIDTH,
      REVIEWS_MEDIA_MAX_HEIGHT: process.env.REVIEWS_MEDIA_MAX_HEIGHT,
      VERCEL_API_TOKEN: process.env.VERCEL_API_TOKEN,
      VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
      VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID
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
      SHIPPING_ALLOW_QUERY_TOKEN: process.env.SHIPPING_ALLOW_QUERY_TOKEN,
      SHIPPING_WEBHOOK_SIGNING_SECRET: process.env.SHIPPING_WEBHOOK_SIGNING_SECRET,
      SHIPPING_WEBHOOK_REQUIRE_SIGNATURE: process.env.SHIPPING_WEBHOOK_REQUIRE_SIGNATURE,
      SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: process.env.SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS
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
      MYRIVO_PUBLIC_APP_URL: process.env.MYRIVO_PUBLIC_APP_URL,
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

export function getExternalAppUrl() {
  if (!cachedExternalAppUrl) {
    const env = appUrlEnvSchema.parse({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      MYRIVO_PUBLIC_APP_URL: process.env.MYRIVO_PUBLIC_APP_URL,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
      VERCEL_URL: process.env.VERCEL_URL
    });

    const candidate = env.MYRIVO_PUBLIC_APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;

    if (!candidate) {
      throw new Error(
        "Missing external app URL configuration (MYRIVO_PUBLIC_APP_URL, NEXT_PUBLIC_APP_URL, or Vercel URL fallback)."
      );
    }

    cachedExternalAppUrl = z.string().url().parse(normalizeHostOrUrl(candidate));
  }

  return cachedExternalAppUrl;
}

export function getEnv() {
  return { ...getPublicEnv(), ...getServerEnv(), ...getStripeEnv(), NEXT_PUBLIC_APP_URL: getAppUrl() };
}

export function getOptionalStripePublishableKey() {
  return getPublicEnv().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;
}
