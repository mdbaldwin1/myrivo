import { describe, expect, it } from "vitest";
import { resolveAvailablePickupLocations } from "@/lib/pickup/availability";

const locations = [
  { id: "near", name: "Near", latitude: 36.8529, longitude: -76.001 },
  { id: "far", name: "Far", latitude: 40.7128, longitude: -74.006 },
  { id: "invalid", name: "Invalid", latitude: null, longitude: null }
];

describe("pickup availability", () => {
  it("returns in-radius locations with computed distances when buyer coordinates are present", () => {
    const results = resolveAvailablePickupLocations({
      buyer: { latitude: 36.8508, longitude: -76.2859 },
      locations,
      radiusMiles: 100,
      geolocationFallbackMode: "disable_pickup",
      outOfRadiusBehavior: "disable_pickup"
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("near");
    expect(results[0]?.distanceMiles).not.toBeNull();
  });

  it("returns all coordinate-valid locations when buyer is out of range and out-of-radius behavior allows fallback", () => {
    const results = resolveAvailablePickupLocations({
      buyer: { latitude: 34.0522, longitude: -118.2437 },
      locations,
      radiusMiles: 20,
      geolocationFallbackMode: "disable_pickup",
      outOfRadiusBehavior: "allow_all_locations"
    });

    expect(results.map((entry) => entry.id)).toEqual(["near", "far"]);
    expect(results.every((entry) => entry.distanceMiles === null)).toBe(true);
  });

  it("returns no locations when buyer is out of range and out-of-radius behavior is strict", () => {
    const results = resolveAvailablePickupLocations({
      buyer: { latitude: 34.0522, longitude: -118.2437 },
      locations,
      radiusMiles: 20,
      geolocationFallbackMode: "allow_without_distance",
      outOfRadiusBehavior: "disable_pickup"
    });

    expect(results).toHaveLength(0);
  });

  it("returns coordinate-valid locations when geolocation is unavailable and fallback allows pickup", () => {
    const results = resolveAvailablePickupLocations({
      buyer: null,
      locations,
      radiusMiles: 50,
      geolocationFallbackMode: "allow_without_distance",
      outOfRadiusBehavior: "disable_pickup"
    });

    expect(results.map((entry) => entry.id)).toEqual(["near", "far"]);
    expect(results.every((entry) => entry.distanceMiles === null)).toBe(true);
  });

  it("returns no locations when geolocation is unavailable and fallback is strict", () => {
    const results = resolveAvailablePickupLocations({
      buyer: null,
      locations,
      radiusMiles: 50,
      geolocationFallbackMode: "disable_pickup",
      outOfRadiusBehavior: "allow_all_locations"
    });

    expect(results).toHaveLength(0);
  });
});
