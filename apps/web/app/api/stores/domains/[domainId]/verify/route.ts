import { Resolver, resolve4, resolve6, resolveNs, resolveTxt } from "node:dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireStorePermission } from "@/lib/auth/authorization";
import { BRANDED_SENDER_ENABLED } from "@/lib/notifications/branded-sender";
import { provisionResendDomain } from "@/lib/resend/domains";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionVercelProjectDomain } from "@/lib/vercel/domains";

async function resolveVerificationTxtValues(recordName: string, apexDomain: string) {
  const parseRecords = (records: string[][]) => records.map((entry) => entry.join("")).map((entry) => entry.trim());

  try {
    const records = await resolveTxt(recordName);
    const values = parseRecords(records);
    if (values.length > 0) {
      return values;
    }
  } catch {
    // Fallback to authoritative DNS when recursive resolver is stale.
  }

  try {
    const nsHosts = await resolveNs(apexDomain);
    const resolverServers: string[] = [];

    for (const host of nsHosts) {
      const normalizedHost = host.replace(/\.$/, "");
      const [v4Result, v6Result] = await Promise.allSettled([resolve4(normalizedHost), resolve6(normalizedHost)]);
      if (v4Result.status === "fulfilled") {
        resolverServers.push(...v4Result.value);
      }
      if (v6Result.status === "fulfilled") {
        resolverServers.push(...v6Result.value);
      }
    }

    if (resolverServers.length === 0) {
      return [];
    }

    const resolver = new Resolver();
    resolver.setServers(resolverServers);
    const records = await resolver.resolveTxt(recordName);
    return parseRecords(records);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStorePermission("store.manage_domains", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domainId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: domain, error: domainError } = await supabase
    .from("store_domains")
    .select("id,domain,verification_token,email_sender_enabled")
    .eq("id", domainId)
    .eq("store_id", auth.context.storeId)
    .maybeSingle<{ id: string; domain: string; verification_token: string | null; email_sender_enabled: boolean }>();

  if (domainError) {
    return NextResponse.json({ error: domainError.message }, { status: 500 });
  }

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  if (!domain.verification_token) {
    return NextResponse.json({ error: "Domain verification token is missing" }, { status: 400 });
  }

  const txtRecordName = `_myrivo-verification.${domain.domain}`;
  const txtValues = await resolveVerificationTxtValues(txtRecordName, domain.domain);
  const isVerified = txtValues.includes(domain.verification_token);

  let shouldSetPrimary = false;
  if (isVerified) {
    const { data: existingPrimary, error: existingPrimaryError } = await supabase
      .from("store_domains")
      .select("id")
      .eq("store_id", auth.context.storeId)
      .eq("is_primary", true)
      .maybeSingle<{ id: string }>();

    if (existingPrimaryError) {
      return NextResponse.json({ error: existingPrimaryError.message }, { status: 500 });
    }

    shouldSetPrimary = !existingPrimary;
  }

  const updates: {
    verification_status: "pending" | "verified" | "failed";
    last_verification_at: string;
    verified_at: string | null;
    hosting_status?: "pending" | "provisioning" | "ready" | "failed" | "not_configured";
    hosting_last_checked_at?: string;
    hosting_ready_at?: string | null;
    hosting_error?: string | null;
    hosting_metadata_json?: Record<string, unknown>;
    email_status?: "pending" | "provisioning" | "ready" | "failed" | "not_configured";
    email_sender_enabled?: boolean;
    email_domain_id?: string | null;
    email_last_checked_at?: string;
    email_ready_at?: string | null;
    email_error?: string | null;
    email_metadata_json?: Record<string, unknown>;
    is_primary?: boolean;
  } = {
    verification_status: isVerified ? "verified" : "failed",
    last_verification_at: new Date().toISOString(),
    verified_at: isVerified ? new Date().toISOString() : null
  };

  if (isVerified && shouldSetPrimary) {
    updates.is_primary = true;
  }

  const brandedEmailPolicy = (process.env.MYRIVO_BRANDED_EMAIL_POLICY?.trim() as "disabled" | "allowlist" | "all" | undefined) ?? "disabled";
  const brandedEmailStoreAllowlist = new Set(
    (process.env.MYRIVO_BRANDED_EMAIL_STORE_IDS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
  const isStoreEligibleForBrandedEmail =
    brandedEmailPolicy === "all" || (brandedEmailPolicy === "allowlist" && brandedEmailStoreAllowlist.has(auth.context.storeId));
  const shouldAttemptEmailProvisioning =
    BRANDED_SENDER_ENABLED && isVerified && domain.email_sender_enabled && isStoreEligibleForBrandedEmail;

  const provisionResult = await provisionVercelProjectDomain(domain.domain);
  updates.hosting_last_checked_at = new Date().toISOString();
  updates.hosting_metadata_json = provisionResult.metadata;
  updates.email_last_checked_at = new Date().toISOString();

  if (isVerified) {
    updates.hosting_status = provisionResult.status;
    updates.hosting_ready_at = provisionResult.status === "ready" ? new Date().toISOString() : null;
    updates.hosting_error = provisionResult.error;
    if (shouldAttemptEmailProvisioning) {
      const emailProvisionResult = await provisionResendDomain(domain.domain);
      updates.email_metadata_json = emailProvisionResult.metadata;
      updates.email_domain_id = emailProvisionResult.domainId;
      updates.email_status = emailProvisionResult.status;
      updates.email_ready_at = emailProvisionResult.status === "ready" ? new Date().toISOString() : null;
      updates.email_error = emailProvisionResult.error;
    } else if (!domain.email_sender_enabled) {
      updates.email_status = "not_configured";
      updates.email_ready_at = null;
      updates.email_error = null;
      updates.email_metadata_json = { reason: "Email branded sender not enabled for this domain." };
      updates.email_domain_id = null;
    } else if (!BRANDED_SENDER_ENABLED) {
      updates.email_status = "not_configured";
      updates.email_ready_at = null;
      updates.email_error = null;
      updates.email_metadata_json = { reason: "Branded sender domains are currently disabled platform-wide." };
      updates.email_domain_id = null;
    } else {
      updates.email_status = "not_configured";
      updates.email_ready_at = null;
      updates.email_error = "Branded sender is not enabled for this store plan/policy.";
      updates.email_metadata_json = {
        reason: "Store not eligible for branded sender domain provisioning.",
        policy: brandedEmailPolicy
      };
      updates.email_domain_id = null;
    }
  } else {
    updates.hosting_status = provisionResult.status === "failed" || provisionResult.status === "not_configured" ? provisionResult.status : "pending";
    updates.hosting_ready_at = null;
    updates.hosting_error = "Domain DNS verification did not pass.";
    updates.email_status = domain.email_sender_enabled ? "pending" : "not_configured";
    updates.email_ready_at = null;
    updates.email_error = "Domain DNS verification did not pass.";
    updates.email_metadata_json = { reason: "Domain ownership verification failed." };
    updates.email_domain_id = null;
  }

  const { data, error } = await supabase
    .from("store_domains")
    .update(updates)
    .eq("id", domain.id)
    .eq("store_id", auth.context.storeId)
    .select(
      "id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,hosting_provider,hosting_status,hosting_last_checked_at,hosting_ready_at,hosting_error,hosting_metadata_json,email_provider,email_sender_enabled,email_status,email_domain_id,email_last_checked_at,email_ready_at,email_error,email_metadata_json,created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domain: data, txtRecordName, verified: isVerified });
}
