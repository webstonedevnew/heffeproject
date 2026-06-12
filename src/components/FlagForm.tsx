"use client";

import { useState, useTransition } from "react";
import { flagContent } from "@/app/(app)/actions";

/**
 * Flag-for-teacher form with explicit confirmation. The server also dedupes
 * (one open flag per user per target), so repeat submissions are harmless.
 */
export function FlagForm({
  postId,
  commentId,
  pagePostId,
  labels,
}: {
  postId?: string;
  commentId?: string;
  pagePostId: string;
  labels: { flagAction: string; reason: string; submit: string; done: string; error: string };
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <span role="status" className="text-xs text-sage font-medium">
        ✓ {labels.done}
      </span>
    );
  }

  const submit = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    setError(false);
    startTransition(async () => {
      try {
        await flagContent(formData);
        setDone(true);
      } catch (err) {
        console.error(err);
        setError(true);
      }
    });
  };

  return (
    <details className="inline-block">
      <summary className="cursor-pointer text-xs text-ink-faint underline select-none">
        🚩 {labels.flagAction}
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        className="mt-2 p-2 bg-paper-deep rounded space-y-2 max-w-xs"
      >
        {postId && <input type="hidden" name="postId" value={postId} />}
        {commentId && <input type="hidden" name="commentId" value={commentId} />}
        <input type="hidden" name="pagePostId" value={pagePostId} />
        <label className="block text-xs">
          {labels.reason}
          <textarea
            name="reason"
            rows={2}
            maxLength={500}
            className="w-full border border-line rounded px-2 py-1 bg-paper mt-1"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="text-xs bg-ink text-paper rounded px-3 py-1 disabled:opacity-40"
        >
          {pending ? "…" : labels.submit}
        </button>
        {error && (
          <p role="alert" className="text-xs text-accent">
            {labels.error}
          </p>
        )}
      </form>
    </details>
  );
}
