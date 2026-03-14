import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function buildMerchantIdentity() {
  const suffix = uniqueSuffix();
  return {
    suffix,
    email: `myrivo+${suffix}@example.com`,
    password: `Myrivo!${suffix.slice(-6)}`,
    storeName: `Tallow Studio ${suffix.slice(-4)}`,
    storeSlug: `tallow-${suffix.slice(-8).replace(/[^a-z0-9]/gi, "").toLowerCase()}`
  };
}

function readLocalEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const entries = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator === -1) return null;
      return [line.slice(0, separator), line.slice(separator + 1)] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  return Object.fromEntries(entries);
}

async function ensureUserExists(email: string, password: string) {
  const env = readLocalEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing Supabase URL or service role key for E2E setup.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true
    })
  });

  if (response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => ({}))) as { msg?: string };
  if (response.status === 422 && (payload.msg ?? "").toLowerCase().includes("already")) {
    return;
  }

  throw new Error(`Unable to provision E2E user: ${response.status} ${payload.msg ?? "unknown error"}`);
}

type OwnerStoreIdentity = {
  email: string;
  password: string;
  storeName: string;
  storeSlug: string;
};

type StoreBundlePayload = {
  store?: {
    name?: string | null;
    slug?: string | null;
  } | null;
};

async function querySingleStoreOwnerIdentity(): Promise<OwnerStoreIdentity> {
  const env = readLocalEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  const storeSlug = (env.MYRIVO_SINGLE_STORE_SLUG || "at-home-apothecary").trim().toLowerCase();

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing Supabase URL or service role key for E2E owner fallback.");
  }

  const storeResponse = await fetch(`${supabaseUrl}/rest/v1/stores?select=id,name,slug,owner_user_id&slug=eq.${storeSlug}&limit=1`, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`
    }
  });

  const storePayload = (await storeResponse.json().catch(() => [])) as Array<{
    name: string | null;
    slug: string;
    owner_user_id: string | null;
  }>;

  if (!storeResponse.ok || storePayload.length === 0 || !storePayload[0]?.owner_user_id) {
    throw new Error(`Unable to resolve owner user for store slug '${storeSlug}'.`);
  }

  const configuredOwnerEmail = env.E2E_OWNER_EMAIL?.trim();
  const configuredOwnerPassword = env.E2E_OWNER_PASSWORD?.trim();
  if (configuredOwnerEmail && configuredOwnerPassword) {
    return {
      email: configuredOwnerEmail,
      password: configuredOwnerPassword,
      storeName: storePayload[0].name?.trim() || "Store",
      storeSlug: storePayload[0].slug
    };
  }

  if (env.E2E_ALLOW_OWNER_PASSWORD_RESET !== "true") {
    throw new Error(
      "Owner fallback requires E2E_OWNER_EMAIL + E2E_OWNER_PASSWORD, or set E2E_ALLOW_OWNER_PASSWORD_RESET=true to allow temporary password reset."
    );
  }

  const ownerUserId = storePayload[0].owner_user_id;
  const ownerUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${ownerUserId}`, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`
    }
  });
  const ownerUserPayload = (await ownerUserResponse.json().catch(() => ({}))) as { email?: string | null; user?: { email?: string | null } };
  const ownerEmail = ownerUserPayload.email?.trim() || ownerUserPayload.user?.email?.trim();

  if (!ownerUserResponse.ok || !ownerEmail) {
    throw new Error(`Unable to resolve owner email for user '${ownerUserId}'.`);
  }

  const password = "Myrivo!OwnerE2E1";
  const resetResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${ownerUserId}`, {
    method: "PUT",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      password,
      email_confirm: true
    })
  });

  if (!resetResponse.ok) {
    throw new Error(`Unable to reset owner password for E2E fallback (status ${resetResponse.status}).`);
  }

  return {
    email: ownerEmail,
    password,
    storeName: storePayload[0].name?.trim() || "Store",
    storeSlug: storePayload[0].slug
  };
}

export { querySingleStoreOwnerIdentity };

async function getCurrentStoreIdentity(page: Page): Promise<{ storeName: string; storeSlug: string } | null> {
  const response = await page.request.get("/api/stores/current");
  if (!response.ok()) {
    return null;
  }

  const payload = (await response.json()) as StoreBundlePayload;
  const storeName = payload.store?.name?.trim() ?? "";
  const storeSlug = payload.store?.slug?.trim().toLowerCase() ?? "";

  if (!storeName || !storeSlug) {
    return null;
  }

  return { storeName, storeSlug };
}

export async function signupAndOnboard(page: Page) {
  const identity = buildMerchantIdentity();
  let ownerFallback: OwnerStoreIdentity | null = null;
  try {
    await ensureUserExists(identity.email, identity.password);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Database error creating new user")) {
      ownerFallback = await querySingleStoreOwnerIdentity();
    } else {
      throw error;
    }
  }

  try {
    await login(page, identity.email, identity.password);
  } catch {
    ownerFallback = ownerFallback ?? (await querySingleStoreOwnerIdentity());
    await login(page, ownerFallback.email, ownerFallback.password);
    await expect(page).toHaveURL(/\/dashboard/);

    const currentStore = await getCurrentStoreIdentity(page);
    return {
      suffix: uniqueSuffix(),
      email: ownerFallback.email,
      password: ownerFallback.password,
      storeName: currentStore?.storeName ?? ownerFallback.storeName,
      storeSlug: currentStore?.storeSlug ?? ownerFallback.storeSlug
    };
  }

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByPlaceholder("At Home Apothecary").fill(identity.storeName);
  await page.getByRole("button", { name: /create store/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(identity.storeName)).toBeVisible();

  const currentStore = await getCurrentStoreIdentity(page);

  return {
    ...identity,
    storeName: currentStore?.storeName ?? identity.storeName,
    storeSlug: currentStore?.storeSlug ?? identity.storeSlug
  };
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("owner@yourshop.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
}

export async function activateStore(page: Page) {
  await setStoreStatus(page, "active");
}

export async function setStoreStatus(page: Page, status: "active" | "draft" | "suspended") {
  await page.goto("/dashboard/store-settings/profile");
  const profileForm = page.locator("#store-profile-form");
  const currentStatusButton = profileForm.getByText(/^(Draft|Active|Suspended)$/).first();
  await currentStatusButton.click();
  const optionLabel = status.charAt(0).toUpperCase() + status.slice(1);
  await page.getByRole("option", { name: optionLabel }).click();
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/store profile saved/i)).toBeVisible();
}
