export type WelcomeIntent = "shop" | "sell";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isWelcomeIntent(value: unknown): value is WelcomeIntent {
  return value === "shop" || value === "sell";
}

export function resolveWelcomeIntent(metadata: Record<string, unknown> | null | undefined): WelcomeIntent | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const value = metadata.welcome_intent;
  return isWelcomeIntent(value) ? value : null;
}

export function withWelcomeIntent(metadata: Record<string, unknown> | null | undefined, intent: WelcomeIntent) {
  const base = isRecord(metadata) ? metadata : {};
  return {
    ...base,
    welcome_intent: intent
  };
}
