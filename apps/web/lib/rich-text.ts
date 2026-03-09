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

const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "b", "i", "u", "ul", "ol", "li", "a"]);

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
    const hrefMatch =
      attrs.match(/\shref\s*=\s*"([^"]*)"/i) ??
      attrs.match(/\shref\s*=\s*'([^']*)'/i) ??
      attrs.match(/\shref\s*=\s*([^\s"'=<>`]+)/i);
    const href = (hrefMatch?.[1] ?? "").trim();
    if (!href || !isSafeHref(href)) {
      return "<a rel=\"noreferrer\">";
    }
    return `<a href="${escapeHtml(href)}" rel="noreferrer">`;
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

  const escaped = escapeHtml(withoutBlockedContent);
  const withAllowedTags = escaped.replace(/&lt;[^&]*?&gt;/g, (encodedTag) => {
    const decoded = encodedTag
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", "\"")
      .replaceAll("&#39;", "'");
    return sanitizeTag(decoded);
  });

  return withAllowedTags.replaceAll("\n", "<br />").trim();
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
