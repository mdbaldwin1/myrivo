"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DigitalOrderDownloads({ orderId, email, fileCount }: { orderId: string; email: string; fileCount: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return <section className="rounded-xl border border-border p-4"><h2 className="font-semibold">Digital downloads</h2><p className="mt-1 text-sm text-muted-foreground">{fileCount} purchased {fileCount === 1 ? "file" : "files"}. For security, download links expire after 48 hours.</p><Button className="mt-3" type="button" disabled={pending} onClick={async () => { setPending(true); const response = await fetch("/api/digital-downloads/request-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, email }) }); const payload = await response.json(); setMessage(payload.message ?? (response.ok ? "Check your email." : "Unable to send a link.")); setPending(false); }}>{pending ? "Sending…" : "Email me a fresh download link"}</Button>{message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}</section>;
}
