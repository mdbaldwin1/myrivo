import { describe, expect, test } from "vitest";
import { sanitizeRichTextHtml } from "@/lib/rich-text";

describe("sanitizeRichTextHtml", () => {
  test("keeps headings, blockquotes, styled spans, and images", () => {
    const input = `
      <h2 style="text-align: center">Heading</h2>
      <blockquote style="margin-left: 1.5rem">Quoted</blockquote>
      <p><span style="font-size: 24px; color: #DC2626; font-family: &quot;Fraunces&quot;, serif">Styled text</span></p>
      <img src="https://cdn.example.com/test.png" alt="Example" data-align="left" data-width="320" style="float: left; margin: 0 1rem 1rem 0; max-width: 75%; width: 320px" />
    `;

    const sanitized = sanitizeRichTextHtml(input);

    expect(sanitized).toContain("<h2 style=\"text-align: center\">Heading</h2>");
    expect(sanitized).toContain("<blockquote style=\"margin-left: 1.5rem\">Quoted</blockquote>");
    expect(sanitized).toContain("font-size: 24px");
    expect(sanitized).toContain("color: #DC2626");
    expect(sanitized).toContain("font-family: &quot;Fraunces&quot;, serif");
    expect(sanitized).toContain("data-align=\"left\"");
    expect(sanitized).toContain("data-width=\"320\"");
    expect(sanitized).toContain("float: left");
    expect(sanitized).toContain("max-width: 75%");
    expect(sanitized).toContain("width: 320px");
  });

  test("drops unsafe image sources and unsafe styles", () => {
    const input = `
      <img src="javascript:alert(1)" alt="Bad" />
      <p style="position: fixed; text-align: center">Hello</p>
      <span style="background-image:url(javascript:evil); color: #111827">World</span>
    `;

    const sanitized = sanitizeRichTextHtml(input);

    expect(sanitized).not.toContain("<img");
    expect(sanitized).toContain("<p style=\"text-align: center\">Hello</p>");
    expect(sanitized).toContain("color: #111827");
    expect(sanitized).not.toContain("background-image");
    expect(sanitized).not.toContain("position:");
  });
});
