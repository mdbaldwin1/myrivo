"use client";

import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CaseLower,
  ChevronDown,
  Heading,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Palette,
  RotateCcw,
  RotateCw,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
  WandSparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditorImageControl, type RichTextEditorImageUploadConfig } from "@/components/ui/rich-text-editor-image-control";
import { Separator } from "@/components/ui/separator";
import { RichTextEditorLinkControl } from "@/components/ui/rich-text-editor-link-control";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createRichTextEditorExtensions,
  resolveActiveBlockStyle,
  resolveActiveFontFamily,
  resolveActiveFontSize,
  resolveActiveTextAlign,
  resolveActiveTextColor,
  RICH_TEXT_BLOCK_STYLES,
  RICH_TEXT_COLOR_SWATCHES,
  RICH_TEXT_FONT_FAMILIES,
  RICH_TEXT_FONT_SIZES
} from "@/lib/rich-text-editor";
import { richTextToPlainText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  id?: string;
  "aria-describedby"?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  rows?: number;
  previewLabel?: string;
  disabled?: boolean;
  imageUpload?: RichTextEditorImageUploadConfig;
};

const FALLBACK_EDITOR_UI_STATE = {
  activeBlockStyle: "paragraph",
  activeFontFamily: "default",
  activeFontSize: "16px",
  activeTextAlign: "left",
  activeTextColor: "#111827",
  currentIndentLevel: 0,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrike: false,
  isSuperscript: false,
  isSubscript: false,
  isBulletList: false,
  isOrderedList: false
} as const;

