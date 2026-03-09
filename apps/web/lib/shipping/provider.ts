import type { ShippingConfig } from "@/lib/shipping/store-config";

export const carrierOptions = [
  "usps",
  "ups",
  "fedex",
  "dhl",
  "ontrac",
  "lasership",
  "other"
] as const;

export type ShippingCarrier = (typeof carrierOptions)[number];

export type ShippingTrackingUpdate = {
  provider: "easypost";
  trackerId: string | null;
  trackingNumber: string;
  carrier: string | null;
  shipmentStatus: string;
  trackingUrl: string | null;
  occurredAt: string;
  raw: unknown;
};

export type RegisteredTracker = {
  provider: "easypost";
  trackerId: string | null;
  trackingNumber: string;
  carrier: string | null;
  shipmentStatus: string;
  trackingUrl: string | null;
};

type FulfillmentStatus = "pending_fulfillment" | "packing" | "shipped" | "delivered";

function normalizeCarrier(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

function normalizeTrackingNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function buildTrackingUrl(carrier: string | null | undefined, trackingNumber: string): string | null {
  const normalizedCarrier = normalizeCarrier(carrier);
  const normalizedTrackingNumber = normalizeTrackingNumber(trackingNumber);

  if (!normalizedTrackingNumber) {
    return null;
  }

  const encoded = encodeURIComponent(normalizedTrackingNumber);

  if (normalizedCarrier === "usps") {
    return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${encoded}`;
  }

  if (normalizedCarrier === "ups") {
    return `https://www.ups.com/track?tracknum=${encoded}`;
  }

  if (normalizedCarrier === "fedex") {
    return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  }

  if (normalizedCarrier === "dhl") {
    return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encoded}`;
  }

  return `https://track.aftership.com/${encoded}`;
}

function getEasypostHeaders(apiKey: string) {
  return {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    "Content-Type": "application/json"
  };
}

type EasypostTracker = {
  id?: string;
  tracking_code?: string;
  carrier?: string;
  carrier_detail?: { service?: string; container_type?: string; destination_location?: string } | null;
  status?: string;
  public_url?: string;
};

function normalizeEasypostTracker(tracker: EasypostTracker, raw: unknown): ShippingTrackingUpdate {
  const trackingNumber = normalizeTrackingNumber(tracker.tracking_code ?? "");

  return {
    provider: "easypost",
    trackerId: tracker.id ?? null,
    trackingNumber,
    carrier: normalizeCarrier(tracker.carrier),
    shipmentStatus: (tracker.status ?? "unknown").toLowerCase(),
    trackingUrl: tracker.public_url ?? buildTrackingUrl(tracker.carrier ?? null, trackingNumber),
    occurredAt: new Date().toISOString(),
    raw
  };
}

export async function registerTracker(
  input: { carrier: string; trackingNumber: string },
  config: Pick<ShippingConfig, "provider" | "apiKey">
): Promise<RegisteredTracker> {
  const provider = config.provider ?? "none";
  const normalizedCarrier = normalizeCarrier(input.carrier);
  const normalizedTracking = normalizeTrackingNumber(input.trackingNumber);

  if (!normalizedTracking) {
    throw new Error("Tracking number is required.");
  }

  if (provider !== "easypost" || !config.apiKey) {
    return {
      provider: "easypost",
      trackerId: null,
      trackingNumber: normalizedTracking,
      carrier: normalizedCarrier,
      shipmentStatus: "unknown",
      trackingUrl: buildTrackingUrl(normalizedCarrier, normalizedTracking)
    };
  }

  const response = await fetch("https://api.easypost.com/v2/trackers", {
    method: "POST",
    headers: getEasypostHeaders(config.apiKey),
    body: JSON.stringify({
      tracker: {
        tracking_code: normalizedTracking,
        ...(normalizedCarrier ? { carrier: normalizedCarrier.toUpperCase() } : {})
      }
    })
  });

  const payload = (await response.json().catch(() => ({}))) as { tracker?: EasypostTracker; error?: { message?: string } };

  if (!response.ok || !payload.tracker) {
    throw new Error(payload.error?.message ?? "Unable to register shipment tracker.");
  }

  const normalized = normalizeEasypostTracker(payload.tracker, payload);
  return {
    provider: normalized.provider,
    trackerId: normalized.trackerId,
    trackingNumber: normalized.trackingNumber,
    carrier: normalized.carrier,
    shipmentStatus: normalized.shipmentStatus,
    trackingUrl: normalized.trackingUrl
  };
}

export async function refreshTracker(input: {
  trackerId: string | null;
  carrier: string | null;
  trackingNumber: string;
},
config: Pick<ShippingConfig, "provider" | "apiKey">): Promise<ShippingTrackingUpdate | null> {
  if ((config.provider ?? "none") !== "easypost" || !config.apiKey) {
    return null;
  }

  const targetId = input.trackerId?.trim();

  if (!targetId) {
    return null;
  }

  const response = await fetch(`https://api.easypost.com/v2/trackers/${targetId}`, {
    method: "GET",
    headers: getEasypostHeaders(config.apiKey)
  });

  const payload = (await response.json().catch(() => ({}))) as EasypostTracker & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Unable to sync shipment tracker.");
  }

  return normalizeEasypostTracker(payload, payload);
}

export function parseShippingWebhook(requestBody: unknown): ShippingTrackingUpdate[] {
  const body = requestBody as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (body && typeof body === "object") {
    const result = body.result;
    if (result && typeof result === "object") {
      candidates.push(result);
    }

    if (typeof body.tracking_code === "string") {
      candidates.push(body);
    }

    const updates = body.updates;
    if (Array.isArray(updates)) {
      candidates.push(...updates);
    }
  }

  const normalized: ShippingTrackingUpdate[] = [];

  for (const candidate of candidates) {
    const tracker = candidate as EasypostTracker;
    if (!tracker?.tracking_code) {
      continue;
    }

    normalized.push(normalizeEasypostTracker(tracker, requestBody));
  }

  return normalized;
}

export function mapShipmentStatusToFulfillmentStatus(status: string): "shipped" | "delivered" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "delivered") {
    return "delivered";
  }

  return "shipped";
}

const fulfillmentStatusRank: Record<FulfillmentStatus, number> = {
  pending_fulfillment: 0,
  packing: 1,
  shipped: 2,
  delivered: 3
};

export function resolveMonotonicFulfillmentStatus(current: FulfillmentStatus, candidate: "shipped" | "delivered"): FulfillmentStatus {
  return fulfillmentStatusRank[candidate] >= fulfillmentStatusRank[current] ? candidate : current;
}

export function resolveShippedAt(
  currentShippedAt: string | null,
  fulfillmentStatus: FulfillmentStatus,
  occurredAtIso: string
) {
  if (fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered") {
    return currentShippedAt ?? occurredAtIso;
  }

  return null;
}
