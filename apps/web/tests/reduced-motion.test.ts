import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import StorefrontLoading from "@/app/s/[slug]/loading";
import { OverviewLoadingSkeleton } from "@/components/dashboard/dashboard-loading-skeletons";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from
  })
}));

describe("reduced motion support", () => {
  beforeEach(() => {
    from.mockClear();
    select.mockClear();
    eq.mockClear();
    maybeSingle.mockReset();
    maybeSingle.mockResolvedValue({ data: null });
  });

  test("dashboard skeleton blocks disable pulse animation for reduced-motion users", () => {
    const markup = renderToStaticMarkup(createElement(OverviewLoadingSkeleton));

    expect(markup).toContain("motion-reduce:animate-none");
  });

  test("storefront loading placeholders disable pulse animation for reduced-motion users", async () => {
    const component = await StorefrontLoading({ params: Promise.resolve({ slug: "demo-store" }) });
    const markup = renderToStaticMarkup(component);

    expect(markup).toContain("motion-reduce:animate-none");
  });
});
