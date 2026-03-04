import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const filePath = join(process.cwd(), "next-env.d.ts");
const DEV_IMPORT = 'import "./.next/dev/types/routes.d.ts";';
const STABLE_IMPORT = 'import "./.next/types/routes.d.ts";';

async function main() {
  const source = await readFile(filePath, "utf8");
  if (!source.includes(DEV_IMPORT)) {
    return;
  }

  const normalized = source.replace(DEV_IMPORT, STABLE_IMPORT);
  await writeFile(filePath, normalized, "utf8");
}

main().catch((error) => {
  console.error("Failed to normalize next-env.d.ts", error);
  process.exit(1);
});
