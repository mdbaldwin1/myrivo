import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const scanDirs = [join(root, "components"), join(root, "app")];
const legacyMatchers = [
  { label: "/dashboard/catalog", pattern: /\/dashboard\/catalog(?:\/|["'`]|$)/ },
  { label: "/dashboard/orders", pattern: /\/dashboard\/orders(?:\/|["'`]|$)/ },
  { label: "/dashboard/marketing", pattern: /\/dashboard\/marketing(?:\/|["'`]|$)/ },
  { label: "/dashboard/content-workspace", pattern: /\/dashboard\/content-workspace(?:\/|["'`]|$)/ },
  { label: "/dashboard/reports", pattern: /\/dashboard\/reports(?:\/|["'`]|$)/ },
  { label: "/dashboard/store-settings", pattern: /\/dashboard\/store-settings(?:\/|["'`]|$)/ },
  { label: "/dashboard/subscribers", pattern: /\/dashboard\/subscribers(?:\/|["'`]|$)/ },
  { label: "/dashboard/insights", pattern: /\/dashboard\/insights(?:\/|["'`]|$)/ },
  { label: "/dashboard/billing", pattern: /\/dashboard\/billing(?:\/|["'`]|$)/ },
  { label: "/dashboard/store", pattern: /\/dashboard\/store(?:\/|["'`]|$)/ }
];

const violations = [];

function isLegacyFile(path) {
  return (
    path.includes("/app/dashboard/catalog/") ||
    path.includes("/app/dashboard/orders/") ||
    path.includes("/app/dashboard/marketing/") ||
    path.includes("/app/dashboard/content-workspace/") ||
    path.includes("/app/dashboard/reports/") ||
    path.includes("/app/dashboard/store-settings/") ||
    path.includes("/app/dashboard/store/") ||
    path.includes("/app/dashboard/subscribers/") ||
    path.includes("/app/dashboard/insights/") ||
    path.includes("/app/dashboard/billing/")
  );
}

function inspectFile(path) {
  if ((!path.endsWith(".ts") && !path.endsWith(".tsx")) || isLegacyFile(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed.includes("/dashboard/")) {
      return;
    }

    const isNavigationalLine =
      trimmed.includes("href") ||
      trimmed.includes("router.push(") ||
      trimmed.includes("router.replace(") ||
      trimmed.includes("redirect(") ||
      trimmed.includes("window.location");

    if (!isNavigationalLine) {
      return;
    }

    const offendingMatcher = legacyMatchers.find(({ pattern }) => pattern.test(trimmed));
    if (!offendingMatcher) {
      return;
    }

    const allowedLegacyUse =
      path.endsWith("/app/dashboard/_lib/legacy-store-route-redirect.ts") ||
      trimmed.includes("redirectToActiveStoreWorkspace(");

    if (allowedLegacyUse) {
      return;
    }

    violations.push(`${path}:${index + 1} uses legacy dashboard path (${offendingMatcher.label}) in navigation.`);
  });
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    inspectFile(fullPath);
  }
}

for (const dir of scanDirs) {
  walk(dir);
}

if (violations.length > 0) {
  console.error("Dashboard route consistency checks failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Dashboard route consistency checks passed.");
