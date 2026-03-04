import {
  type CoordinatePoint,
  type PickupLocationDistanceInput,
  type PickupLocationDistanceResult,
  resolveEligiblePickupLocations
} from "@/lib/pickup/distance";

export type PickupAvailabilityGeolocationFallbackMode = "allow_without_distance" | "disable_pickup";
export type PickupAvailabilityOutOfRadiusBehavior = "disable_pickup" | "allow_all_locations";

export type PickupAvailabilityResult = PickupLocationDistanceResult | (PickupLocationDistanceInput & { distanceMiles: null });

type ResolvePickupAvailabilityInput = {
  buyer: CoordinatePoint | null;
  locations: PickupLocationDistanceInput[];
  radiusMiles: number;
  geolocationFallbackMode: PickupAvailabilityGeolocationFallbackMode;
  outOfRadiusBehavior: PickupAvailabilityOutOfRadiusBehavior;
};

export function resolveAvailablePickupLocations({
  buyer,
  locations,
  radiusMiles,
  geolocationFallbackMode,
  outOfRadiusBehavior
}: ResolvePickupAvailabilityInput): PickupAvailabilityResult[] {
  const eligibleWithDistance = buyer ? resolveEligiblePickupLocations(buyer, locations, radiusMiles) : [];
  const allLocations = locations
    .filter((location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude))
    .map((location) => ({ ...location, distanceMiles: null as null }));

  if (buyer) {
    if (eligibleWithDistance.length > 0) {
      return eligibleWithDistance;
    }
    return outOfRadiusBehavior === "allow_all_locations" ? allLocations : [];
  }

  return geolocationFallbackMode === "allow_without_distance" ? allLocations : [];
}
