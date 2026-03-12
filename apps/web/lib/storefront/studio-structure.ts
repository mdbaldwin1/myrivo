import { createId, parseAboutSections, parseContentBlocks, parsePolicyFaqs } from "@/components/dashboard/store-experience-form-utils";
import { setEditorValueAtPath } from "@/lib/store-editor/object-path";

export type StorefrontStudioSelection =
  | { kind: "home-content-block"; id: string }
  | { kind: "about-section"; id: string }
  | { kind: "policies-faq"; id: string }
  | null;

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return items;
  }
  next.splice(toIndex, 0, moved);
  return next;
}

export function addHomeContentBlock(section: Record<string, unknown>) {
  const blocks = parseContentBlocks(section.contentBlocks);
  return setEditorValueAtPath(section, "contentBlocks", [
    ...blocks,
    {
      id: createId("block"),
      sortOrder: blocks.length,
      eyebrow: "",
      title: "",
      body: "",
      ctaLabel: "",
      ctaUrl: "",
      isActive: true
    }
  ]);
}

export function insertHomeContentBlockAfter(section: Record<string, unknown>, afterBlockId: string) {
  const blocks = parseContentBlocks(section.contentBlocks);
  const insertIndex = blocks.findIndex((entry) => entry.id === afterBlockId);
  const nextBlock = {
    id: createId("block"),
    sortOrder: 0,
    eyebrow: "",
    title: "",
    body: "",
    ctaLabel: "",
    ctaUrl: "",
    isActive: true
  };

  if (insertIndex === -1) {
    return addHomeContentBlock(section);
  }

  const next = [...blocks];
  next.splice(insertIndex + 1, 0, nextBlock);
  return setEditorValueAtPath(
    section,
    "contentBlocks",
    next.map((entry, index) => ({ ...entry, sortOrder: index }))
  );
}

export function updateHomeContentBlock(section: Record<string, unknown>, blockId: string, updates: Record<string, unknown>) {
  const next = parseContentBlocks(section.contentBlocks).map((entry) =>
    entry.id === blockId
      ? {
          ...entry,
          ...updates
        }
      : entry
  );

  return setEditorValueAtPath(section, "contentBlocks", next);
}

export function removeHomeContentBlock(section: Record<string, unknown>, blockId: string) {
  const next = parseContentBlocks(section.contentBlocks)
    .filter((entry) => entry.id !== blockId)
    .map((entry, index) => ({ ...entry, sortOrder: index }));
  return setEditorValueAtPath(section, "contentBlocks", next);
}

export function moveHomeContentBlock(section: Record<string, unknown>, blockId: string, direction: "up" | "down") {
  const blocks = parseContentBlocks(section.contentBlocks);
  const fromIndex = blocks.findIndex((entry) => entry.id === blockId);
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  const next = moveItem(blocks, fromIndex, toIndex).map((entry, index) => ({ ...entry, sortOrder: index }));
  return setEditorValueAtPath(section, "contentBlocks", next);
}

export function addAboutSection(section: Record<string, unknown>) {
  const sections = parseAboutSections(section.aboutSections);
  return setEditorValueAtPath(section, "aboutSections", [
    ...sections,
    {
      id: createId("section"),
      title: "",
      body: "",
      imageUrl: "",
      layout: "image_right"
    }
  ]);
}

export function updateAboutSection(section: Record<string, unknown>, sectionId: string, updates: Record<string, unknown>) {
  const next = parseAboutSections(section.aboutSections).map((entry) =>
    entry.id === sectionId
      ? {
          ...entry,
          ...updates
        }
      : entry
  );

  return setEditorValueAtPath(section, "aboutSections", next);
}

export function removeAboutSection(section: Record<string, unknown>, sectionId: string) {
  const next = parseAboutSections(section.aboutSections).filter((entry) => entry.id !== sectionId);
  return setEditorValueAtPath(section, "aboutSections", next);
}

export function moveAboutSection(section: Record<string, unknown>, sectionId: string, direction: "up" | "down") {
  const sections = parseAboutSections(section.aboutSections);
  const fromIndex = sections.findIndex((entry) => entry.id === sectionId);
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  return setEditorValueAtPath(section, "aboutSections", moveItem(sections, fromIndex, toIndex));
}

export function addPoliciesFaq(section: Record<string, unknown>) {
  const faqs = parsePolicyFaqs(section.policyFaqs);
  return setEditorValueAtPath(section, "policyFaqs", [
    ...faqs,
    {
      id: createId("faq"),
      question: "",
      answer: "",
      sortOrder: faqs.length,
      isActive: true
    }
  ]);
}

export function updatePoliciesFaq(section: Record<string, unknown>, faqId: string, updates: Record<string, unknown>) {
  const next = parsePolicyFaqs(section.policyFaqs).map((entry) =>
    entry.id === faqId
      ? {
          ...entry,
          ...updates
        }
      : entry
  );
  return setEditorValueAtPath(section, "policyFaqs", next);
}

export function removePoliciesFaq(section: Record<string, unknown>, faqId: string) {
  const next = parsePolicyFaqs(section.policyFaqs)
    .filter((entry) => entry.id !== faqId)
    .map((entry, index) => ({ ...entry, sortOrder: index }));
  return setEditorValueAtPath(section, "policyFaqs", next);
}

export function movePoliciesFaq(section: Record<string, unknown>, faqId: string, direction: "up" | "down") {
  const faqs = parsePolicyFaqs(section.policyFaqs);
  const fromIndex = faqs.findIndex((entry) => entry.id === faqId);
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  const next = moveItem(faqs, fromIndex, toIndex).map((entry, index) => ({ ...entry, sortOrder: index }));
  return setEditorValueAtPath(section, "policyFaqs", next);
}
