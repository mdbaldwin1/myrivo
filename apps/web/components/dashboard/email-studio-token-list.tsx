"use client";

import { EMAIL_STUDIO_TOKENS } from "@/lib/email-studio/model";

type EmailStudioTokenListProps = {
  onInsertToken: (token: string) => void;
};

export function EmailStudioTokenList({ onInsertToken }: EmailStudioTokenListProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tokens</p>
        <p className="text-xs text-muted-foreground">Insert placeholders for order, customer, fulfillment, and welcome-offer data.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {EMAIL_STUDIO_TOKENS.map((token) => (
          <button
            key={token.token}
            type="button"
            onClick={() => onInsertToken(token.token)}
            className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/25 hover:bg-primary/5"
            title={token.description}
          >
            {token.token}
          </button>
        ))}
      </div>
    </div>
  );
}
