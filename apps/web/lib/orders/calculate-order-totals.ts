export function calculatePlatformFeeCents(subtotalCents: number, platformFeeBps: number): number {
  return Math.round((subtotalCents * platformFeeBps) / 10000);
}

export function calculateOrderTotals(subtotalCents: number, platformFeeBps: number) {
  const platformFeeCents = calculatePlatformFeeCents(subtotalCents, platformFeeBps);

  return {
    subtotalCents,
    totalCents: subtotalCents,
    platformFeeBps,
    platformFeeCents
  };
}
