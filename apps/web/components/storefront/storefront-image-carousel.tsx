"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type StorefrontImageCarouselProps = {
  images: string[];
  alt: string;
  imageClassName: string;
  showArrowsOnHover?: boolean;
  allowPointerSwipe?: boolean;
  hoverZoom?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
  imageFit?: "cover" | "contain";
};

export function StorefrontImageCarousel(props: StorefrontImageCarouselProps) {
  const {
    images,
    alt,
    imageClassName,
    showArrowsOnHover = false,
    allowPointerSwipe = true,
    hoverZoom = false,
    showArrows = true,
    showDots = true,
    imageFit = "cover"
  } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = images.length > 1;

  function scrollToIndex(index: number) {
    const clamped = Math.max(0, Math.min(images.length - 1, index));
    if (!allowPointerSwipe) {
      setActiveIndex(clamped);
      return;
    }

    if (!trackRef.current) {
      return;
    }
    const left = clamped * trackRef.current.clientWidth;
    trackRef.current.scrollTo({ left, behavior: "smooth" });
    setActiveIndex(clamped);
  }

  return (
    <div className={cn("group relative overflow-hidden", imageClassName)}>
      {allowPointerSwipe ? (
        <div
          ref={trackRef}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            const target = event.currentTarget;
            if (!target.clientWidth) {
              return;
            }
            const next = Math.round(target.scrollLeft / target.clientWidth);
            setActiveIndex(next);
          }}
        >
          {images.map((image, index) => (
            <div key={`${image}-${index}`} className="relative h-full w-full shrink-0 snap-start">
              <Image
                src={image}
                alt={alt}
                fill
                unoptimized
                className={cn(
                  imageFit === "contain" ? "object-contain" : "object-cover",
                  "transition-transform duration-300 motion-reduce:transition-none",
                  hoverZoom ? "group-hover:scale-105" : ""
                )}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-full w-full overflow-hidden">
          <div
            className="flex h-full w-full transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
          >
            {images.map((image, index) => (
              <div key={`${image}-${index}`} className="relative h-full w-full shrink-0">
                <Image
                  src={image}
                  alt={alt}
                  fill
                  unoptimized
                  className={cn(
                    imageFit === "contain" ? "object-contain" : "object-cover",
                    "transition-transform duration-300 motion-reduce:transition-none",
                    hoverZoom ? "group-hover:scale-105" : ""
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {hasMultiple ? (
        <>
          {showArrows ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                className={cn(
                  "absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-[color:var(--storefront-surface)]/90 p-1.5 hover:bg-[color:var(--storefront-surface)]",
                  showArrowsOnHover ? "opacity-0 transition-opacity group-hover:opacity-100" : ""
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  scrollToIndex(activeIndex - 1);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                className={cn(
                  "absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-[color:var(--storefront-surface)]/90 p-1.5 hover:bg-[color:var(--storefront-surface)]",
                  showArrowsOnHover ? "opacity-0 transition-opacity group-hover:opacity-100" : ""
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  scrollToIndex(activeIndex + 1);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
          {showDots ? (
            <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
              {images.map((_, index) => (
                <span
                  key={`dot-${index}`}
                  className={cn("h-1.5 w-1.5 rounded-full bg-white/60", activeIndex === index ? "bg-white" : "")}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
