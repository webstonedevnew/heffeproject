"use client";

import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useEffect } from "react";
import { uploadToBucket, fileUrl } from "@/lib/upload-client";

interface EditorProps {
  placeholder?: string;
  /** Called with the current HTML on every change. */
  onChange: (html: string) => void;
  /** Initial HTML (for editing existing content). */
  initialHtml?: string;
  /** Show the full toolbar (headings, images) — used for posts. */
  full?: boolean;
  imageButtonLabel?: string;
  /** Incremented by the parent to clear the editor after submit. */
  resetSignal?: number;
}

function ToolbarButton({
  editor,
  active,
  onClick,
  label,
  children,
}: {
  editor: TiptapEditor;
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={!editor.isEditable}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-2 py-1 rounded text-sm min-w-8 ${
        active ? "bg-ink text-paper" : "hover:bg-paper-deep"
      }`}
    >
      {children}
    </button>
  );
}

export function Editor({
  placeholder,
  onChange,
  initialHtml = "",
  full = false,
  imageButtonLabel = "Insert image",
  resetSignal = 0,
}: EditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: full ? { levels: [2, 3] } : false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: initialHtml,
    onUpdate({ editor }) {
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
  });

  useEffect(() => {
    if (resetSignal > 0 && editor) {
      editor.commands.clearContent();
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  if (!editor) {
    return <div className="border border-line rounded-md bg-card min-h-32" aria-hidden />;
  }

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const insertImage = async (file: File) => {
    try {
      const { path } = await uploadToBucket("attachments", file, file.name);
      editor
        .chain()
        .focus()
        .setImage({ src: fileUrl("attachments", path), alt: file.name })
        .run();
    } catch (err) {
      console.error(err);
      alert("Image upload failed.");
    }
  };

  return (
    <div className="border border-line rounded-md bg-card focus-within:border-ink-faint">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border-b border-line px-1.5 py-1">
        {full && (
          <>
            <ToolbarButton
              editor={editor}
              label="Heading"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              editor={editor}
              label="Subheading"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              H3
            </ToolbarButton>
          </>
        )}
        <ToolbarButton
          editor={editor}
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Link" active={editor.isActive("link")} onClick={setLink}>
          🔗
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ••
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          ❝
        </ToolbarButton>
        {full && (
          <>
            <ToolbarButton
              editor={editor}
              label={imageButtonLabel}
              onClick={() => fileInputRef.current?.click()}
            >
              🖼
            </ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void insertImage(file);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>
      <EditorContent editor={editor} className="prose-tok" />
    </div>
  );
}
