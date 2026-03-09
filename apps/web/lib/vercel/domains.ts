import { getServerEnv } from "@/lib/env";

type VercelDomainVerificationRecord = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
  verified?: boolean;
};

type VercelDomainStatusResponse = {
  name?: string;
  apexName?: string;
  projectId?: string;
  verified?: boolean;
  verification?: VercelDomainVerificationRecord[];
  configuredBy?: string;
};

type VercelDomainConfigResponse = {
  misconfigured?: boolean;
  recommendedIPv4?: Array<{ rank?: number; value?: string[] }>;
  recommendedCNAME?: Array<{ rank?: number; value?: string }>;
  aValues?: string[];
  cnames?: string[];
  configuredBy?: string | null;
};

export type VercelDomainProvisionResult = {
  status: "ready" | "provisioning" | "failed" | "not_configured";
  metadata: Record<string, unknown>;
  error: string | null;
};

export type VercelDomainRemovalResult = {
  ok: boolean;
  status: "removed" | "already_removed" | "not_configured" | "failed";
  error: string | null;
};

function isLikelyApexDomain(domain: string) {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("www.")) {
    return false;
  }
  const labels = normalized.split(".").filter(Boolean);
  return labels.length === 2;
}

function getManagedCompanionDomains(domain: string) {
  if (!isLikelyApexDomain(domain)) {
    return [];
  }
  return [`www.${domain.trim().toLowerCase().replace(/\.$/, "")}`];
}

function normalizeVercelError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  const message = (payload as { error?: { message?: string } }).error?.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return fallback;
}

function withTeam(url: string, teamId: string | undefined) {
  if (!teamId?.trim()) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}teamId=${encodeURIComponent(teamId.trim())}`;
}

function isVerificationPending(records: VercelDomainVerificationRecord[] | undefined) {
  if (!records || records.length === 0) {
    return false;
  }
  return records.some((record) => record.verified !== true);
}

export async function provisionVercelProjectDomain(domain: string): Promise<VercelDomainProvisionResult> {
  const env = getServerEnv();
  const token = env.VERCEL_API_TOKEN?.trim();
  const projectId = env.VERCEL_PROJECT_ID?.trim();
  const teamId = env.VERCEL_TEAM_ID?.trim();

  if (!token || !projectId) {
    return {
      status: "not_configured",
      metadata: {},
      error: "Vercel provisioning is not configured on the server."
    };
  }

  const requestHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  const managedDomains = [domain, ...getManagedCompanionDomains(domain)];
  const createAttempts: Array<{ domain: string; status: number; payload: unknown }> = [];

  for (const managedDomain of managedDomains) {
    const createUrl = withTeam(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains`, teamId);
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ name: managedDomain })
    });

    let createPayload: unknown = null;
    if (createResponse.status !== 204) {
      createPayload = await createResponse.json().catch(() => null);
    }

    createAttempts.push({
      domain: managedDomain,
      status: createResponse.status,
      payload: createPayload
    });

    if (!createResponse.ok && createResponse.status !== 409) {
      return {
        status: "failed",
        metadata: {
          createAttempts
        },
        error: normalizeVercelError(createPayload, `Unable to attach ${managedDomain} to Vercel project.`)
      };
    }
  }

  const statusEntries: Array<{ domain: string; status: number; payload: unknown }> = [];
  const domainStatuses: Record<string, VercelDomainStatusResponse> = {};
  for (const managedDomain of managedDomains) {
    const statusUrl = withTeam(
      `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(managedDomain)}`,
      teamId
    );
    const statusResponse = await fetch(statusUrl, { headers: requestHeaders });
    const statusPayload = await statusResponse.json().catch(() => null);
    statusEntries.push({
      domain: managedDomain,
      status: statusResponse.status,
      payload: statusPayload
    });
    if (!statusResponse.ok) {
      return {
        status: "failed",
        metadata: {
          createAttempts,
          statusEntries
        },
        error: normalizeVercelError(statusPayload, `Domain attached but status check failed for ${managedDomain}.`)
      };
    }
    domainStatuses[managedDomain] = statusPayload as VercelDomainStatusResponse;
  }

  const domainStatus = domainStatuses[domain] ?? {};
  const configUrl = withTeam(`https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config`, teamId);
  const configResponse = await fetch(configUrl, { headers: requestHeaders });
  const configPayload = await configResponse.json().catch(() => null);
  const domainConfig = configResponse.ok ? (configPayload as VercelDomainConfigResponse) : null;
  const hasPendingVerification = Object.values(domainStatuses).some((status) => isVerificationPending(status.verification));
  const allVerified = Object.values(domainStatuses).every((status) => status.verified === true);
  const ready = allVerified && !hasPendingVerification && domainConfig?.misconfigured !== true;

  return {
    status: ready ? "ready" : "provisioning",
    metadata: {
      createAttempts,
      statusEntries,
      domainStatus,
      domainStatuses,
      domainConfig,
      configStatus: configResponse.status
    },
    error: null
  };
}

export async function removeVercelProjectDomain(domain: string): Promise<VercelDomainRemovalResult> {
  const env = getServerEnv();
  const token = env.VERCEL_API_TOKEN?.trim();
  const projectId = env.VERCEL_PROJECT_ID?.trim();
  const teamId = env.VERCEL_TEAM_ID?.trim();

  if (!token || !projectId) {
    return {
      ok: true,
      status: "not_configured",
      error: null
    };
  }

  const requestHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const managedDomains = [domain, ...getManagedCompanionDomains(domain)];
  for (const managedDomain of managedDomains) {
    const deleteUrl = withTeam(
      `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(managedDomain)}`,
      teamId
    );
    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: requestHeaders
    });

    if (deleteResponse.status === 404) {
      continue;
    }

    if (!deleteResponse.ok) {
      const deletePayload = await deleteResponse.json().catch(() => null);
      return {
        ok: false,
        status: "failed",
        error: normalizeVercelError(deletePayload, `Unable to remove ${managedDomain} from Vercel project.`)
      };
    }
  }

  return {
    ok: true,
    status: "removed",
    error: null
  };
}
