import { describe, expect, it } from "vitest";
import { buildPickupSlots } from "@/lib/pickup/scheduling";

describe("pickup scheduling", () => {
  it("enforces lead time and blackout windows", () => {
    const now = new Date("2026-03-03T10:00:00.000Z");

    const slots = buildPickupSlots({
      now,
      leadTimeHours: 24,
      slotIntervalMinutes: 60,
      timezone: "America/New_York",
      dayHours: {
        2: [{ opensAt: "09:00", closesAt: "17:00" }],
        3: [{ opensAt: "09:00", closesAt: "17:00" }]
      },
      blackoutWindows: [
        {
          startsAt: new Date("2026-03-04T12:00:00.000Z"),
          endsAt: new Date("2026-03-04T14:00:00.000Z")
        }
      ]
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => new Date(slot.startsAt) >= new Date("2026-03-04T10:00:00.000Z"))).toBe(true);
    expect(
      slots.some((slot) => {
        const start = new Date(slot.startsAt).toISOString();
        return start >= "2026-03-04T12:00:00.000Z" && start < "2026-03-04T14:00:00.000Z";
      })
    ).toBe(false);
  });
});
