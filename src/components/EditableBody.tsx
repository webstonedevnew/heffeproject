"use client";

import { useState, useTransition } from "react";
import { Editor } from "@/components/Editor";
import { RichTextView } from "@/components/RichTextView";
import { updateComment } from "@/app/(app)/actions";

/** Comment body with an inline edit mode (30-minute window or teacher). */
export function EditableBody({
  commentId,
  html,
  canEdit,
  labels,
}: {
  commentId: string;
  html: string;
  canEdit: boolean;
  labels: { edit: string; save: string; cancel: string; error: string };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(html);
  const [current, setCurrent] = useState(html);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div>
        <RichTextView html={current} />
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setDraft(current);
              setEditing(true);
            }}
            className="text-xs text-ink-soft underline mt-1"
          >
            {labels.edit}
          </button>
        )}
      </div>
    );
  }

  const save = () =>
    startTransition(async () => {
      try {
        await updateComment({ commentId, bodyHtml: draft });
        setCurrent(draft);
        setEditing(false);
        setError(null);
      } catch {
        setError(labels.error);
      }
    });

  return (
    <div>
      <Editor initialHtml={current} onChange={setDraft} />
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="bg-ink text-paper rounded px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {labels.save}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="border border-line rounded px-3 py-1.5 text-sm hover:bg-paper-deep"
        >
          {labels.cancel}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-accent mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
