/** @vitest-environment jsdom */

import { Editor } from "@tiptap/core";
import { nextTick } from "node:process";
import { describe, expect, test } from "vitest";
import {
  createRichTextEditorExtensions,
  resolveActiveBlockStyle,
  resolveActiveFontFamily,
  resolveActiveFontSize,
  resolveActiveTextAlign,
  resolveActiveTextColor
} from "@/lib/rich-text-editor";

function createEditor(content = "<p>Hello world</p>") {
  return new Editor({
    content,
    extensions: createRichTextEditorExtensions()
  });
}

describe("rich text editor extensions", () => {
  test("falls back to paragraph when no block style is active", () => {
    const editor = createEditor();
    expect(resolveActiveBlockStyle(editor)).toBe("paragraph");
    editor.destroy();
  });

  test("resolves active heading block style", () => {
    const editor = createEditor("<h2>Hello world</h2>");
    expect(resolveActiveBlockStyle(editor)).toBe("heading-2");
    expect(resolveActiveFontSize(editor)).toBe("30px");
    editor.destroy();
  });

  test("applies heading nodes through setNode", () => {
    const editor = createEditor();

    editor.commands.selectAll();
    editor.commands.setNode("heading", { level: 1 });

    expect(editor.getHTML()).toContain("<h1");
    editor.destroy();
  });

  test("sets and unsets font size", () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setFontSize("24px");

    expect(editor.getHTML()).toContain("font-size: 24px");
    expect(resolveActiveFontSize(editor)).toBe("24px");

    editor.commands.unsetFontSize();
    expect(editor.getHTML()).not.toContain("font-size:");
    expect(resolveActiveFontSize(editor)).toBe("16px");
    editor.destroy();
  });

  test("sets and unsets font family", () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setFontFamily("\"Fraunces\", \"Iowan Old Style\", \"Palatino Linotype\", serif");

    expect(editor.getHTML()).toContain("font-family:");
    expect(resolveActiveFontFamily(editor)).toContain("Fraunces");

    editor.commands.unsetFontFamily();
    expect(editor.getHTML()).not.toContain("font-family:");
    expect(resolveActiveFontFamily(editor)).toBe("default");
    editor.destroy();
  });

  test("sets text color", () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setColor("#DC2626");

    expect(editor.getHTML()).toContain("color: rgb(220, 38, 38)");
    expect(resolveActiveTextColor(editor)).toBe("#DC2626");
    editor.destroy();
  });

  test("applies and removes indentation on paragraphs", () => {
    const editor = createEditor();

    editor.commands.indent();
    expect(editor.getHTML()).toContain("margin-left: 1.5rem");

    editor.commands.outdent();
    expect(editor.getHTML()).not.toContain("margin-left:");
    editor.destroy();
  });

  test("applies text alignment", () => {
    const editor = createEditor();
    editor.commands.setTextAlign("center");

    expect(editor.getHTML()).toContain("text-align: center");
    expect(resolveActiveTextAlign(editor)).toBe("center");
    editor.destroy();
  });

  test("supports blockquotes, subscript, and superscript", () => {
    const editor = createEditor();

    editor.commands.toggleBlockquote();
    expect(editor.getHTML()).toContain("<blockquote");

    editor.commands.selectAll();
    editor.commands.toggleSubscript();
    expect(editor.getHTML()).toContain("<sub>");

    editor.commands.toggleSubscript();
    editor.commands.toggleSuperscript();
    expect(editor.getHTML()).toContain("<sup>");
    editor.destroy();
  });

  test("supports image nodes", () => {
    const editor = createEditor();

    editor.commands.insertContent({
      type: "image",
      attrs: {
        src: "https://example.com/image.png",
        alt: "Example image",
        align: "left"
      }
    });

    expect(editor.getHTML()).toContain("<img");
    expect(editor.getHTML()).toContain("src=\"https://example.com/image.png\"");
    expect(editor.getHTML()).toContain("alt=\"Example image\"");
    expect(editor.getHTML()).toContain("data-align=\"left\"");
    expect(editor.getHTML()).toContain("float: left");
    expect(editor.getHTML()).toContain("max-width: 75%");
    editor.commands.setNodeSelection(0);
    editor.commands.setImageAlignment("right");
    expect(editor.getHTML()).toContain("data-align=\"right\"");
    expect(editor.getHTML()).toContain("float: right");
    expect(editor.getHTML()).toContain("max-width: 75%");
    editor.commands.setImageWidth(320);
    expect(editor.getHTML()).toContain("data-width=\"320\"");
    expect(editor.getHTML()).toContain("width: 320px");
    editor.destroy();
  });

  test("uses Tab and Shift+Tab for indentation", async () => {
    const editor = createEditor();

    editor.commands.focus("end");

    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true
      })
    );
    await new Promise((resolve) => nextTick(resolve));

    expect(editor.getHTML()).toContain("margin-left: 1.5rem");

    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true
      })
    );
    await new Promise((resolve) => nextTick(resolve));

    expect(editor.getHTML()).not.toContain("margin-left:");
    editor.destroy();
  });
});
