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

export type VercelDomainProvisionResult = {
  status: "ready" | "provisioning" | "failed" | "not_configured";
  metadata: Record<string, unknown>;
  error: string | null;
};

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

  const createUrl = withTeam(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains`, teamId);
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ name: domain })
  });

  let createPayload: unknown = null;
  if (createResponse.status !== 204) {
    createPayload = await createResponse.json().catch(() => null);
  }

  if (!createResponse.ok && createResponse.status !== 409) {
    return {
      status: "failed",
      metadata: {
        createStatus: createResponse.status,
        createPayload
      },
      error: normalizeVercelError(createPayload, "Unable to attach domain to Vercel project.")
    };
  }

  const statusUrl = withTeam(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`,
    teamId
  );
  const statusResponse = await fetch(statusUrl, { headers: requestHeaders });
  const statusPayload = await statusResponse.json().catch(() => null);

  if (!statusResponse.ok) {
    return {
      status: "failed",
      metadata: {
        createStatus: createResponse.status,
        createPayload,
        statusCode: statusResponse.status,
        statusPayload
      },
      error: normalizeVercelError(statusPayload, "Domain attached but status check failed.")
    };
  }

  const domainStatus = statusPayload as VercelDomainStatusResponse;
  const hasPendingVerification = isVerificationPending(domainStatus.verification);
  const ready = domainStatus.verified === true && !hasPendingVerification;

  return {
    status: ready ? "ready" : "provisioning",
    metadata: {
      createStatus: createResponse.status,
      createPayload,
      domainStatus
    },
    error: null
  };
}
