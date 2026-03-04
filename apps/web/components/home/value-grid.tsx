const valueCards = [
  {
    title: "Maker-first economics",
    description: "Simple transaction-based platform fees with no required monthly subscription for standard stores."
  },
  {
    title: "Inventory you can trust",
    description: "Atomic checkout + inventory ledger means every order leaves an audit trail and keeps stock accurate."
  },
  {
    title: "Own your brand",
    description: "Visual tokens and storefront theming keep your identity at the center of the experience."
  }
];

export function ValueGrid() {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {valueCards.map((card) => (
        <article key={card.title} className="rounded-lg border border-border bg-card/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{card.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
        </article>
      ))}
    </section>
  );
}
