import { describe, expect, it } from "vitest";
import { mapShipmentStatusToFulfillmentStatus, resolveMonotonicFulfillmentStatus } from "@/lib/shipping/provider";

describe("shipping provider fulfillment mapping", () => {
  it("does not advance fulfillment for pre-transit carrier states", () => {
    expect(mapShipmentStatusToFulfillmentStatus("pre_transit")).toBeNull();
    expect(mapShipmentStatusToFulfillmentStatus("unknown")).toBeNull();
    expect(resolveMonotonicFulfillmentStatus("packing", mapShipmentStatusToFulfillmentStatus("pre_transit"))).toBe("packing");
  });

  it("advances to shipped for in-transit carrier states", () => {
    expect(mapShipmentStatusToFulfillmentStatus("in_transit")).toBe("shipped");
    expect(mapShipmentStatusToFulfillmentStatus("out_for_delivery")).toBe("shipped");
    expect(resolveMonotonicFulfillmentStatus("packing", mapShipmentStatusToFulfillmentStatus("in_transit"))).toBe("shipped");
  });

  it("advances to delivered only for delivered carrier state", () => {
    expect(mapShipmentStatusToFulfillmentStatus("delivered")).toBe("delivered");
    expect(resolveMonotonicFulfillmentStatus("shipped", mapShipmentStatusToFulfillmentStatus("delivered"))).toBe("delivered");
  });
});
