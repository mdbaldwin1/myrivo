import { describe, expect, it } from "vitest";
import { filterDashboardReviewsByMedia } from "@/lib/reviews/dashboard";

describe("filterDashboardReviewsByMedia", () => {
  const rows = [
    { id: "a", review_media: [{ status: "active" as const }] },
    { id: "b", review_media: [{ status: "hidden" as const }] },
    { id: "c", review_media: [] }
  ];

  it("returns all rows when no media filter is provided", () => {
    expect(filterDashboardReviewsByMedia(rows, undefined).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("returns rows with active media when hasMedia=true", () => {
    expect(filterDashboardReviewsByMedia(rows, "true").map((row) => row.id)).toEqual(["a"]);
  });

  it("returns rows without active media when hasMedia=false", () => {
    expect(filterDashboardReviewsByMedia(rows, "false").map((row) => row.id)).toEqual(["b", "c"]);
  });
});