export function RichTextEditor({
  id,
  "aria-describedby": ariaDescribedBy,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  rows = 6,
  previewLabel,
  disabled = false,
  imageUpload
}: RichTextEditorProps) {
  void previewLabel;

  const editor = useEditor({
    extensions: createRichTextEditorExtensions(placeholder),
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  const editorUiState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      ...(currentEditor
        ? {
            activeBlockStyle: resolveActiveBlockStyle(currentEditor),
            activeFontFamily: resolveActiveFontFamily(currentEditor),
            activeFontSize: resolveActiveFontSize(currentEditor),
            activeTextAlign: resolveActiveTextAlign(currentEditor),
            activeTextColor: resolveActiveTextColor(currentEditor),
            currentIndentLevel: Number(currentEditor.state.selection.$from.parent.attrs.indent ?? 0),
            isBold: currentEditor.isActive("bold"),
            isItalic: currentEditor.isActive("italic"),
            isUnderline: currentEditor.isActive("underline"),
            isStrike: currentEditor.isActive("strike"),
            isSuperscript: currentEditor.isActive("superscript"),
            isSubscript: currentEditor.isActive("subscript"),
            isBulletList: currentEditor.isActive("bulletList"),
            isOrderedList: currentEditor.isActive("orderedList")
          }
        : FALLBACK_EDITOR_UI_STATE)
    })
  });

  const plainTextValue = richTextToPlainText(value);

  if (!editor) {
    return null;
  }

  const currentEditor = editor;

  const toolButtonClass = "h-8 w-8 p-0";
  const selectClassName =
    "h-8 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50";
  const minEditorHeight = Math.max(rows, 4) * 24 + 32;

  function renderToolbarButton({
    label,
    active = false,
    onClick,
    children
  }: {
    label: string;
    active?: boolean;
    onClick: () => void;
    children: ReactNode;
  }) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            className={toolButtonClass}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    );
  }

  function applyBlockStyle(nextValue: string) {
    const chain = currentEditor.chain().focus();

    if (nextValue === "paragraph") {
      chain.setParagraph().run();
      return;
    }

    if (nextValue === "blockquote") {
      chain.toggleBlockquote().run();
      return;
    }

    const headingMatch = nextValue.match(/^heading-(\d)$/);
    if (headingMatch) {
      chain.toggleHeading({ level: Number(headingMatch[1]) as 1 | 2 | 3 }).run();
    }
  }

  function applyFontFamily(nextValue: string) {
    if (nextValue === "default") {
      currentEditor.chain().focus().unsetFontFamily().run();
      return;
    }

    currentEditor.chain().focus().setFontFamily(nextValue).run();
  }

  const resolvedEditorUiState = editorUiState ?? FALLBACK_EDITOR_UI_STATE;

  const activeBlockStyle = resolvedEditorUiState.activeBlockStyle;
  const activeFontFamily = resolvedEditorUiState.activeFontFamily;
  const activeFontSize = resolvedEditorUiState.activeFontSize;
  const activeTextAlign = resolvedEditorUiState.activeTextAlign;
  const activeTextColor = resolvedEditorUiState.activeTextColor;
  const currentIndentLevel = resolvedEditorUiState.currentIndentLevel;

  return (
    <div className="space-y-0">
      <TooltipProvider delayDuration={100}>
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-border bg-muted/30 p-1">
          <div className="flex items-center gap-1">
            <div className="relative">
              <Heading className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                aria-label="Text style"
                className={cn(selectClassName, "w-[9.5rem] pl-7 pr-7")}
                disabled={disabled}
                value={activeBlockStyle}
                onChange={(event) => applyBlockStyle(event.target.value)}
              >
                {RICH_TEXT_BLOCK_STYLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="relative">
              <CaseLower className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                aria-label="Font family"
                className={cn(selectClassName, "w-[8.5rem] pl-7 pr-7")}
                disabled={disabled}
                value={activeFontFamily}
                onChange={(event) => applyFontFamily(event.target.value)}
              >
                {RICH_TEXT_FONT_FAMILIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="relative">
              <CaseLower className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                aria-label="Font size"
                className={cn(selectClassName, "w-[6.5rem] pl-7 pr-7")}
                disabled={disabled}
                value={activeFontSize}
                onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()}
              >
                {RICH_TEXT_FONT_SIZES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <Separator orientation="vertical" className="mx-1 h-6" />
          {renderToolbarButton({
            label: "Bold",
            active: resolvedEditorUiState.isBold,
            onClick: () => editor.chain().focus().toggleBold().run(),
            children: <Bold className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Italic",
            active: resolvedEditorUiState.isItalic,
            onClick: () => editor.chain().focus().toggleItalic().run(),
            children: <Italic className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Underline",
            active: resolvedEditorUiState.isUnderline,
            onClick: () => editor.chain().focus().toggleUnderline().run(),
            children: <UnderlineIcon className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Strikethrough",
            active: resolvedEditorUiState.isStrike,
            onClick: () => editor.chain().focus().toggleStrike().run(),
            children: <Strikethrough className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Superscript",
            active: resolvedEditorUiState.isSuperscript,
            onClick: () => editor.chain().focus().toggleSuperscript().run(),
            children: <SuperscriptIcon className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Subscript",
            active: resolvedEditorUiState.isSubscript,
            onClick: () => editor.chain().focus().toggleSubscript().run(),
            children: <SubscriptIcon className="h-4 w-4" />
          })}
          <Separator orientation="vertical" className="mx-1 h-6" />
          <div className="flex items-center gap-1">
            {renderToolbarButton({
              label: "Align left",
              active: activeTextAlign === "left",
              onClick: () => editor.chain().focus().setTextAlign("left").run(),
              children: <AlignLeft className="h-4 w-4" />
            })}
            {renderToolbarButton({
              label: "Align center",
              active: activeTextAlign === "center",
              onClick: () => editor.chain().focus().setTextAlign("center").run(),
              children: <AlignCenter className="h-4 w-4" />
            })}
            {renderToolbarButton({
              label: "Align right",
              active: activeTextAlign === "right",
              onClick: () => editor.chain().focus().setTextAlign("right").run(),
              children: <AlignRight className="h-4 w-4" />
            })}
            {renderToolbarButton({
              label: "Justify",
              active: activeTextAlign === "justify",
              onClick: () => editor.chain().focus().setTextAlign("justify").run(),
              children: <AlignJustify className="h-4 w-4" />
            })}
          </div>
          <Separator orientation="vertical" className="mx-1 h-6" />
          {renderToolbarButton({
            label: "Bulleted list",
            active: resolvedEditorUiState.isBulletList,
            onClick: () => editor.chain().focus().toggleBulletList().run(),
            children: <List className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Numbered list",
            active: resolvedEditorUiState.isOrderedList,
            onClick: () => editor.chain().focus().toggleOrderedList().run(),
            children: <ListOrdered className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Decrease indent",
            active: currentIndentLevel > 0,
            onClick: () => editor.chain().focus().outdent().run(),
            children: <IndentDecrease className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Increase indent",
            onClick: () => editor.chain().focus().indent().run(),
            children: <IndentIncrease className="h-4 w-4" />
          })}
          <Separator orientation="vertical" className="mx-1 h-6" />
          <RichTextEditorImageControl editor={editor} disabled={disabled} buttonClassName={toolButtonClass} upload={imageUpload} />
          <RichTextEditorLinkControl editor={editor} disabled={disabled} buttonClassName={toolButtonClass} />
          <div className="ml-1 flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 shadow-sm">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Text color"
              type="color"
              className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
              disabled={disabled}
              value={activeTextColor}
              onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            />
            <div className="flex items-center gap-1">
              {RICH_TEXT_COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Apply ${color} text color`}
                  disabled={disabled}
                  className={cn(
                    "h-3.5 w-3.5 rounded-full border border-border/70 transition-transform hover:scale-110",
                    activeTextColor.toLowerCase() === color.toLowerCase() && "ring-2 ring-primary/30 ring-offset-1"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                />
              ))}
            </div>
          </div>
          <Separator orientation="vertical" className="mx-1 h-6" />
          {renderToolbarButton({
            label: "Undo",
            onClick: () => editor.chain().focus().undo().run(),
            children: <RotateCcw className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Redo",
            onClick: () => editor.chain().focus().redo().run(),
            children: <RotateCw className="h-4 w-4" />
          })}
          <Separator orientation="vertical" className="mx-1 h-6" />
          {renderToolbarButton({
            label: "Clear formatting",
            onClick: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
            children: <WandSparkles className="h-4 w-4" />
          })}
        </div>
      </TooltipProvider>

      <div className="rounded-b-md border border-t-0 border-border bg-background">
        <EditorContent
          editor={editor}
          id={id}
          aria-describedby={ariaDescribedBy}
          className="p-3 text-foreground [&_.ProseMirror]:min-h-[var(--rich-text-min-height)] [&_.ProseMirror]:max-h-[420px] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-sm [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_p]:my-2 [&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_li]:my-1 [&_.ProseMirror_img]:my-3 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-md"
          style={
            {
              ["--rich-text-min-height" as string]: `${minEditorHeight}px`
            } as CSSProperties
          }
        />
      </div>

      <textarea
        aria-hidden
        tabIndex={-1}
        readOnly
        value={plainTextValue}
        required={required}
        minLength={minLength}
        className="sr-only"
      />
    </div>
  );
}
