import { flagContent } from "@/app/(app)/actions";

/** Progressive-enhancement flag form (works without JS). */
export function FlagForm({
  postId,
  commentId,
  pagePostId,
  labels,
}: {
  postId?: string;
  commentId?: string;
  pagePostId: string;
  labels: { flagAction: string; reason: string; submit: string };
}) {
  return (
    <details className="inline-block">
      <summary className="cursor-pointer text-xs text-ink-faint underline select-none">
        🚩 {labels.flagAction}
      </summary>
      <form
        action={flagContent}
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
        <button type="submit" className="text-xs bg-ink text-paper rounded px-3 py-1">
          {labels.submit}
        </button>
      </form>
    </details>
  );
}
