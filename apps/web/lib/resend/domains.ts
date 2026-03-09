import { getServerEnv } from "@/lib/env";

type ResendApiRecord = {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  status?: string;
  ttl?: string;
  priority?: number;
};

type ResendDomain = {
  id?: string;
  name?: string;
  status?: string;
  records?: ResendApiRecord[];
  region?: string;
  created_at?: string;
};

type ResendApiErrorPayload = {
  message?: string;
  name?: string;
};

type ResendApiResponse = {
  ok: boolean;
  status: number;
  payload: Record<string, unknown> | null;
  notConfigured: boolean;
};

type ResendListDomainsResult = ResendApiResponse & {
  domains: ResendDomain[];
};

type ResendGetDomainResult = ResendApiResponse & {
  domain: ResendDomain | null;
};

type ResendCreateDomainResult = ResendApiResponse & {
  domain: ResendDomain | null;
};

export type ResendDomainProvisionResult = {
  status: "ready" | "provisioning" | "failed" | "not_configured";
  metadata: Record<string, unknown>;
  error: string | null;
  domainId: string | null;
};

export type ResendDomainRemovalResult = {
  ok: boolean;
  status: "removed" | "already_removed" | "not_configured" | "failed";
  error: string | null;
};

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

async function parseJsonResponse(response: Response) {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }
  const message = (payload as ResendApiErrorPayload).message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getDomainStatusLabel(domain: ResendDomain | null | undefined) {
  const raw = domain?.status;
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function isDomainReady(domain: ResendDomain | null | undefined) {
  const label = getDomainStatusLabel(domain);
  return label === "verified" || label === "ready";
}

async function resendRequest(path: string, init: RequestInit): Promise<ResendApiResponse> {
  const env = getServerEnv();
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false as const, status: 0, payload: null, notConfigured: true as const };
  }

  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const payload = await parseJsonResponse(response);

  return { ok: response.ok, status: response.status, payload, notConfigured: false as const };
}

async function listDomains(): Promise<ResendListDomainsResult> {
  const response = await resendRequest("/domains", { method: "GET" });
  if (!response.ok) {
    return {
      ...response,
      domains: []
    };
  }

  const payload = toRecord(response.payload);
  const domainsValue = payload.data;
  const domains = Array.isArray(domainsValue) ? (domainsValue as ResendDomain[]) : [];
  return {
    ...response,
    domains
  };
}

async function getDomainById(domainId: string): Promise<ResendGetDomainResult> {
  const response = await resendRequest(`/domains/${encodeURIComponent(domainId)}`, { method: "GET" });
  if (!response.ok) {
    return {
      ...response,
      domain: null
    };
  }
  const payload = toRecord(response.payload);
  const domain = toRecord(payload.data) as ResendDomain;
  return { ...response, domain };
}

async function verifyDomainById(domainId: string) {
  return resendRequest(`/domains/${encodeURIComponent(domainId)}/verify`, { method: "POST" });
}

async function createDomain(domain: string): Promise<ResendCreateDomainResult> {
  const response = await resendRequest("/domains", {
    method: "POST",
    body: JSON.stringify({ name: domain })
  });
  if (!response.ok) {
    return {
      ...response,
      domain: null
    };
  }
  const payload = toRecord(response.payload);
  const data = toRecord(payload.data) as ResendDomain;
  return { ...response, domain: data };
}

export async function provisionResendDomain(domainInput: string): Promise<ResendDomainProvisionResult> {
  const domain = normalizeDomain(domainInput);
  const listed = await listDomains();
  if (listed.notConfigured) {
    return {
      status: "not_configured",
      metadata: {},
      error: "Resend domain provisioning is not configured on the server.",
      domainId: null
    };
  }

  if (!listed.ok) {
    return {
      status: "failed",
      metadata: { listPayload: listed.payload ?? null, listStatus: listed.status },
      error: readErrorMessage(listed.payload, "Unable to list Resend domains."),
      domainId: null
    };
  }

  const matching = listed.domains.find((entry) => normalizeDomain(entry.name ?? "") === domain);
  let domainId = typeof matching?.id === "string" ? matching.id : null;
  const metadata: Record<string, unknown> = {
    listStatus: listed.status,
    listPayload: listed.payload ?? null
  };

  if (!domainId) {
    const created = await createDomain(domain);
    metadata.createStatus = created.status;
    metadata.createPayload = created.payload ?? null;
    if (!created.ok) {
      return {
        status: "failed",
        metadata,
        error: readErrorMessage(created.payload, `Unable to create Resend domain for ${domain}.`),
        domainId: null
      };
    }
    domainId = typeof created.domain?.id === "string" ? created.domain.id : null;
  }

  if (!domainId) {
    return {
      status: "failed",
      metadata,
      error: "Resend did not return a domain id.",
      domainId: null
    };
  }

  const verifyResult = await verifyDomainById(domainId);
  metadata.verifyStatus = verifyResult.status;
  metadata.verifyPayload = verifyResult.payload ?? null;

  const fetched = await getDomainById(domainId);
  metadata.getStatus = fetched.status;
  metadata.getPayload = fetched.payload ?? null;
  if (!fetched.ok) {
    return {
      status: "failed",
      metadata,
      error: readErrorMessage(fetched.payload, "Unable to fetch Resend domain status."),
      domainId
    };
  }

  const ready = isDomainReady(fetched.domain);
  metadata.domain = fetched.domain as Record<string, unknown>;
  return {
    status: ready ? "ready" : "provisioning",
    metadata,
    error: null,
    domainId
  };
}

export async function removeResendDomain(domainId: string | null): Promise<ResendDomainRemovalResult> {
  if (!domainId) {
    return { ok: true, status: "already_removed", error: null };
  }

  const response = await resendRequest(`/domains/${encodeURIComponent(domainId)}`, { method: "DELETE" });
  if (response.notConfigured) {
    return { ok: true, status: "not_configured", error: null };
  }
  if (response.status === 404) {
    return { ok: true, status: "already_removed", error: null };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: "failed",
      error: readErrorMessage(response.payload, "Unable to remove domain from Resend.")
    };
  }

  return { ok: true, status: "removed", error: null };
}
