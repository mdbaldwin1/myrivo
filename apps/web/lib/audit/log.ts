import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditEventInput = {
  storeId?: string | null;
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(input: AuditEventInput) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("audit_events").insert({
      store_id: input.storeId ?? null,
      actor_user_id: input.actorUserId ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {}
    });
  } catch {
    // Audit logging should never break the primary user flow.
  }
}
