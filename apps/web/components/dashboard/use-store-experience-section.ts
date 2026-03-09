"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import type { StoreExperienceContentSection } from "@/lib/store-experience/content";

type ContentPayload = {
  content?: Record<string, Record<string, unknown>>;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getAtPath(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined;
    }
    return current[key];
  }, input);
}

export function setAtPath(input: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".").filter(Boolean);
  if (keys.length === 0) {
    return input;
  }

  const root: Record<string, unknown> = { ...input };
  let cursor: Record<string, unknown> = root;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index]!;
    const next = cursor[key];
    cursor[key] = isRecord(next) ? { ...next } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[keys[keys.length - 1]!] = value;
  return root;
}

export function useStoreExperienceSection(section: StoreExperienceContentSection) {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [baseline, draft]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const response = await fetch(buildStoreScopedApiPath("/api/store-experience/content", storeSlug), { cache: "no-store" });
        const payload = (await response.json()) as ContentPayload;

        if (!response.ok || !payload.content) {
          if (!cancelled) {
            setError(payload.error ?? "Unable to load section.");
          }
          return;
        }

        const sectionValue = payload.content[section];
        const normalized = isRecord(sectionValue) ? sectionValue : {};

        if (!cancelled) {
          setBaseline(normalized);
          setDraft(normalized);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load section.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [section, storeSlug]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/store-experience/content", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, value: draft })
      });

      const payload = (await response.json()) as ContentPayload;

      if (!response.ok || !payload.content) {
        setError(payload.error ?? "Unable to save section.");
        return false;
      }

      const sectionValue = payload.content[section];
      const normalized = isRecord(sectionValue) ? sectionValue : {};
      setBaseline(normalized);
      setDraft(normalized);
      notify.success("Section saved.");
      return true;
    } catch {
      setError("Unable to save section.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, section, storeSlug]);

  const discard = useCallback(() => {
    setDraft(baseline);
    setError(null);
    setMessage(null);
  }, [baseline]);

  return {
    loading,
    saving,
    draft,
    setDraft,
    error,
    message,
    isDirty,
    save,
    discard
  };
}
