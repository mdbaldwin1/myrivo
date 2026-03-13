"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, Grip } from "lucide-react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

function clampImageWidth(width: number) {
  return Math.max(120, Math.min(960, Math.round(width)));
}

function resolveWrapperStyle(align: "left" | "right" | "full", width: number | null) {
  const style: CSSProperties = {
    maxWidth: align === "full" ? "100%" : "75%",
    width: width ? `${width}px` : undefined,
    marginBottom: "1rem"
  };

  if (align === "left") {
    style.float = "left";
    style.marginRight = "1rem";
  } else if (align === "right") {
    style.float = "right";
    style.marginLeft = "1rem";
  } else {
    style.display = "block";
    style.marginInline = "auto";
  }

  return style;
}

export function RichTextEditorImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const resizeStartRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  const align = node.attrs.align === "left" || node.attrs.align === "right" ? node.attrs.align : "full";
  const width = typeof node.attrs.width === "number" ? node.attrs.width : Number(node.attrs.width ?? 0) || null;

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!resizeStartRef.current) {
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - resizeStartRef.current.startX;
      const direction = align === "right" ? -1 : 1;
      updateAttributes({
        width: clampImageWidth(resizeStartRef.current.startWidth + deltaX * direction)
      });
    }

    function stopResize(event?: PointerEvent) {
      if (!resizeStartRef.current) {
        return;
      }

      if (event && event.pointerId !== resizeStartRef.current.pointerId) {
        return;
      }

      resizeStartRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [align, updateAttributes]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget.parentElement?.querySelector("img");
    const measuredWidth = target instanceof HTMLImageElement ? target.getBoundingClientRect().width : width ?? 320;

    resizeStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: clampImageWidth(measuredWidth)
    };
  }

  function applyAlignment(nextAlign: "left" | "right" | "full") {
    updateAttributes({ align: nextAlign });
  }

  return (
    <NodeViewWrapper
      className="relative clear-both"
      data-image-align={align}
      data-selected={selected ? "true" : "false"}
      contentEditable={false}
      style={resolveWrapperStyle(align, width)}
    >
      {selected && editor.isEditable ? (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-background/95 p-1 shadow-md backdrop-blur">
          <Button
            type="button"
            variant={align === "left" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            aria-label="Image left"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              applyAlignment("left");
            }}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={align === "full" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            aria-label="Full width image"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              applyAlignment("full");
            }}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={align === "right" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            aria-label="Image right"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              applyAlignment("right");
            }}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block h-auto w-full max-w-full rounded-md"
        draggable={false}
      />
      {selected ? (
        <button
          type="button"
          aria-label="Resize image"
          className={`absolute bottom-2 ${align === "right" ? "left-2 cursor-sw-resize" : "right-2 cursor-se-resize"} flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-sm`}
          onPointerDown={handlePointerDown}
          onClick={(event) => event.preventDefault()}
        >
          <Grip className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {selected && editor.isEditable ? (
        <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-primary/30" />
      ) : null}
    </NodeViewWrapper>
  );
}
