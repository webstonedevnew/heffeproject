"use client";

import { useState, useTransition } from "react";
import { Editor } from "@/components/Editor";
import { uploadToBucket } from "@/lib/upload-client";
import { parsePollOptions } from "@/lib/polls";
import { createPost, updatePost, type AttachmentInput } from "@/app/(app)/actions";

export interface PostFormLabels {
  title: string;
  body: string;
  group: string;
  cohort: string;
  cohortHint: string;
  allGrades: string;
  dueResponse: string;
  dueReplies: string;
  dueHint: string;
  attachments: string;
  submit: string;
  error: string;
  uploadImage: string;
  pollQuestion: string;
  pollOptions: string;
  pollHint: string;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function PostForm({
  groups,
  cohorts,
  labels,
  postId,
  initial,
}: {
  groups: { id: string; name: string }[];
  cohorts: { id: string; name: string }[];
  labels: PostFormLabels;
  /** When set, the form edits an existing post. */
  postId?: string;
  initial?: {
    title: string;
    bodyHtml: string;
    groupId: string;
    dueAtResponse: string | null;
    dueAtReplies: string | null;
  };
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [groupId, setGroupId] = useState(initial?.groupId ?? groups[0]?.id ?? "");
  // "" = all grades (shared). Default to the first grade so a post is targeted
  // unless the teacher deliberately chooses to share it with everyone.
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? "");
  const [dueResponse, setDueResponse] = useState(isoToLocalInput(initial?.dueAtResponse ?? null));
  const [dueReplies, setDueReplies] = useState(isoToLocalInput(initial?.dueAtReplies ?? null));
  const [files, setFiles] = useState<File[]>([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsRaw, setPollOptionsRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!title.trim() || !bodyHtml) return;
    setError(null);
    startTransition(async () => {
      try {
        if (postId) {
          await updatePost({
            postId,
            title,
            bodyHtml,
            dueAtResponse: localInputToIso(dueResponse),
            dueAtReplies: localInputToIso(dueReplies),
          });
        } else {
          const attachments: AttachmentInput[] = [];
          for (const file of files) {
            const { path, size, mime } = await uploadToBucket("attachments", file, file.name);
            attachments.push({ path, filename: file.name, size, mime });
          }
          const pollOptions = parsePollOptions(pollOptionsRaw);
          await createPost({
            title,
            groupId,
            cohortId: cohortId || null,
            bodyHtml,
            dueAtResponse: localInputToIso(dueResponse),
            dueAtReplies: localInputToIso(dueReplies),
            attachments,
            poll:
              pollQuestion.trim() && pollOptions.length >= 2
                ? { question: pollQuestion, options: pollOptions }
                : null,
          });
        }
      } catch (err) {
        // Server actions that redirect throw internally — let those bubble.
        if (err && typeof err === "object" && "digest" in err) throw err;
        console.error(err);
        setError(labels.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="post-title" className="block text-sm font-medium mb-1">
          {labels.title}
        </label>
        <input
          id="post-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full border border-line rounded px-3 py-2 bg-paper font-display text-lg"
        />
      </div>

      {!postId && (
        <div>
          <label htmlFor="post-group" className="block text-sm font-medium mb-1">
            {labels.group}
          </label>
          <select
            id="post-group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 bg-paper"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!postId && cohorts.length > 0 && (
        <div>
          <label htmlFor="post-cohort" className="block text-sm font-medium mb-1">
            {labels.cohort}
          </label>
          <select
            id="post-cohort"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            aria-describedby="post-cohort-hint"
            className="w-full border border-line rounded px-3 py-2 bg-paper"
          >
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="">{labels.allGrades}</option>
          </select>
          <p id="post-cohort-hint" className="text-xs text-ink-faint mt-1">
            {labels.cohortHint}
          </p>
        </div>
      )}

      <div>
        <span className="block text-sm font-medium mb-1">{labels.body}</span>
        <Editor
          full
          onChange={setBodyHtml}
          initialHtml={initial?.bodyHtml ?? ""}
          imageButtonLabel={labels.uploadImage}
        />
      </div>

      <fieldset className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="due-response" className="block text-sm font-medium mb-1">
            {labels.dueResponse}
          </label>
          <input
            id="due-response"
            type="datetime-local"
            value={dueResponse}
            onChange={(e) => setDueResponse(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 bg-paper"
          />
        </div>
        <div>
          <label htmlFor="due-replies" className="block text-sm font-medium mb-1">
            {labels.dueReplies}
          </label>
          <input
            id="due-replies"
            type="datetime-local"
            value={dueReplies}
            onChange={(e) => setDueReplies(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 bg-paper"
          />
        </div>
        <p className="text-xs text-ink-faint sm:col-span-2">{labels.dueHint}</p>
      </fieldset>

      {!postId && (
        <div>
          <label htmlFor="post-files" className="block text-sm font-medium mb-1">
            {labels.attachments}
          </label>
          <input
            id="post-files"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
        </div>
      )}

      {!postId && (
        <fieldset className="border border-line rounded p-3 space-y-2">
          <div>
            <label htmlFor="poll-question" className="block text-sm font-medium mb-1">
              📊 {labels.pollQuestion}
            </label>
            <input
              id="poll-question"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              maxLength={300}
              className="w-full border border-line rounded px-3 py-2 bg-paper"
            />
          </div>
          {pollQuestion.trim() && (
            <div>
              <label htmlFor="poll-options" className="block text-sm font-medium mb-1">
                {labels.pollOptions}
              </label>
              <textarea
                id="poll-options"
                value={pollOptionsRaw}
                onChange={(e) => setPollOptionsRaw(e.target.value)}
                rows={4}
                aria-describedby="poll-options-hint"
                className="w-full border border-line rounded px-3 py-2 bg-paper text-sm"
              />
              <p id="poll-options-hint" className="text-xs text-ink-faint mt-1">
                {labels.pollHint}
              </p>
            </div>
          )}
        </fieldset>
      )}

      <div>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !title.trim() || !bodyHtml}
          className="bg-ink text-paper rounded px-5 py-2.5 font-medium hover:bg-accent transition-colors disabled:opacity-40"
        >
          {pending ? "…" : labels.submit}
        </button>
        {error && (
          <p role="alert" className="text-sm text-accent mt-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
