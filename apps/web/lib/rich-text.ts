function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeHref(href: string) {
  const normalized = href.trim().toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:") ||
    normalized.startsWith("/") ||
    normalized.startsWith("#")
  );
}

function isSafeImageSrc(src: string) {
  const normalized = src.trim().toLowerCase();
  return normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("/");
}

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "sub",
  "sup",
  "span",
  "img"
]);

function readAttributeValue(attrs: string, name: string) {
  function decodeEntities(value: string) {
    return value.replaceAll("&quot;", "\"").replaceAll("&#39;", "'").replaceAll("&amp;", "&");
  }

  const doubleQuoted = attrs.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"));
  if (doubleQuoted?.[1]) {
    return decodeEntities(doubleQuoted[1].trim());
  }

  const singleQuoted = attrs.match(new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, "i"));
  if (singleQuoted?.[1]) {
    return decodeEntities(singleQuoted[1].trim());
  }

  const bare = attrs.match(new RegExp(`\\s${name}\\s*=\\s*([^\\s"'=<>\\x60]+)`, "i"));
  return bare?.[1] ? decodeEntities(bare[1].trim()) : "";
}

function sanitizeTextAlign(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["left", "center", "right", "justify"].includes(normalized) ? normalized : null;
}

function sanitizeMarginLeft(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^\d+(\.\d+)?(rem|px)$/.test(normalized)) {
    return null;
  }

  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return normalized;
}

function sanitizeFontSize(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^\d+(\.\d+)?px$/.test(normalized) ? normalized : null;
}

function sanitizeColor(value: string) {
  const normalized = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    return normalized;
  }

  if (/^rgba?\([0-9.,%\s]+\)$/i.test(normalized)) {
    return normalized;
  }

  return null;
}

function sanitizeFontFamily(value: string) {
  const normalized = value.trim();
  return /^[A-Za-z0-9"',\s.-]+$/.test(normalized) ? normalized : null;
}

function sanitizeFloat(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "left" || normalized === "right" ? normalized : null;
}

function sanitizeDisplay(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "block" ? normalized : null;
}

function sanitizeMargin(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^(\d+(\.\d+)?(rem|px)|auto)(\s+(\d+(\.\d+)?(rem|px)|auto)){0,3}$/.test(normalized) ? normalized : null;
}

function sanitizeMaxWidth(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^(\d+(\.\d+)?%|\d+(\.\d+)?(rem|px))$/.test(normalized) ? normalized : null;
}

function sanitizeWidth(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^(\d+(\.\d+)?px|\d+(\.\d+)?%)$/.test(normalized) ? normalized : null;
}

function sanitizeStyleAttribute(tag: string, attrs: string) {
  const rawStyle = readAttributeValue(attrs, "style");
  if (!rawStyle) {
    return "";
  }

  const safeDeclarations: string[] = [];

  for (const declaration of rawStyle.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":");
    if (!rawProperty || rawValueParts.length === 0) {
      continue;
    }

    const property = rawProperty.trim().toLowerCase();
    const rawValue = rawValueParts.join(":").trim();

    if (["p", "h1", "h2", "h3", "blockquote"].includes(tag)) {
      if (property === "text-align") {
        const safeValue = sanitizeTextAlign(rawValue);
        if (safeValue) {
          safeDeclarations.push(`text-align: ${safeValue}`);
        }
        continue;
      }

      if (property === "margin-left") {
        const safeValue = sanitizeMarginLeft(rawValue);
        if (safeValue) {
          safeDeclarations.push(`margin-left: ${safeValue}`);
        }
        continue;
      }
    }

    if (tag === "span") {
      if (property === "font-size") {
        const safeValue = sanitizeFontSize(rawValue);
        if (safeValue) {
          safeDeclarations.push(`font-size: ${safeValue}`);
        }
        continue;
      }

      if (property === "color") {
        const safeValue = sanitizeColor(rawValue);
        if (safeValue) {
          safeDeclarations.push(`color: ${safeValue}`);
        }
        continue;
      }

      if (property === "font-family") {
        const safeValue = sanitizeFontFamily(rawValue);
        if (safeValue) {
          safeDeclarations.push(`font-family: ${safeValue}`);
        }
      }
    }

    if (tag === "img") {
      if (property === "float") {
        const safeValue = sanitizeFloat(rawValue);
        if (safeValue) {
          safeDeclarations.push(`float: ${safeValue}`);
        }
        continue;
      }

      if (property === "display") {
        const safeValue = sanitizeDisplay(rawValue);
        if (safeValue) {
          safeDeclarations.push(`display: ${safeValue}`);
        }
        continue;
      }

      if (property === "margin") {
        const safeValue = sanitizeMargin(rawValue);
        if (safeValue) {
          safeDeclarations.push(`margin: ${safeValue}`);
        }
        continue;
      }

      if (property === "max-width") {
        const safeValue = sanitizeMaxWidth(rawValue);
        if (safeValue) {
          safeDeclarations.push(`max-width: ${safeValue}`);
        }
        continue;
      }

      if (property === "width") {
        const safeValue = sanitizeWidth(rawValue);
        if (safeValue) {
          safeDeclarations.push(`width: ${safeValue}`);
        }
      }
    }
  }

  return safeDeclarations.length > 0 ? safeDeclarations.join("; ") : "";
}

