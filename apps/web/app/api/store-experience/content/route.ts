import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import {
  mapStoreExperienceContentRow,
  STORE_EXPERIENCE_CONTENT_SECTION_TO_COLUMN,
  type StoreExperienceContentSection
} from "@/lib/store-experience/content";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";

const sectionSchema = z.enum(["home", "productsPage", "aboutPage", "policiesPage", "cartPage", "orderSummaryPage", "emails"]);

const updateSchema = z.object({
  section: sectionSchema,
  value: z.record(z.string(), z.unknown())
});

async function resolveOwnerContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return { error: NextResponse.json({ error: "No store found for account" }, { status: 404 }) } as const;
  }

  return { supabase, storeId: bundle.store.id } as const;
}

export async function GET() {
  const resolved = await resolveOwnerContext();
  if ("error" in resolved) {
    return resolved.error;
  }

  const { data, error } = await resolved.supabase
    .from("store_experience_content")
    .select("store_id,home_json,products_page_json,about_page_json,policies_page_json,cart_page_json,order_summary_page_json,emails_json")
    .eq("store_id", resolved.storeId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationInSchemaCache(error)) {
      return NextResponse.json({
        content: mapStoreExperienceContentRow(null),
        source: "default",
        warning: "store_experience_content table is not available yet"
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    content: mapStoreExperienceContentRow(data),
    source: data ? "database" : "default"
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = updateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const resolved = await resolveOwnerContext();
  if ("error" in resolved) {
    return resolved.error;
  }

  const section = payload.data.section as StoreExperienceContentSection;
  const column = STORE_EXPERIENCE_CONTENT_SECTION_TO_COLUMN[section];

  const { data, error } = await resolved.supabase
    .from("store_experience_content")
    .upsert(
      {
        store_id: resolved.storeId,
        [column]: payload.data.value
      },
      { onConflict: "store_id" }
    )
    .select("store_id,home_json,products_page_json,about_page_json,policies_page_json,cart_page_json,order_summary_page_json,emails_json")
    .single();

  if (error) {
    if (isMissingRelationInSchemaCache(error)) {
      return NextResponse.json(
        { error: "Store content sections are unavailable until latest database migrations are applied." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    content: mapStoreExperienceContentRow(data),
    updatedSection: section
  });
}
