import fs from "node:fs";
import path from "node:path";

/**
 * Removes the merchants and stores this run created. Best-effort by design:
 * a cancelled or crashed run never gets here, which is why global setup - not
 * this file - is what keeps the suite away from shared backends.
 */
function readEnvFile() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return {} as Record<string, string>;
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  ) as Record<string, string>;
}

export default async function globalTeardown() {
  const manifest = path.resolve(__dirname, ".created-identities.json");
  if (!fs.existsSync(manifest)) return;

  let emails: string[] = [];
  try {
    emails = JSON.parse(fs.readFileSync(manifest, "utf8")) as string[];
  } catch {
    return;
  }
  if (emails.length === 0) {
    fs.rmSync(manifest, { force: true });
    return;
  }

  const env = readEnvFile();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return;

  const headers = { apikey: serviceRole, authorization: `Bearer ${serviceRole}`, "content-type": "application/json" };
  const listed = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers })
    .then((response) => (response.ok ? response.json() : { users: [] }))
    .catch(() => ({ users: [] }));

  const byEmail = new Map<string, string>(
    ((listed as { users?: Array<{ id: string; email?: string }> }).users ?? [])
      .filter((user) => user.email)
      .map((user) => [user.email!.toLowerCase(), user.id]),
  );

  let removedStores = 0;
  let removedUsers = 0;
  for (const email of emails) {
    const userId = byEmail.get(email.toLowerCase());
    if (!userId) continue;

    // Stores cascade their catalog, carts, and settings on delete.
    const stores = await fetch(`${supabaseUrl}/rest/v1/stores?select=id&owner_user_id=eq.${userId}`, { headers })
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => []);
    for (const store of stores as Array<{ id: string }>) {
      const deleted = await fetch(`${supabaseUrl}/rest/v1/stores?id=eq.${store.id}`, { method: "DELETE", headers })
        .then((response) => response.ok)
        .catch(() => false);
      if (deleted) removedStores += 1;
    }

    const deletedUser = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers })
      .then((response) => response.ok)
      .catch(() => false);
    if (deletedUser) removedUsers += 1;
  }

  fs.rmSync(manifest, { force: true });
  if (removedStores || removedUsers) {
    console.log(`[e2e teardown] removed ${removedStores} store(s) and ${removedUsers} test merchant(s)`);
  }
}
