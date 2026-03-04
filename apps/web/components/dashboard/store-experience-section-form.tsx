"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StoreExperienceContentSection } from "@/lib/store-experience/content";

type FieldType = "text" | "textarea" | "number" | "checkbox" | "json" | "contentBlocks" | "aboutSections" | "policyFaqs";

export type StoreExperienceField = {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  placeholder?: string;
  rows?: number;
};

type StoreExperienceSectionFormProps = {
  title: string;
  section: StoreExperienceContentSection;
  description?: string;
  fields: StoreExperienceField[];
};

type ContentPayload = {
  content?: Record<string, Record<string, unknown>>;
  error?: string;
};

type ContentBlockDraft = {
  id: string;
  sortOrder: number;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
};

type AboutSectionDraft = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  layout: "image_left" | "image_right" | "full";
};

type PolicyFaqDraft = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

function getAtPath(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, input);
}

function setAtPath(input: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  if (keys.length === 0) {
    return input;
  }
  const root = { ...input };
  let cursor: Record<string, unknown> = root;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index] ?? "";
    if (!key) {
      continue;
    }
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  const leaf = keys[keys.length - 1] ?? "";
  if (!leaf) {
    return root;
  }
  cursor[leaf] = value;
  return root;
}

function toDisplayValue(field: StoreExperienceField, value: unknown): string {
  if (field.type === "json") {
    const safe = value && typeof value === "object" ? value : Array.isArray(value) ? value : {};
    return JSON.stringify(safe, null, 2);
  }
  if (field.type === "checkbox") {
    return value ? "true" : "false";
  }
  if (field.type === "number") {
    return typeof value === "number" ? String(value) : "";
  }
  return typeof value === "string" ? value : "";
}

