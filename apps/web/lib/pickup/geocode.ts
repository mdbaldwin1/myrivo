type PickupGeocodeInput = {
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode?: string | null;
};

type PickupAddressSuggestionInput = {
  query: string;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

type PickupCoordinates = {
  latitude: number;
  longitude: number;
};

export type PickupAddressSuggestion = {
  label: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
};

function buildQuery(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(", ");
}

async function searchNominatim(
  params: URLSearchParams
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      "User-Agent": "Myrivo Pickup Geocoder/1.0",
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as Array<Record<string, unknown>>;
}

export async function resolvePickupCoordinatesFromAddress(input: PickupGeocodeInput): Promise<PickupCoordinates | null> {
  const query = buildQuery([input.addressLine1, input.city, input.stateRegion, input.postalCode, input.countryCode || "US"]);

  if (!query) {
    return null;
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    q: query
  });

  if (input.countryCode?.trim()) {
    params.set("countrycodes", input.countryCode.trim().toLowerCase());
  }

  try {
    const payload = await searchNominatim(params);
    const first = payload[0] as { lat?: string; lon?: string } | undefined;
    const latitude = first?.lat ? Number.parseFloat(first.lat) : Number.NaN;
    const longitude = first?.lon ? Number.parseFloat(first.lon) : Number.NaN;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  } catch {
    return null;
  }
}

export async function searchPickupAddressSuggestions(
  input: PickupAddressSuggestionInput
): Promise<PickupAddressSuggestion[]> {
  const query = buildQuery([
    input.query,
    input.city ?? "",
    input.stateRegion ?? "",
    input.postalCode ?? "",
    input.countryCode || "US"
  ]);

  if (input.query.trim().length < 4 || !query) {
    return [];
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    q: query
  });

  if (input.countryCode?.trim()) {
    params.set("countrycodes", input.countryCode.trim().toLowerCase());
  }

  try {
    const payload = await searchNominatim(params);

    return payload
      .map((entry) => {
        const result = entry as {
          display_name?: string;
          lat?: string;
          lon?: string;
          address?: Record<string, string | undefined>;
        };
        const latitude = result.lat ? Number.parseFloat(result.lat) : Number.NaN;
        const longitude = result.lon ? Number.parseFloat(result.lon) : Number.NaN;
        const address = result.address ?? {};
        const addressLine1 =
          [address.house_number, address.road]
            .filter((part): part is string => Boolean(part?.trim()))
            .join(" ")
            .trim() ||
          address.road?.trim() ||
          address.pedestrian?.trim() ||
          address.neighbourhood?.trim() ||
          "";
        const city =
          address.city?.trim() ||
          address.town?.trim() ||
          address.village?.trim() ||
          address.hamlet?.trim() ||
          "";
        const stateRegion = address.state?.trim() || address.region?.trim() || "";
        const postalCode = address.postcode?.trim() || "";
        const countryCode = address.country_code?.trim().toUpperCase() || (input.countryCode?.trim().toUpperCase() || "US");

        if (!addressLine1 || !city || !stateRegion || !postalCode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          label: result.display_name?.trim() || buildQuery([addressLine1, city, stateRegion, postalCode, countryCode]),
          addressLine1,
          city,
          stateRegion,
          postalCode,
          countryCode,
          latitude,
          longitude
        } satisfies PickupAddressSuggestion;
      })
      .filter((entry): entry is PickupAddressSuggestion => Boolean(entry));
  } catch {
    return [];
  }
}
