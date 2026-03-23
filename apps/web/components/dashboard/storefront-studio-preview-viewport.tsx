"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type StorefrontStudioPreviewViewportProps = {
  title: string;
  widthPx: number;
  children: ReactNode;
};

const IFRAME_ROOT_ID = "storefront-studio-preview-root";
const COPIED_STYLE_ATTR = "data-storefront-preview-style-copy";

function copyHeadStyles(targetDocument: Document) {
  const existing = targetDocument.head.querySelectorAll(`[${COPIED_STYLE_ATTR}="true"]`);
  existing.forEach((node) => node.remove());

  const styleNodes = document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style');
  styleNodes.forEach((node) => {
    const clone = node.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.setAttribute(COPIED_STYLE_ATTR, "true");
    }
    targetDocument.head.appendChild(clone);
  });
}

function syncBodyTheme(targetDocument: Document) {
  targetDocument.body.className = document.body.className;

  for (const attribute of Array.from(targetDocument.body.attributes)) {
    if (attribute.name.startsWith("data-storefront-")) {
      targetDocument.body.removeAttribute(attribute.name);
    }
  }

  for (const { name, value } of Array.from(document.body.attributes)) {
    if (name.startsWith("data-storefront-")) {
      targetDocument.body.setAttribute(name, value);
    }
  }

  const nextStyle = document.body.getAttribute("style");
  if (nextStyle) {
    targetDocument.body.setAttribute("style", nextStyle);
  } else {
    targetDocument.body.removeAttribute("style");
  }

  targetDocument.documentElement.style.height = "100%";
  targetDocument.body.style.height = "100%";
  targetDocument.body.style.overflow = "hidden";
}

export function StorefrontStudioPreviewViewport({ title, widthPx, children }: StorefrontStudioPreviewViewportProps) {
  const [iframeElement, setIframeElement] = useState<HTMLIFrameElement | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  const srcDoc = useMemo(
    () =>
      `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>html,body{margin:0;padding:0;height:100%;min-height:100%;overflow:hidden;}#${IFRAME_ROOT_ID}{height:100%;min-height:100%;}</style></head><body><div id="${IFRAME_ROOT_ID}"></div></body></html>`,
    []
  );

  useEffect(() => {
    if (!iframeElement) {
      return;
    }
    const currentIframe = iframeElement;

    function syncIframeDocument() {
      const targetDocument = currentIframe.contentDocument;
      if (!targetDocument) {
        return;
      }

      copyHeadStyles(targetDocument);
      syncBodyTheme(targetDocument);
      setMountNode(targetDocument.getElementById(IFRAME_ROOT_ID));
    }

    const handleLoad = () => {
      syncIframeDocument();
    };

    currentIframe.addEventListener("load", handleLoad);
    syncIframeDocument();

    const headObserver = new MutationObserver(() => syncIframeDocument());
    headObserver.observe(document.head, { childList: true, subtree: true, attributes: true });

    const bodyObserver = new MutationObserver(() => syncIframeDocument());
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });

    return () => {
      currentIframe.removeEventListener("load", handleLoad);
      headObserver.disconnect();
      bodyObserver.disconnect();
    };
  }, [iframeElement]);

  return (
    <>
      <iframe
        ref={setIframeElement}
        title={title}
        srcDoc={srcDoc}
        className="mx-auto block h-full w-full border-0 bg-white"
        style={{ width: `${widthPx}px`, maxWidth: "100%" }}
      />
      {mountNode ? createPortal(children, mountNode) : null}
    </>
  );
}
