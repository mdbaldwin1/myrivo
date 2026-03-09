function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cloneEditorValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function areEditorValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function getEditorValueAtPath(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isPlainRecord(current)) {
      return undefined;
    }

    return current[key];
  }, input);
}

export function setEditorValueAtPath<T extends Record<string, unknown>>(input: T, path: string, value: unknown): T {
  const keys = path.split(".").filter(Boolean);
  if (keys.length === 0) {
    return input;
  }

  const root = { ...input } as Record<string, unknown>;
  let cursor = root;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index]!;
    const next = cursor[key];
    cursor[key] = isPlainRecord(next) ? { ...next } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[keys[keys.length - 1]!] = value;
  return root as T;
}
