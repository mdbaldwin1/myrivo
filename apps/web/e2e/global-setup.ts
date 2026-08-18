import fs from "node:fs";
import path from "node:path";

/**
 * The end-to-end suite signs merchants up and creates real stores, so pointing
 * it at a shared backend leaves that data behind for good. Twenty-three
 * "Sunset Studio" stores reached production this way. Teardown alone cannot
 * prevent it - a crashed or cancelled run never reaches teardown - so refuse to
 * start against a remote backend unless someone says so deliberately.
 */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

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

export default function globalSetup() {
  const env = readEnvFile();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("E2E requires NEXT_PUBLIC_SUPABASE_URL so the target backend can be verified.");
  }

  const host = new URL(supabaseUrl).hostname;
  const isLoopback = LOOPBACK_HOSTS.has(host);
  const allowRemote = (process.env.E2E_ALLOW_REMOTE_SUPABASE ?? "").trim() === "true";

  if (!isLoopback && !allowRemote) {
    throw new Error(
      `Refusing to run end-to-end tests against ${host}: this suite creates merchants and stores that cannot be `
        + "distinguished from real ones afterwards. Point NEXT_PUBLIC_SUPABASE_URL at a local Supabase stack, or set "
        + "E2E_ALLOW_REMOTE_SUPABASE=true if the target really is a disposable non-production project.",
    );
  }

  // Each run records the identities it creates so teardown removes exactly
  // those, rather than guessing from naming patterns.
  fs.writeFileSync(path.resolve(__dirname, ".created-identities.json"), "[]");
}
