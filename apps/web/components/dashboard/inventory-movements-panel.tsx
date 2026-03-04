"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InventoryMovement = {
  id: string;
  product_id: string;
  order_id: string | null;
  delta_qty: number;
  reason: "sale" | "restock" | "adjustment";
  note: string | null;
  created_at: string;
  products?: { title?: string } | null;
};

type InventoryMovementsResponse = {
  movements?: InventoryMovement[];
  error?: string;
};

export function InventoryMovementsPanel() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/inventory/movements");
    const payload = (await response.json()) as InventoryMovementsResponse;

    setLoading(false);

    if (!response.ok || !payload.movements) {
      setError(payload.error ?? "Unable to load inventory movements.");
      return;
    }

    setMovements(payload.movements);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/inventory/movements");
      const payload = (await response.json()) as InventoryMovementsResponse;

      if (!active) {
        return;
      }

      setLoading(false);

      if (!response.ok || !payload.movements) {
        setError(payload.error ?? "Unable to load inventory movements.");
        return;
      }

      setMovements(payload.movements);
    }

    const handleInventoryChanged = () => {
      if (!active) {
        return;
      }
      void loadMovements();
    };

    window.addEventListener("inventory:changed", handleInventoryChanged);
    void loadInitial();

    return () => {
      active = false;
      window.removeEventListener("inventory:changed", handleInventoryChanged);
    };
  }, [loadMovements]);

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Inventory Ledger</CardTitle>
        <CardDescription>Last 50 inventory movements for audit and support workflows.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">

      {loading ? <p className="text-sm text-muted-foreground">Loading ledger...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error ? (
        <ul className="space-y-2">
          {movements.length === 0 ? (
            <li className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">No inventory events yet.</li>
          ) : (
            movements.map((movement) => (
              <li key={movement.id} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{movement.products?.title ?? movement.product_id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      movement.delta_qty < 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {movement.delta_qty > 0 ? `+${movement.delta_qty}` : movement.delta_qty}
                  </span>
                  <Badge variant="outline">{movement.reason}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(movement.created_at).toLocaleString()}
                  {movement.order_id ? ` • order ${movement.order_id}` : ""}
                  {movement.note ? ` • ${movement.note}` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
      </CardContent>
    </Card>
  );
}
