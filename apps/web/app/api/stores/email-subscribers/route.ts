import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";

type SubscriberRow = {
  id: string;
  email: string;
  status: "subscribed" | "unsubscribed";
  source: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id);
  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const statusFilter = searchParams.get("status");
  const allowedStatus = statusFilter === "subscribed" || statusFilter === "unsubscribed" ? statusFilter : null;

  let query = supabase
    .from("store_email_subscribers")
    .select("id,email,status,source,subscribed_at,unsubscribed_at,created_at")
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  if (allowedStatus) {
    query = query.eq("status", allowedStatus);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const subscribers = (data ?? []) as SubscriberRow[];

  if (format === "csv") {
    const header = "email,status,source,subscribed_at,unsubscribed_at,created_at";
    const rows = subscribers.map((row) =>
      [
        row.email,
        row.status,
        row.source,
        row.subscribed_at,
        row.unsubscribed_at ?? "",
        row.created_at
      ]
        .map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"email-subscribers-${bundle.store.slug}.csv\"`
      }
    });
  }

  return NextResponse.json({
    subscribers,
    summary: {
      total: subscribers.length,
      subscribed: subscribers.filter((entry) => entry.status === "subscribed").length,
      unsubscribed: subscribers.filter((entry) => entry.status === "unsubscribed").length
    }
  });
}
