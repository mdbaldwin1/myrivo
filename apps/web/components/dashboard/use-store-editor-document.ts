"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ZodType } from "zod";
import { notify } from "@/lib/feedback/toast";
import { areEditorValuesEqual, cloneEditorValue, setEditorValueAtPath } from "@/lib/store-editor/object-path";

type ValidationErrors = Record<string, string>;

type UseStoreEditorDocumentOptions<TDraft extends Record<string, unknown>> = {
  emptyDraft: TDraft;
  loadDocument: () => Promise<TDraft>;
  saveDocument: (draft: TDraft) => Promise<TDraft>;
  schema?: ZodType<TDraft>;
  successMessage?: string;
};

function toValidationErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): ValidationErrors {
  return error.issues.reduce<ValidationErrors>((all, issue) => {
    const key = issue.path.map(String).join(".");
    if (!key || all[key]) {
      return all;
    }

    all[key] = issue.message;
    return all;
  }, {});
}

export function useStoreEditorDocument<TDraft extends Record<string, unknown>>({
  emptyDraft,
  loadDocument,
  saveDocument,
  schema,
  successMessage
}: UseStoreEditorDocumentOptions<TDraft>) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState<TDraft>(() => cloneEditorValue(emptyDraft));
  const [draft, setDraft] = useState<TDraft>(() => cloneEditorValue(emptyDraft));
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const isDirty = useMemo(() => !areEditorValuesEqual(draft, baseline), [baseline, draft]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      setValidationErrors({});

      try {
        const next = await loadDocument();

        if (cancelled) {
          return;
        }

        setBaseline(cloneEditorValue(next));
        setDraft(cloneEditorValue(next));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load editor document.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadDocument]);

  const setFieldValue = useCallback((path: string, value: unknown) => {
    setDraft((current) => setEditorValueAtPath(current, path, value));
    setValidationErrors((current) => {
      if (!current[path]) {
        return current;
      }

      const next = { ...current };
      delete next[path];
      return next;
    });
    setError(null);
  }, []);

  const discardChanges = useCallback(() => {
    setDraft(cloneEditorValue(baseline));
    setError(null);
    setValidationErrors({});
  }, [baseline]);

  const replaceDocument = useCallback((next: TDraft) => {
    const cloned = cloneEditorValue(next);
    setBaseline(cloned);
    setDraft(cloneEditorValue(next));
    setError(null);
    setValidationErrors({});
  }, []);

  const save = useCallback(async () => {
    if (schema) {
      const parsed = schema.safeParse(draft);
      if (!parsed.success) {
        const nextValidationErrors = toValidationErrors(parsed.error);
        setValidationErrors(nextValidationErrors);
        setError(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
        return false;
      }
    }

    setSaving(true);
    setError(null);
    setValidationErrors({});

    try {
      const saved = await saveDocument(draft);
      setBaseline(cloneEditorValue(saved));
      setDraft(cloneEditorValue(saved));
      if (successMessage) {
        notify.success(successMessage);
      }
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save editor document.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, saveDocument, schema, successMessage]);

  return {
    loading,
    saving,
    draft,
    setDraft,
    setFieldValue,
    error,
    validationErrors,
    isDirty,
    save,
    discardChanges,
    replaceDocument
  };
}