function toSavedValue(field: StoreExperienceField, draft: string): unknown {
  if (field.type === "checkbox") {
    return draft === "true";
  }
  if (field.type === "number") {
    const parsed = Number.parseInt(draft || "0", 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (field.type === "json") {
    const parsed = JSON.parse(draft || "{}") as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  }
  return draft;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseContentBlocks(input: unknown): ContentBlockDraft[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
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

function parseAboutSections(input: unknown): AboutSectionDraft[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
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

function parsePolicyFaqs(input: unknown): PolicyFaqDraft[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
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

function serializeStructuredValue(field: StoreExperienceField, input: unknown): string {
  if (field.type === "contentBlocks") {
    return JSON.stringify(parseContentBlocks(input));
  }
  if (field.type === "aboutSections") {
    return JSON.stringify(parseAboutSections(input));
  }
  if (field.type === "policyFaqs") {
    return JSON.stringify(parsePolicyFaqs(input));
  }
  return JSON.stringify(input ?? null);
}

export function StoreExperienceSectionForm(props: StoreExperienceSectionFormProps) {
  const { title, section, description, fields } = props;
  const formId = `store-experience-form-${section}`;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [structuredDraft, setStructuredDraft] = useState<Record<string, unknown>>({});
  const [structuredBaseline, setStructuredBaseline] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isDirty = useMemo(
    () =>
      JSON.stringify(draft) !== JSON.stringify(baseline) ||
      JSON.stringify(
        Object.fromEntries(
          Object.entries(structuredDraft).map(([key, value]) => {
            const field = fields.find((entry) => entry.key === key);
            return [key, field ? serializeStructuredValue(field, value) : JSON.stringify(value)];
          })
        )
      ) !== JSON.stringify(structuredBaseline),
    [baseline, draft, fields, structuredBaseline, structuredDraft]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/store-experience/content", { cache: "no-store" });
      const payload = (await response.json()) as ContentPayload;

      if (!response.ok || !payload.content) {
        if (!cancelled) {
          setError(payload.error ?? "Unable to load section.");
          setLoading(false);
        }
        return;
      }

      const sectionValue = (payload.content[section] ?? {}) as Record<string, unknown>;
      const next = Object.fromEntries(fields.map((field) => [field.key, toDisplayValue(field, getAtPath(sectionValue, field.key))]));
      const nextStructured = Object.fromEntries(
        fields
          .filter((field) => field.type === "contentBlocks" || field.type === "aboutSections" || field.type === "policyFaqs")
          .map((field) => {
            const rawValue = getAtPath(sectionValue, field.key);
            if (field.type === "contentBlocks") return [field.key, parseContentBlocks(rawValue)];
            if (field.type === "aboutSections") return [field.key, parseAboutSections(rawValue)];
            return [field.key, parsePolicyFaqs(rawValue)];
          })
      );
      const nextStructuredBaseline = Object.fromEntries(
        Object.entries(nextStructured).map(([key, value]) => {
          const field = fields.find((entry) => entry.key === key)!;
          return [key, serializeStructuredValue(field, value)];
        })
      );

      if (!cancelled) {
        setBaseline(next);
        setDraft(next);
        setStructuredDraft(nextStructured);
        setStructuredBaseline(nextStructuredBaseline);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [fields, section]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      setDraft(baseline);
      const resetStructured = Object.fromEntries(
        Object.entries(structuredBaseline).map(([key, value]) => [key, JSON.parse(value)])
      );
      setStructuredDraft(resetStructured);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    let sectionValue: Record<string, unknown> = {};
    try {
      sectionValue = fields.reduce<Record<string, unknown>>((current, field) => {
        if (field.type === "contentBlocks" || field.type === "aboutSections" || field.type === "policyFaqs") {
          const nextValue = structuredDraft[field.key] ?? [];
          return setAtPath(current, field.key, nextValue);
        }
        const raw = draft[field.key] ?? "";
        const nextValue = toSavedValue(field, raw);
        return setAtPath(current, field.key, nextValue);
      }, {});
    } catch {
      setSaving(false);
      setError("One or more JSON fields are invalid.");
      return;
    }

    const response = await fetch("/api/store-experience/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, value: sectionValue })
    });

    const payload = (await response.json()) as ContentPayload;
    setSaving(false);

    if (!response.ok || !payload.content) {
      setError(payload.error ?? "Unable to save section.");
      return;
    }

    setBaseline(draft);
    setStructuredBaseline(
      Object.fromEntries(
        Object.entries(structuredDraft).map(([key, value]) => {
          const field = fields.find((entry) => entry.key === key)!;
          return [key, serializeStructuredValue(field, value)];
        })
      )
    );
    setMessage("Section saved.");
  }

  return (
    <SectionCard title={title}>
      <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">Loading section...</p> : null}
        {!loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                description={field.description}
                className={field.type === "textarea" || field.type === "json" ? "sm:col-span-2" : ""}
              >
                {field.type === "textarea" || field.type === "json" ? (
                  <Textarea
                    rows={field.rows ?? (field.type === "json" ? 10 : 4)}
                    placeholder={field.placeholder}
                    value={draft[field.key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                ) : field.type === "contentBlocks" ? (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    {(structuredDraft[field.key] as ContentBlockDraft[] | undefined)?.map((block, index) => (
                      <div key={block.id} className="space-y-2 rounded-md border border-border/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">Block {index + 1}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).filter((entry) => entry.id !== block.id)
                              }))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="Eyebrow"
                            value={block.eyebrow}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === block.id ? { ...entry, eyebrow: event.target.value } : entry
                                )
                              }))
                            }
                          />
                          <Input
                            type="number"
                            placeholder="Sort order"
                            value={block.sortOrder}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === block.id ? { ...entry, sortOrder: Number.parseInt(event.target.value || "0", 10) } : entry
                                )
                              }))
                            }
                          />
                          <Input
                            className="sm:col-span-2"
                            placeholder="Title"
                            value={block.title}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === block.id ? { ...entry, title: event.target.value } : entry
                                )
                              }))
                            }
                          />
                          <Textarea
                            className="sm:col-span-2"
                            rows={3}
                            placeholder="Body"
                            value={block.body}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === block.id ? { ...entry, body: event.target.value } : entry
                                )
                              }))
                            }
                          />
                          <Input
                            placeholder="CTA Label"
                            value={block.ctaLabel}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === block.id ? { ...entry, ctaLabel: event.target.value } : entry
                                )
                              }))
                            }
                          />
                          <Input
                            placeholder="CTA URL"
                            value={block.ctaUrl}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === block.id ? { ...entry, ctaUrl: event.target.value } : entry
                                )
                              }))
                            }
                          />
                          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={block.isActive}
                              onChange={(event) =>
                                setStructuredDraft((current) => ({
                                  ...current,
                                  [field.key]: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).map((entry) =>
                                    entry.id === block.id ? { ...entry, isActive: event.target.checked } : entry
                                  )
                                }))
                              }
                            />
                            Active
                          </label>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStructuredDraft((current) => ({
                          ...current,
                          [field.key]: [
                            ...((current[field.key] as ContentBlockDraft[] | undefined) ?? []),
                            {
                              id: createId("block"),
                              sortOrder: ((current[field.key] as ContentBlockDraft[] | undefined) ?? []).length,
                              eyebrow: "",
                              title: "",
                              body: "",
                              ctaLabel: "",
                              ctaUrl: "",
                              isActive: true
                            }
                          ]
                        }))
                      }
                    >
                      Add content block
                    </Button>
                  </div>
                ) : field.type === "aboutSections" ? (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    {(structuredDraft[field.key] as AboutSectionDraft[] | undefined)?.map((sectionDraft, index) => (
                      <div key={sectionDraft.id} className="space-y-2 rounded-md border border-border/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">Section {index + 1}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as AboutSectionDraft[] | undefined) ?? []).filter(
                                  (entry) => entry.id !== sectionDraft.id
                                )
                              }))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                        <Input
                          placeholder="Title"
                          value={sectionDraft.title}
                          onChange={(event) =>
                            setStructuredDraft((current) => ({
                              ...current,
                              [field.key]: ((current[field.key] as AboutSectionDraft[] | undefined) ?? []).map((entry) =>
                                entry.id === sectionDraft.id ? { ...entry, title: event.target.value } : entry
                              )
                            }))
                          }
                        />
                        <Textarea
                          rows={3}
                          placeholder="Body"
                          value={sectionDraft.body}
                          onChange={(event) =>
                            setStructuredDraft((current) => ({
                              ...current,
                              [field.key]: ((current[field.key] as AboutSectionDraft[] | undefined) ?? []).map((entry) =>
                                entry.id === sectionDraft.id ? { ...entry, body: event.target.value } : entry
                              )
                            }))
                          }
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="Image URL"
                            value={sectionDraft.imageUrl}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as AboutSectionDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === sectionDraft.id ? { ...entry, imageUrl: event.target.value } : entry
                                )
                              }))
                            }
                          />
                          <Select
                            value={sectionDraft.layout}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as AboutSectionDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === sectionDraft.id
                                    ? { ...entry, layout: event.target.value as AboutSectionDraft["layout"] }
                                    : entry
                                )
                              }))
                            }
                          >
                            <option value="image_right">Image right</option>
                            <option value="image_left">Image left</option>
                            <option value="full">Full width text</option>
                          </Select>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStructuredDraft((current) => ({
                          ...current,
                          [field.key]: [
                            ...((current[field.key] as AboutSectionDraft[] | undefined) ?? []),
                            { id: createId("section"), title: "", body: "", imageUrl: "", layout: "image_right" }
                          ]
                        }))
                      }
                    >
                      Add about section
                    </Button>
                  </div>
                ) : field.type === "policyFaqs" ? (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    {(structuredDraft[field.key] as PolicyFaqDraft[] | undefined)?.map((faq, index) => (
                      <div key={faq.id} className="space-y-2 rounded-md border border-border/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">FAQ {index + 1}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as PolicyFaqDraft[] | undefined) ?? []).filter((entry) => entry.id !== faq.id)
                              }))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                        <Input
                          placeholder="Question"
                          value={faq.question}
                          onChange={(event) =>
                            setStructuredDraft((current) => ({
                              ...current,
                              [field.key]: ((current[field.key] as PolicyFaqDraft[] | undefined) ?? []).map((entry) =>
                                entry.id === faq.id ? { ...entry, question: event.target.value } : entry
                              )
                            }))
                          }
                        />
                        <Textarea
                          rows={3}
                          placeholder="Answer"
                          value={faq.answer}
                          onChange={(event) =>
                            setStructuredDraft((current) => ({
                              ...current,
                              [field.key]: ((current[field.key] as PolicyFaqDraft[] | undefined) ?? []).map((entry) =>
                                entry.id === faq.id ? { ...entry, answer: event.target.value } : entry
                              )
                            }))
                          }
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            type="number"
                            placeholder="Sort order"
                            value={faq.sortOrder}
                            onChange={(event) =>
                              setStructuredDraft((current) => ({
                                ...current,
                                [field.key]: ((current[field.key] as PolicyFaqDraft[] | undefined) ?? []).map((entry) =>
                                  entry.id === faq.id ? { ...entry, sortOrder: Number.parseInt(event.target.value || "0", 10) } : entry
                                )
                              }))
                            }
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={faq.isActive}
                              onChange={(event) =>
                                setStructuredDraft((current) => ({
                                  ...current,
                                  [field.key]: ((current[field.key] as PolicyFaqDraft[] | undefined) ?? []).map((entry) =>
                                    entry.id === faq.id ? { ...entry, isActive: event.target.checked } : entry
                                  )
                                }))
                              }
                            />
                            Active
                          </label>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStructuredDraft((current) => ({
                          ...current,
                          [field.key]: [
                            ...((current[field.key] as PolicyFaqDraft[] | undefined) ?? []),
                            { id: createId("faq"), question: "", answer: "", sortOrder: 0, isActive: true }
                          ]
                        }))
                      }
                    >
                      Add FAQ
                    </Button>
                  </div>
                ) : field.type === "checkbox" ? (
                  <label className="flex h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(draft[field.key] ?? "false") === "true"}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [field.key]: event.target.checked ? "true" : "false"
                        }))
                      }
                    />
                    Enabled
                  </label>
                ) : (
                  <Input
                    type={field.type === "number" ? "number" : "text"}
                    placeholder={field.placeholder}
                    value={draft[field.key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                )}
              </FormField>
            ))}
          </div>
        ) : null}
        <DashboardFormActionBar
          formId={formId}
          className="border-t-0"
          saveLabel="Save"
          savePendingLabel="Saving..."
          discardLabel="Discard"
          savePending={saving}
          saveDisabled={!isDirty || saving || loading}
          discardDisabled={!isDirty || saving || loading}
        />
        <FeedbackMessage type="success" message={message} />
        <FeedbackMessage type="error" message={error} />
      </form>
    </SectionCard>
  );
}
