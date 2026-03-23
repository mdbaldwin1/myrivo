import { describe, expect, it } from "vitest";
import { summarizePendingQueueLatency } from "@/lib/reviews/health";

describe("summarizePendingQueueLatency", () => {
  it("returns rounded avg and oldest queue ages", () => {
    const now = new Date("2026-03-09T16:00:00.000Z").getTime();
    const summary = summarizePendingQueueLatency(["2026-03-09T14:00:00.000Z", "2026-03-09T15:30:00.000Z"], now);

    expect(summary.pendingAvgAgeHours).toBe(1.25);
    expect(summary.pendingOldestAgeHours).toBe(2);
  });

  it("returns zeros when queue is empty", () => {
    expect(summarizePendingQueueLatency([], Date.now())).toEqual({ pendingAvgAgeHours: 0, pendingOldestAgeHours: 0 });
  });
});
