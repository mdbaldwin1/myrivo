"use client";

import { useLayoutEffect } from "react";

const MARKETING_REVEAL_READY_ATTRIBUTE = "data-marketing-reveal-ready";
const MARKETING_REVEAL_SELECTOR = ".marketing-rise";
const MARKETING_REVEAL_VISIBLE_CLASS = "marketing-rise-visible";
const INITIAL_VISIBILITY_RATIO = 0.92;

function shouldReduceMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MarketingScrollReveal() {
  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    if (shouldReduceMotion() || typeof window.IntersectionObserver !== "function") {
      root.removeAttribute(MARKETING_REVEAL_READY_ATTRIBUTE);
      return;
    }

    const revealElements = Array.from(document.querySelectorAll<HTMLElement>(MARKETING_REVEAL_SELECTOR));
    if (revealElements.length === 0) {
      root.removeAttribute(MARKETING_REVEAL_READY_ATTRIBUTE);
      return;
    }

    const visibleThreshold = window.innerHeight * INITIAL_VISIBILITY_RATIO;
    revealElements.forEach((element) => {
      if (element.getBoundingClientRect().top <= visibleThreshold) {
        element.classList.add(MARKETING_REVEAL_VISIBLE_CLASS);
      } else {
        element.classList.remove(MARKETING_REVEAL_VISIBLE_CLASS);
      }
    });

    root.setAttribute(MARKETING_REVEAL_READY_ATTRIBUTE, "true");

    const observer = new window.IntersectionObserver(
      (entries, currentObserver) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add(MARKETING_REVEAL_VISIBLE_CLASS);
          currentObserver.unobserve(entry.target);
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -12% 0px"
      }
    );

    revealElements.forEach((element) => {
      if (!element.classList.contains(MARKETING_REVEAL_VISIBLE_CLASS)) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
      root.removeAttribute(MARKETING_REVEAL_READY_ATTRIBUTE);
    };
  }, []);

  return null;
}
