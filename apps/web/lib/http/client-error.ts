export type ApiErrorPayload = {
  error?: string;
  details?: unknown;
};

export async function parseApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}
