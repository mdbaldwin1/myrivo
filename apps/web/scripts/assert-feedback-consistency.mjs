import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const appDir = join(root, "components");

const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!fullPath.endsWith(".tsx") && !fullPath.endsWith(".ts")) {
      continue;
    }

    const content = readFileSync(fullPath, "utf8");

    if (fullPath.endsWith("lib/feedback/toast.ts") || fullPath.endsWith("components/ui/toaster.tsx")) {
      continue;
    }

    if (content.includes('from "sonner"')) {
      violations.push(`${fullPath}: import sonner via lib/feedback/toast.ts only.`);
    }

    const redParagraphPattern = /<p\s+className="[^"]*text-red-600[^"]*"[^>]*>\{[^}]+\}<\/p>/g;
    if (redParagraphPattern.test(content)) {
      violations.push(`${fullPath}: replace raw text-red-600 paragraph feedback with AppAlert/FeedbackMessage.`);
    }
  }
}

walk(appDir);

if (violations.length > 0) {
  console.error("Feedback consistency checks failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Feedback consistency checks passed.");
