import Link from "next/link";
import { hashDigitalAccessToken } from "@/lib/digital-products/entitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DigitalDownloadsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();
  const { data: access } = await admin.from("digital_order_access_tokens").select("order_id,expires_at,revoked_at").eq("token_hash", hashDigitalAccessToken(token)).maybeSingle();
  // Access validity is intentionally evaluated at request time on this dynamic server page.
  // eslint-disable-next-line react-hooks/purity
  const expired = !access || Boolean(access.revoked_at) || new Date(access.expires_at).getTime() <= Date.now();
  const { data: files } = access && !expired ? await admin.from("digital_order_entitlements").select("id,customer_filename,byte_size,download_grants_used,max_download_grants,status").eq("order_id", access.order_id).order("created_at") : { data: [] };
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><h1 className="text-3xl font-semibold">Your downloads</h1>{expired ? <div className="mt-6 rounded-lg border p-5"><p>This secure link has expired or is no longer available.</p><p className="mt-2 text-sm text-muted-foreground">Use the email address from your order to request a fresh link.</p></div> : <><p className="mt-2 text-muted-foreground">This link expires {new Date(access!.expires_at).toLocaleString()}. Personal-use license applies.</p><ul className="mt-8 space-y-3">{(files ?? []).map((file) => <li key={file.id} className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium">{file.customer_filename}</p><p className="text-sm text-muted-foreground">{(file.byte_size / 1024 / 1024).toFixed(1)} MB · {file.max_download_grants - file.download_grants_used} downloads remaining</p></div>{file.status === "active" && file.download_grants_used < file.max_download_grants ? <Link className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={`/api/digital-downloads/${encodeURIComponent(token)}/${file.id}`}>Download</Link> : <span className="text-sm text-muted-foreground">Unavailable</span>}</li>)}</ul></>}</main>;
}
