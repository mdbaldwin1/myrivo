import { Extension, mergeAttributes } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { RichTextEditorImageNodeView } from "@/components/ui/rich-text-editor-image-node-view";

const FONT_SIZE_VALUES = ["12px", "14px", "16px", "18px", "24px", "30px", "36px"] as const;
const INDENT_STEP_REM = 1.5;
const MAX_INDENT_LEVEL = 6;
export const RICH_TEXT_IMAGE_ALIGNMENTS = [
  { label: "Full width", value: "full" },
  { label: "Image left", value: "left" },
  { label: "Image right", value: "right" }
] as const;

export const RICH_TEXT_FONT_FAMILIES = [
  { label: "Default", value: "default" },
  { label: "Sans", value: "\"Manrope\", \"Avenir Next\", \"Segoe UI\", sans-serif" },
  { label: "Serif", value: "\"Fraunces\", \"Iowan Old Style\", \"Palatino Linotype\", serif" },
  { label: "Monospace", value: "\"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace" }
] as const;

export const RICH_TEXT_FONT_SIZES = FONT_SIZE_VALUES.map((value) => ({
  label: value.replace("px", " px"),
  value
})) as ReadonlyArray<{ label: string; value: (typeof FONT_SIZE_VALUES)[number] }>;

export const RICH_TEXT_COLOR_SWATCHES = [
  "#111827",
  "#374151",
  "#6B7280",
  "#7C3AED",
  "#2563EB",
  "#0F766E",
  "#15803D",
  "#B45309",
  "#DC2626",
  "#BE185D"
] as const;

export const RICH_TEXT_BLOCK_STYLES = [
  { label: "Paragraph", value: "paragraph" },
  { label: "Heading 1", value: "heading-1" },
  { label: "Heading 2", value: "heading-2" },
  { label: "Heading 3", value: "heading-3" },
  { label: "Quote", value: "blockquote" }
] as const;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
    imageAlignment: {
      setImageAlignment: (align: "left" | "right" | "full") => ReturnType;
    };
    imageSize: {
      setImageWidth: (width: number | null) => ReturnType;
    };
  }
}

function normalizeFontSize(fontSize: string) {
  if (!fontSize) {
    return null;
  }

  const trimmed = fontSize.trim();
  if (!trimmed) {
    return null;
  }

  return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
}

export const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => normalizeFontSize((element as HTMLElement).style.fontSize),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }

              return { style: `font-size: ${attributes.fontSize}` };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) => {
          const nextFontSize = normalizeFontSize(fontSize);
          if (!nextFontSize) {
            return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
          }

          return chain().setMark("textStyle", { fontSize: nextFontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run()
    };
  }
});

function parseIndentLevel(element: HTMLElement) {
  const marginLeft = element.style.marginLeft;
  if (!marginLeft) {
    return 0;
  }

  const parsed = Number.parseFloat(marginLeft);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  if (marginLeft.endsWith("rem")) {
    return Math.min(MAX_INDENT_LEVEL, Math.round(parsed / INDENT_STEP_REM));
  }

  if (marginLeft.endsWith("px")) {
    return Math.min(MAX_INDENT_LEVEL, Math.round(parsed / 24));
  }

  return 0;
}

function clampIndentLevel(level: number) {
  return Math.max(0, Math.min(MAX_INDENT_LEVEL, level));
}

export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => parseIndentLevel(element as HTMLElement),
            renderHTML: (attributes) => {
              if (!attributes.indent) {
                return {};
              }

              return { style: `margin-left: ${attributes.indent * INDENT_STEP_REM}rem` };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ commands, state }) => {
          const currentLevel = clampIndentLevel(Number(state.selection.$from.parent.attrs.indent ?? 0));
          const nextLevel = clampIndentLevel(currentLevel + 1);

          return (
            commands.updateAttributes("paragraph", { indent: nextLevel }) ||
            commands.updateAttributes("heading", { indent: nextLevel }) ||
            commands.updateAttributes("blockquote", { indent: nextLevel })
          );
        },
      outdent:
        () =>
        ({ commands, state }) => {
          const currentLevel = clampIndentLevel(Number(state.selection.$from.parent.attrs.indent ?? 0));
          const nextLevel = clampIndentLevel(currentLevel - 1);

          return (
            commands.updateAttributes("paragraph", { indent: nextLevel }) ||
            commands.updateAttributes("heading", { indent: nextLevel }) ||
            commands.updateAttributes("blockquote", { indent: nextLevel })
          );
        }
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const editor = this.editor;

        if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
          return editor.chain().focus().sinkListItem("listItem").run();
        }

        return editor.chain().focus().indent().run();
      },
      "Shift-Tab": () => {
        const editor = this.editor;

        if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
          return editor.chain().focus().liftListItem("listItem").run();
        }

        return editor.chain().focus().outdent().run();
      }
    };
  }
});

function clampImageWidth(width: number | null | undefined) {
  if (!width || !Number.isFinite(width)) {
    return null;
  }

  return Math.max(120, Math.min(960, Math.round(width)));
}