function sanitizeTag(rawTag: string) {
  const parsed = rawTag.match(/^<\s*(\/?)\s*([a-z0-9-]+)([^>]*)\s*(\/?)\s*>$/i);
  if (!parsed) {
    return "";
  }

  const [, slash = "", name = "", attrs = "", selfClose = ""] = parsed;
  const tag = name.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    return "";
  }

  const isClosing = slash === "/";
  if (isClosing) {
    return `</${tag}>`;
  }

  if (tag === "br") {
    return "<br />";
  }

  if (tag === "a") {
    const href = readAttributeValue(attrs, "href");
    if (!href || !isSafeHref(href)) {
      return "<a rel=\"noreferrer\">";
    }
    return `<a href="${escapeHtml(href)}" rel="noreferrer">`;
  }

  if (tag === "img") {
    const src = readAttributeValue(attrs, "src");
    if (!src || !isSafeImageSrc(src)) {
      return "";
    }

    const alt = readAttributeValue(attrs, "alt");
    const width = readAttributeValue(attrs, "data-width");
    const safeWidth = /^\d+$/.test(width) ? width : "";
    const align = readAttributeValue(attrs, "data-align");
    const safeAlign = align === "left" || align === "right" || align === "full" ? align : "";
    const style = sanitizeStyleAttribute(tag, attrs);
    const styleAttr = style ? ` style="${escapeHtml(style)}"` : "";
    const alignAttr = safeAlign ? ` data-align="${escapeHtml(safeAlign)}"` : "";
    const widthAttr = safeWidth ? ` data-width="${escapeHtml(safeWidth)}"` : "";
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${alignAttr}${widthAttr}${styleAttr} />`;
  }

  const style = sanitizeStyleAttribute(tag, attrs);
  if (style) {
    return `<${tag} style="${escapeHtml(style)}">`;
  }

  if (selfClose === "/") {
    return `<${tag} />`;
  }

  return `<${tag}>`;
}

export function sanitizeRichTextHtml(input: string) {
  if (!input.trim()) {
    return "";
  }

  const withoutBlockedContent = input
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

  return withoutBlockedContent
    .split(/(<[^>]+>)/g)
    .map((segment) => (segment.startsWith("<") ? sanitizeTag(segment) : escapeHtml(segment)))
    .join("")
    .replaceAll("\n", "<br />")
    .trim();
}

export function richTextToPlainText(input: string) {
  if (!input.trim()) {
    return "";
  }

  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
