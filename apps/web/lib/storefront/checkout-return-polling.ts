export const CHECKOUT_RETURN_POLLING = Object.freeze({
  timeoutMs: 10 * 60_000,
  initialDelayMs: 500,
  maximumDelayMs: 5_000,
  backoffMultiplier: 1.5
});
