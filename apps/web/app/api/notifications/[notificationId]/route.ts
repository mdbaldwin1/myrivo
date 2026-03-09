import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  action: z.enum(["read", "unread", "dismiss"])
});

const paramsSchema = z.object({
  notificationId: z.string().uuid()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ notificationId: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  }

  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const update: { read_at: string | null; status: "read" | "sent" | "dismissed" } =
    payload.data.action === "read"
      ? { read_at: now, status: "read" }
      : payload.data.action === "dismiss"
        ? { read_at: now, status: "dismissed" }
        : { read_at: null, status: "sent" };

  const { data: notification, error } = await supabase
    .from("notifications")
    .update(update)
    .eq("id", params.data.notificationId)
    .eq("recipient_user_id", user.id)
    .select("id,store_id,event_type,title,body,action_url,severity,status,read_at,sent_at,metadata,created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ notification });
}
