import { getAtPath } from "@/components/dashboard/use-store-experience-section";

export type ContentBlockDraft = {
  id: string;
  sortOrder: number;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
};

export type AboutSectionDraft = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  layout: "image_left" | "image_right" | "full";
};

export type PolicyFaqDraft = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getStringValue(input: Record<string, unknown>, path: string, fallback = ""): string {
  const value = getAtPath(input, path);
  return typeof value === "string" ? value : fallback;
}

export function getBooleanValue(input: Record<string, unknown>, path: string, fallback = false): boolean {
  const value = getAtPath(input, path);
  return typeof value === "boolean" ? value : fallback;
}

export function getNumberValue(input: Record<string, unknown>, path: string, fallback = 0): number {
  const value = getAtPath(input, path);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseContentBlocks(input: unknown): ContentBlockDraft[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      return {
        id: typeof record.id === "string" ? record.id : createId("block"),
        sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : index,
        eyebrow: typeof record.eyebrow === "string" ? record.eyebrow : "",
        title: typeof record.title === "string" ? record.title : "",
        body: typeof record.body === "string" ? record.body : "",
        ctaLabel: typeof record.ctaLabel === "string" ? record.ctaLabel : "",
        ctaUrl: typeof record.ctaUrl === "string" ? record.ctaUrl : "",
        isActive: typeof record.isActive === "boolean" ? record.isActive : true
      } as ContentBlockDraft;
    })
    .filter((entry): entry is ContentBlockDraft => entry !== null);
}

export function parseAboutSections(input: unknown): AboutSectionDraft[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      return {
        id: typeof record.id === "string" ? record.id : createId("section"),
        title: typeof record.title === "string" ? record.title : "",
        body: typeof record.body === "string" ? record.body : "",
        imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : "",
        layout:
          record.layout === "image_left" || record.layout === "image_right" || record.layout === "full"
            ? record.layout
            : "image_right"
      } as AboutSectionDraft;
    })
    .filter((entry): entry is AboutSectionDraft => entry !== null);
}

export function parsePolicyFaqs(input: unknown): PolicyFaqDraft[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      return {
        id: typeof record.id === "string" ? record.id : createId("faq"),
        question: typeof record.question === "string" ? record.question : "",
        answer: typeof record.answer === "string" ? record.answer : "",
        sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : index,
        isActive: typeof record.isActive === "boolean" ? record.isActive : true
      } as PolicyFaqDraft;
    })
    .filter((entry): entry is PolicyFaqDraft => entry !== null);
}
