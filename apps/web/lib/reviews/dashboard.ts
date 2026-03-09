type ReviewMediaStatus = "active" | "hidden" | "removed";

type DashboardReviewMedia = {
  status?: ReviewMediaStatus | null;
};

type DashboardReviewRow = {
  review_media?: DashboardReviewMedia[] | DashboardReviewMedia | null;
};

export function filterDashboardReviewsByMedia<T extends DashboardReviewRow>(items: T[], hasMedia: "true" | "false" | undefined) {
  if (!hasMedia) {
    return items;
  }

  return items.filter((item) => {
    const mediaRaw = item.review_media;
    const mediaList = Array.isArray(mediaRaw) ? mediaRaw : mediaRaw ? [mediaRaw] : [];
    const hasActive = mediaList.some((entry) => entry.status === "active");
    return hasMedia === "true" ? hasActive : !hasActive;
  });
}
