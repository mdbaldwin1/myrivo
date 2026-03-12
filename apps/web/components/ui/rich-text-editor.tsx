"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  RotateCcw,
  RotateCw,
  Underline as UnderlineIcon,
  WandSparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { richTextToPlainText } from "@/lib/rich-text";

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
};

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
  disabled = false
}: RichTextEditorProps) {
  void rows;
  void previewLabel;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https"
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing..."
      })
    ],
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

  function applyLink() {
    if (!editor) {
      return;
    }
    const existingHref = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Enter URL", existingHref ?? "https://");
    if (href === null) {
      return;
    }
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: href.trim() })
      .run();
  }

  const plainTextValue = richTextToPlainText(value);

  if (!editor) {
    return null;
  }

  const toolButtonClass = "h-8 w-8 p-0";

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

  return (
    <div className="space-y-0">
      <TooltipProvider delayDuration={100}>
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-border bg-muted/30 p-1">
          {renderToolbarButton({
            label: "Bold",
            active: editor.isActive("bold"),
            onClick: () => editor.chain().focus().toggleBold().run(),
            children: <Bold className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Italic",
            active: editor.isActive("italic"),
            onClick: () => editor.chain().focus().toggleItalic().run(),
            children: <Italic className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Underline",
            active: editor.isActive("underline"),
            onClick: () => editor.chain().focus().toggleUnderline().run(),
            children: <UnderlineIcon className="h-4 w-4" />
          })}
          <Separator orientation="vertical" className="mx-1 h-6" />
          {renderToolbarButton({
            label: "Bulleted list",
            active: editor.isActive("bulletList"),
            onClick: () => editor.chain().focus().toggleBulletList().run(),
            children: <List className="h-4 w-4" />
          })}
          {renderToolbarButton({
            label: "Numbered list",
            active: editor.isActive("orderedList"),
            onClick: () => editor.chain().focus().toggleOrderedList().run(),
            children: <ListOrdered className="h-4 w-4" />
          })}
          <Separator orientation="vertical" className="mx-1 h-6" />
          {renderToolbarButton({
            label: "Link",
            active: editor.isActive("link"),
            onClick: applyLink,
            children: <LinkIcon className="h-4 w-4" />
          })}
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
          className="prose prose-sm max-w-none p-3 text-foreground prose-p:my-2 prose-ul:my-2 prose-ol:my-2 [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror]:max-h-[360px] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:outline-none"
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
