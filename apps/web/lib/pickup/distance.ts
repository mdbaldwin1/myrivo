export type CoordinatePoint = {
  latitude: number;
  longitude: number;
};

export type PickupLocationDistanceInput = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export type PickupLocationDistanceResult = {
  id: string;
  name: string;
  distanceMiles: number;
};

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineMiles(from: CoordinatePoint, to: CoordinatePoint) {
  const dLatitude = toRadians(to.latitude - from.latitude);
  const dLongitude = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

export function resolveEligiblePickupLocations(
  buyer: CoordinatePoint | null,
  locations: PickupLocationDistanceInput[],
  radiusMiles: number
): PickupLocationDistanceResult[] {
  if (!buyer || !Number.isFinite(radiusMiles) || radiusMiles <= 0) {
    return [];
  }

  return locations
    .flatMap((location): PickupLocationDistanceResult[] => {
      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        return [];
      }

      const distanceMiles = haversineMiles(buyer, {
        latitude: location.latitude as number,
        longitude: location.longitude as number
      });

      if (distanceMiles > radiusMiles) {
        return [];
      }

      return [
        {
          id: location.id,
          name: location.name,
          distanceMiles: Number(distanceMiles.toFixed(2))
        }
      ];
    })
    .sort((left, right) => left.distanceMiles - right.distanceMiles);
}
