"use client";

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
import { richTextToPlainText } from "@/lib/rich-text";

type RichTextEditorProps = {
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

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-border bg-muted/30 p-1">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="icon"
          className={toolButtonClass}
          aria-label="Bold"
          title="Bold"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="icon"
          className={toolButtonClass}
          aria-label="Italic"
          title="Italic"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("underline") ? "secondary" : "ghost"}
          size="icon"
          className={toolButtonClass}
          aria-label="Underline"
          title="Underline"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="icon"
          className={toolButtonClass}
          aria-label="Bulleted list"
          title="Bulleted list"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          size="icon"
          className={toolButtonClass}
          aria-label="Numbered list"
          title="Numbered list"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          type="button"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          size="icon"
          className={toolButtonClass}
          aria-label="Link"
          title="Link"
          disabled={disabled}
          onClick={applyLink}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={toolButtonClass}
          aria-label="Undo"
          title="Undo"
          disabled={disabled}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={toolButtonClass}
          aria-label="Redo"
          title="Redo"
          disabled={disabled}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={toolButtonClass}
          aria-label="Clear formatting"
          title="Clear formatting"
          disabled={disabled}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <WandSparkles className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-b-md border border-t-0 border-border bg-background">
        <EditorContent
          editor={editor}
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
