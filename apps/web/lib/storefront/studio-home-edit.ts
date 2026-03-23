import { setEditorValueAtPath } from "@/lib/store-editor/object-path";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeContentBlocks(section: Record<string, unknown>) {
  return Array.isArray(section.contentBlocks)
    ? section.contentBlocks.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
}

export function setStorefrontStudioHomeField(section: Record<string, unknown>, path: string, value: string) {
  return setEditorValueAtPath(section, path, value);
}

export function updateStorefrontStudioHomeContentBlock(
  section: Record<string, unknown>,
  blockId: string,
  updates: Record<string, unknown>
) {
  const nextContentBlocks = normalizeContentBlocks(section).map((entry) =>
    String(entry.id ?? "") === blockId
      ? {
          ...entry,
          ...updates
        }
      : entry
  );

  return {
    ...section,
    contentBlocks: nextContentBlocks
  };
}
