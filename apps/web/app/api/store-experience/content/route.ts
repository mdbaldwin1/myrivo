import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
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

const heroBrandDisplaySchema = z.enum(["title", "logo", "logo_and_title"]);
const productsFilterLayoutSchema = z.enum(["sidebar", "topbar"]);
const productsImageFitSchema = z.enum(["cover", "contain"]);
const reviewsSortSchema = z.enum(["newest", "highest", "lowest"]);

function validateSectionValue(section: StoreExperienceContentSection, value: Record<string, unknown>) {
  if (section === "home") {
    const parsed = z
      .object({
        hero: z
          .union([
            z
              .object({
                brandDisplay: heroBrandDisplaySchema.optional()
              })
              .partial(),
            z.null()
          ])
          .optional()
      })
      .safeParse(value);
    if (!parsed.success) {
      return "Home hero brand display must be title, logo, or logo_and_title.";
    }
  }

  if (section === "productsPage") {
    const parsed = z
      .object({
        layout: z
          .union([
            z
              .object({
                filterLayout: productsFilterLayoutSchema.optional()
              })
              .partial(),
            z.null()
          ])
          .optional(),
        productCards: z
          .union([
            z
              .object({
                imageFit: productsImageFitSchema.optional()
              })
              .partial(),
            z.null()
          ])
          .optional(),
        reviews: z
          .union([
            z
              .object({
                defaultSort: reviewsSortSchema.optional(),
                itemsPerPage: z.number().int().min(1).max(50).optional()
              })
              .partial(),
            z.null()
          ])
          .optional()
      })
      .safeParse(value);
    if (!parsed.success) {
      return "Products page filter layout must be sidebar/topbar, image fit must be cover/contain, and reviews sort must be newest/highest/lowest.";
    }
  }

  if (section === "emails") {
    const parsed = z
      .object({
        transactional: z
          .union([
            z
              .object({
                replyToEmail: z.string().trim().email().or(z.literal("")).optional()
              })
              .partial(),
            z.null()
          ])
          .optional()
      })
      .safeParse(value);
    if (!parsed.success) {
      return "Reply-to email must be a valid email address.";
    }
  }

  return null;
}

async function resolveOwnerContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: fail(401, "Unauthorized") } as const;
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return { error: fail(404, "No store found for account") } as const;
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
      return ok({
        content: mapStoreExperienceContentRow(null),
        source: "default",
        warning: "store_experience_content table is not available yet"
      });
    }
    return fail(500, error.message);
  }

  return ok({
    content: mapStoreExperienceContentRow(data),
    source: data ? "database" : "default"
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, updateSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnerContext();
  if ("error" in resolved) {
    return resolved.error;
  }

  const section = payload.data.section as StoreExperienceContentSection;
  const valueValidationError = validateSectionValue(section, payload.data.value);
  if (valueValidationError) {
    return fail(400, valueValidationError);
  }
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
      return fail(503, "Store content sections are unavailable until latest database migrations are applied.");
    }
    return fail(500, error.message);
  }

  return ok({
    content: mapStoreExperienceContentRow(data),
    updatedSection: section
  });
}