function resolveImageStyles(align: "left" | "right" | "full", width: number | null) {
  const safeWidth = clampImageWidth(width);
  const widthStyle = safeWidth ? `width: ${safeWidth}px;` : "";

  if (align === "left") {
    return `float: left; max-width: 75%; margin: 0 1rem 1rem 0; ${widthStyle}`.trim();
  }

  if (align === "right") {
    return `float: right; max-width: 75%; margin: 0 0 1rem 1rem; ${widthStyle}`.trim();
  }

  return `display: block; max-width: 100%; margin: 0 auto 1rem; ${widthStyle}`.trim();
}

export const RichTextImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "full",
        parseHTML: (element) => {
          const explicit = (element as HTMLElement).getAttribute("data-align");
          if (explicit === "left" || explicit === "right" || explicit === "full") {
            return explicit;
          }

          const floatValue = (element as HTMLElement).style.float;
          if (floatValue === "left" || floatValue === "right") {
            return floatValue;
          }

          return "full";
        },
        renderHTML: (attributes) => {
          const align = attributes.align === "left" || attributes.align === "right" ? attributes.align : "full";
          return {
            "data-align": align,
            style: resolveImageStyles(align, clampImageWidth(Number(attributes.width ?? 0)) ?? null)
          };
        }
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const explicitWidth = Number.parseInt((element as HTMLElement).getAttribute("data-width") ?? "", 10);
          if (Number.isFinite(explicitWidth)) {
            return clampImageWidth(explicitWidth);
          }

          const styleWidth = Number.parseInt((element as HTMLElement).style.width ?? "", 10);
          return Number.isFinite(styleWidth) ? clampImageWidth(styleWidth) : null;
        },
        renderHTML: (attributes) => {
          const width = clampImageWidth(Number(attributes.width ?? 0));
          if (!width) {
            return {};
          }

          return {
            "data-width": String(width)
          };
        }
      }
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlignment:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes("image", { align }),
      setImageWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes("image", { width: clampImageWidth(width) })
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(RichTextEditorImageNodeView);
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  }
});

export function createRichTextEditorExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      },
      link: false,
      underline: false
    }),
    Underline,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    TextAlign.configure({
      types: ["heading", "paragraph", "blockquote"]
    }),
    Subscript,
    Superscript,
    Indent,
    RichTextImage.configure({
      inline: false,
      allowBase64: false
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https"
    }),
    Placeholder.configure({
      placeholder: placeholder ?? "Start writing..."
    })
  ];
}

export function resolveActiveBlockStyle(editor: {
  isActive: (name: string, attributes?: Record<string, unknown>) => boolean;
}) {
  if (editor.isActive("heading", { level: 1 })) {
    return "heading-1";
  }

  if (editor.isActive("heading", { level: 2 })) {
    return "heading-2";
  }

  if (editor.isActive("heading", { level: 3 })) {
    return "heading-3";
  }

  if (editor.isActive("blockquote")) {
    return "blockquote";
  }

  return "paragraph";
}

export function resolveActiveFontFamily(editor: {
  getAttributes: (name: string) => Record<string, unknown>;
}) {
  const activeFontFamily = String(editor.getAttributes("textStyle").fontFamily ?? "");

  return (
    RICH_TEXT_FONT_FAMILIES.find((option) => option.value !== "default" && option.value === activeFontFamily)?.value ??
    "default"
  );
}

export function resolveActiveFontSize(editor: {
  isActive: (name: string, attributes?: Record<string, unknown>) => boolean;
  getAttributes: (name: string) => Record<string, unknown>;
}) {
  const activeFontSize = normalizeFontSize(String(editor.getAttributes("textStyle").fontSize ?? ""));
  if (FONT_SIZE_VALUES.includes(activeFontSize as (typeof FONT_SIZE_VALUES)[number])) {
    return activeFontSize ?? "16px";
  }

  if (editor.isActive("heading", { level: 1 })) {
    return "36px";
  }

  if (editor.isActive("heading", { level: 2 })) {
    return "30px";
  }

  if (editor.isActive("heading", { level: 3 })) {
    return "24px";
  }

  return "16px";
}

export function resolveActiveTextColor(editor: {
  getAttributes: (name: string) => Record<string, unknown>;
}) {
  const activeColor = String(editor.getAttributes("textStyle").color ?? "").trim();
  return activeColor || "#111827";
}

export function resolveActiveTextAlign(editor: {
  state: {
    selection: {
      $from: {
        parent: {
          attrs: Record<string, unknown>;
        };
      };
    };
  };
}) {
  const textAlign = String(editor.state.selection.$from.parent.attrs.textAlign ?? "").trim();
  return textAlign || "left";
}

export function resolveActiveImageAlignment(editor: {
  getAttributes: (name: string) => Record<string, unknown>;
}) {
  const align = String(editor.getAttributes("image").align ?? "").trim();
  if (align === "left" || align === "right" || align === "full") {
    return align;
  }

  return "full";
}

export function resolveActiveImageWidth(editor: {
  getAttributes: (name: string) => Record<string, unknown>;
}) {
  return clampImageWidth(Number(editor.getAttributes("image").width ?? 0));
}
