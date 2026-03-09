import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
  status: z.enum(["all", "unread", "read", "dismissed", "pending", "sent", "failed"]).default("all")
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { limit, offset, status } = parsed.data;
  let query = supabase
    .from("notifications")
    .select("id,store_id,event_type,title,body,action_url,severity,status,read_at,sent_at,metadata,created_at")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false });

  if (status === "unread") {
    query = query.is("read_at", null).neq("status", "dismissed");
  } else if (status === "read") {
    query = query.not("read_at", "is", null);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: notifications, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count: unreadCount, error: unreadError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", user.id)
    .is("read_at", null)
    .neq("status", "dismissed");

  if (unreadError) {
    return NextResponse.json({ error: unreadError.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
    pagination: {
      limit,
      offset
    }
  });
}
