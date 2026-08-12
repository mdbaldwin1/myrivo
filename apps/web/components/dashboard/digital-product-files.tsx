"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Asset = { id: string; label: string; digital_product_asset_versions: Array<{ id: string; customer_filename: string; byte_size: number; status: string; version_number: number }> };

export function DigitalProductFiles({ productId }: { productId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    const response = await fetch(`/api/products/digital-assets?productId=${encodeURIComponent(productId)}`);
    const payload = await response.json();
    if (response.ok) setAssets(payload.assets ?? []);
  }
  useEffect(() => { void refresh(); }, [productId]);
  async function upload(file: File) {
    setBusy(true); setError(null);
    try {
      const urlResponse = await fetch("/api/products/digital-assets/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, fileName: file.name, mimeType: file.type, sizeBytes: file.size }) });
      const upload = await urlResponse.json();
      if (!urlResponse.ok) throw new Error(upload.error);
      const direct = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!direct.ok) throw new Error("The file could not be uploaded.");
      const completeResponse = await fetch("/api/products/digital-assets/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: upload.assetId, productId, storagePath: upload.storagePath, fileName: file.name, label: file.name.replace(/\.[^.]+$/, ""), mimeType: file.type }) });
      const complete = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(complete.error);
      await refresh();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Unable to upload file."); } finally { setBusy(false); }
  }
  return <div className="space-y-3"><div><p className="font-medium">Customer files</p><p className="text-xs text-muted-foreground">Private originals. JPG and PNG files automatically receive a watermarked storefront preview.</p></div><Input type="file" disabled={busy || assets.length >= 20} accept=".jpg,.jpeg,.png,.pdf,.zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />{busy ? <p className="text-sm text-muted-foreground">Uploading and preparing preview…</p> : null}{error ? <p className="text-sm text-destructive">{error}</p> : null}<ul className="space-y-2">{assets.map((asset) => { const version = [...asset.digital_product_asset_versions].sort((a,b) => b.version_number-a.version_number)[0]; return <li key={asset.id} className="flex items-center justify-between rounded-md border border-border p-3"><div><p className="text-sm font-medium">{asset.label}</p><p className="text-xs text-muted-foreground">{version?.customer_filename} · {version ? `${(version.byte_size / 1024 / 1024).toFixed(1)} MB` : "Processing"}</p></div><Button type="button" size="sm" variant="outline" onClick={async () => { await fetch("/api/products/digital-assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: asset.id }) }); await refresh(); }}>Remove</Button></li>; })}</ul></div>;
}
