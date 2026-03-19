"use client";

import type { StoreLegalDocumentVersionRow } from "@/lib/legal/store-documents";

type StoreLegalDocumentVersionsTableProps = {
  versions: StoreLegalDocumentVersionRow[];
};

export function StoreLegalDocumentVersionsTable({ versions }: StoreLegalDocumentVersionsTableProps) {
  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">No published versions yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Version</th>
            <th className="px-4 py-3 font-medium">Base</th>
            <th className="px-4 py-3 font-medium">Published</th>
            <th className="px-4 py-3 font-medium">Effective</th>
            <th className="px-4 py-3 font-medium">Summary</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.id} className="border-t border-border/60 align-top">
              <td className="px-4 py-3 font-medium">v{version.version_number}</td>
              <td className="px-4 py-3 text-muted-foreground">{version.base_version_label ?? "Unknown"}</td>
              <td className="px-4 py-3 text-muted-foreground">{new Date(version.published_at).toLocaleString("en-US")}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {version.effective_at ? new Date(version.effective_at).toLocaleString("en-US") : "Immediate"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{version.change_summary?.trim() || "No summary recorded."}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
