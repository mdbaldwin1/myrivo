/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MarketingScrollReveal } from "@/components/marketing/marketing-scroll-reveal";

type IntersectionObserverMockInstance = {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (target: Element, isIntersecting?: boolean) => void;
};

let observerInstances: IntersectionObserverMockInstance[] = [];

describe("MarketingScrollReveal", () => {
  beforeEach(() => {
    observerInstances = [];
    document.documentElement.removeAttribute("data-marketing-reveal-ready");

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800
    });

    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: function getBoundingClientRect() {
        const top = Number((this as HTMLElement).dataset.top ?? 0);

        return {
          x: 0,
          y: top,
          width: 100,
          height: 48,
          top,
          right: 100,
          bottom: top + 48,
          left: 0,
          toJSON() {
            return {};
          }
        } as DOMRect;
      }
    });

    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );

    class IntersectionObserverMock {
      readonly observe = vi.fn();
      readonly unobserve = vi.fn();
      readonly disconnect = vi.fn();
      readonly root = null;
      readonly rootMargin = "0px 0px -12% 0px";
      readonly thresholds = [0.12];

      constructor(private readonly callback: IntersectionObserverCallback) {
        observerInstances.push(this);
      }

      takeRecords() {
        return [];
      }

      trigger(target: Element, isIntersecting = true) {
        this.callback([{ isIntersecting, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
    }

    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-marketing-reveal-ready");
  });

  test("reveals in-view sections immediately and animates later sections when they enter", () => {
    const { container } = render(
      <>
        <section className="marketing-rise" data-top="120">
          Hero
        </section>
        <section className="marketing-rise marketing-delay-1" data-top="1200">
          Features
        </section>
        <MarketingScrollReveal />
      </>
    );

    const sections = Array.from(container.querySelectorAll<HTMLElement>(".marketing-rise"));
    expect(sections).toHaveLength(2);
    expect(document.documentElement.getAttribute("data-marketing-reveal-ready")).toBe("true");
    expect(sections[0]?.classList.contains("marketing-rise-visible")).toBe(true);
    expect(sections[1]?.classList.contains("marketing-rise-visible")).toBe(false);
    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0]?.observe).toHaveBeenCalledWith(sections[1]);

    observerInstances[0]?.trigger(sections[1] as Element, true);

    expect(sections[1]?.classList.contains("marketing-rise-visible")).toBe(true);
    expect(observerInstances[0]?.unobserve).toHaveBeenCalledWith(sections[1]);
  });

  test("skips scroll reveal setup for reduced-motion users", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );

    render(
      <>
        <section className="marketing-rise" data-top="1200">
          Features
        </section>
        <MarketingScrollReveal />
      </>
    );

    expect(document.documentElement.hasAttribute("data-marketing-reveal-ready")).toBe(false);
    expect(observerInstances).toHaveLength(0);
  });
});
