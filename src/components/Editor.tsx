"use client";

import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useEffect, useState } from "react";
import { uploadToBucket, fileUrl } from "@/lib/upload-client";
import { Spinner } from "@/components/Spinner";

interface EditorProps {
  placeholder?: string;
  /** Called with the current HTML on every change. */
  onChange: (html: string) => void;
  /** Initial HTML (for editing existing content). */
  initialHtml?: string;
  /** Show the full toolbar (headings, images) — used for posts. */
  full?: boolean;
  imageButtonLabel?: string;
  /** Shown while a pasted/dropped/selected image is uploading. */
  uploadingLabel?: string;
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
  uploadingLabel = "Uploading…",
  resetSignal = 0,
}: EditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  const inFlight = useRef(0);
  const [uploading, setUploading] = useState(false);

  /** Upload an image file and drop it in at the cursor. Shared by the toolbar
   *  button, clipboard paste and drag-and-drop. */
  const uploadAndInsert = async (file: File) => {
    const ed = editorRef.current;
    if (!ed || !file.type.startsWith("image/")) return;
    inFlight.current += 1;
    setUploading(true);
    try {
      const { path } = await uploadToBucket("attachments", file, file.name);
      ed.chain().focus().setImage({ src: fileUrl("attachments", path), alt: file.name }).run();
    } catch (err) {
      console.error(err);
      alert("Image upload failed.");
    } finally {
      inFlight.current -= 1;
      if (inFlight.current <= 0) setUploading(false);
    }
  };

  const imageFilesFrom = (list: FileList | null | undefined) =>
    list ? Array.from(list).filter((f) => f.type.startsWith("image/")) : [];

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
    editorProps: {
      // Paste a screenshot or copied image straight into the text.
      handlePaste(_view, event) {
        const images = imageFilesFrom(event.clipboardData?.files);
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((f) => void uploadAndInsert(f));
        return true;
      },
      // Drag an image file in from the desktop.
      handleDrop(_view, event) {
        const images = imageFilesFrom((event as DragEvent).dataTransfer?.files);
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((f) => void uploadAndInsert(f));
        return true;
      },
    },
    onUpdate({ editor }) {
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

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
              multiple
              className="hidden"
              onChange={(e) => {
                imageFilesFrom(e.target.files).forEach((f) => void uploadAndInsert(f));
                e.target.value = "";
              }}
            />
          </>
        )}
        {uploading && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 text-xs text-ink-faint">
            <Spinner /> {uploadingLabel}
          </span>
        )}
      </div>
      <EditorContent editor={editor} className="prose-tok" />
    </div>
  );
}
