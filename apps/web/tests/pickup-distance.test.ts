import { describe, expect, it } from "vitest";
import { haversineMiles, resolveEligiblePickupLocations } from "@/lib/pickup/distance";

describe("pickup distance", () => {
  it("computes stable haversine distance", () => {
    const miles = haversineMiles(
      { latitude: 36.8508, longitude: -76.2859 },
      { latitude: 36.8529, longitude: -75.9780 }
    );
    expect(miles).toBeGreaterThan(10);
    expect(miles).toBeLessThan(20);
  });

  it("filters and sorts eligible locations", () => {
    const results = resolveEligiblePickupLocations(
      { latitude: 36.8508, longitude: -76.2859 },
      [
        { id: "a", name: "Near", latitude: 36.8529, longitude: -76.001 },
        { id: "b", name: "Far", latitude: 40.7128, longitude: -74.006 },
        { id: "c", name: "No Coord", latitude: null, longitude: null }
      ],
      100
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("a");
  });
});
