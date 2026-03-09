import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export type DocSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type OwnerDocCategory = "Getting Started" | "Operations" | "Storefront" | "Team" | "Reporting";

export type OwnerDoc = {
  slug: string;
  title: string;
  summary: string;
  category: OwnerDocCategory;
  audience: string;
  lastUpdated: string;
  sections: DocSection[];
};

const frontmatterSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  category: z.enum(["Getting Started", "Operations", "Storefront", "Team", "Reporting"]),
  audience: z.string().trim().min(1),
  lastUpdated: z.string().trim().min(1)
});

function resolveDocsDirectory() {
  const candidates = [path.join(process.cwd(), "content", "docs"), path.join(process.cwd(), "apps", "web", "content", "docs")];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("Unable to resolve docs content directory.");
  }
  return found;
}

function parseFrontmatter(raw: string) {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---\n")) {
    throw new Error("Doc content missing frontmatter block.");
  }

  const end = trimmed.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error("Doc frontmatter block is not closed.");
  }

  const frontmatterRaw = trimmed.slice(4, end);
  const body = trimmed.slice(end + 5).trim();
  const fields = Object.fromEntries(
    frontmatterRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf(":");
        if (index === -1) {
          throw new Error(`Invalid frontmatter line: ${line}`);
        }
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        return [key, value];
      })
  );

  return {
    metadata: frontmatterSchema.parse(fields),
    body
  };
}

function parseSections(markdown: string): DocSection[] {
  const sections = markdown
    .split(/^##\s+/gm)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const heading = (lines.shift() ?? "").trim();
      const paragraphs: string[] = [];
      const bullets: string[] = [];

      let buffer: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (buffer.length > 0) {
            paragraphs.push(buffer.join(" "));
            buffer = [];
          }
          continue;
        }
        if (trimmed.startsWith("- ")) {
          if (buffer.length > 0) {
            paragraphs.push(buffer.join(" "));
            buffer = [];
          }
          bullets.push(trimmed.slice(2).trim());
          continue;
        }
        buffer.push(trimmed);
      }
      if (buffer.length > 0) {
        paragraphs.push(buffer.join(" "));
      }

      return {
        heading,
        paragraphs,
        bullets: bullets.length > 0 ? bullets : undefined
      };
    });

  if (sections.length === 0) {
    throw new Error("Doc body must contain at least one `##` section.");
  }

  return sections;
}

function loadOwnerDocsFromFiles(): OwnerDoc[] {
  const directory = resolveDocsDirectory();
  const files = fs.readdirSync(directory).filter((file) => file.endsWith(".md"));
  const docs = files.map((file): OwnerDoc => {
    const absolutePath = path.join(directory, file);
    const raw = fs.readFileSync(absolutePath, "utf8");
    const parsed = parseFrontmatter(raw);
    return {
      ...parsed.metadata,
      sections: parseSections(parsed.body)
    };
  });

  return docs.sort((a, b) => a.title.localeCompare(b.title));
}

export const OWNER_DOCS: OwnerDoc[] = loadOwnerDocsFromFiles();

export const DOC_CATEGORY_ORDER: OwnerDoc["category"][] = [
  "Getting Started",
  "Operations",
  "Storefront",
  "Team",
  "Reporting"
];

export function getOwnerDocBySlug(slug: string) {
  return OWNER_DOCS.find((doc) => doc.slug === slug) ?? null;
}

export function getOwnerDocsByCategory() {
  return DOC_CATEGORY_ORDER.map((category) => ({
    category,
    docs: OWNER_DOCS.filter((doc) => doc.category === category)
  })).filter((entry) => entry.docs.length > 0);
}
