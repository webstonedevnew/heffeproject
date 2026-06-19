"use client";

import { useState, useTransition } from "react";
import { Editor } from "@/components/Editor";
import { Spinner } from "@/components/Spinner";
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
  dateLabel: string;
  timeLabel: string;
  dueHint: string;
  attachments: string;
  submit: string;
  error: string;
  uploadImage: string;
  pollQuestion: string;
  pollOptions: string;
  pollHint: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Split an ISO timestamp into separate <input type=date> + <input type=time>
 *  values. Two native inputs work on Safari where datetime-local doesn't. */
function isoToParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Combine a date + time back into an ISO string. Empty date = no deadline;
 *  a date with no time defaults to end-of-day so it's never "already due". */
function partsToIso(date: string, time: string): string | null {
  if (!date) return null;
  return new Date(`${date}T${time || "23:59"}`).toISOString();
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
  const initialResponse = isoToParts(initial?.dueAtResponse ?? null);
  const initialReplies = isoToParts(initial?.dueAtReplies ?? null);
  const [responseDate, setResponseDate] = useState(initialResponse.date);
  const [responseTime, setResponseTime] = useState(initialResponse.time);
  const [repliesDate, setRepliesDate] = useState(initialReplies.date);
  const [repliesTime, setRepliesTime] = useState(initialReplies.time);
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
            dueAtResponse: partsToIso(responseDate, responseTime),
            dueAtReplies: partsToIso(repliesDate, repliesTime),
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
            dueAtResponse: partsToIso(responseDate, responseTime),
            dueAtReplies: partsToIso(repliesDate, repliesTime),
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
          <label htmlFor="due-response-date" className="block text-sm font-medium mb-1">
            {labels.dueResponse}
          </label>
          <div className="flex gap-2">
            <input
              id="due-response-date"
              type="date"
              value={responseDate}
              onChange={(e) => setResponseDate(e.target.value)}
              aria-label={`${labels.dueResponse} — ${labels.dateLabel}`}
              className="flex-1 min-w-0 border border-line rounded px-3 py-2 bg-paper"
            />
            <input
              type="time"
              value={responseTime}
              onChange={(e) => setResponseTime(e.target.value)}
              aria-label={`${labels.dueResponse} — ${labels.timeLabel}`}
              className="w-28 border border-line rounded px-3 py-2 bg-paper"
            />
          </div>
        </div>
        <div>
          <label htmlFor="due-replies-date" className="block text-sm font-medium mb-1">
            {labels.dueReplies}
          </label>
          <div className="flex gap-2">
            <input
              id="due-replies-date"
              type="date"
              value={repliesDate}
              onChange={(e) => setRepliesDate(e.target.value)}
              aria-label={`${labels.dueReplies} — ${labels.dateLabel}`}
              className="flex-1 min-w-0 border border-line rounded px-3 py-2 bg-paper"
            />
            <input
              type="time"
              value={repliesTime}
              onChange={(e) => setRepliesTime(e.target.value)}
              aria-label={`${labels.dueReplies} — ${labels.timeLabel}`}
              className="w-28 border border-line rounded px-3 py-2 bg-paper"
            />
          </div>
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
          className="inline-flex items-center gap-1.5 bg-ink text-paper rounded px-5 py-2.5 font-medium hover:bg-accent transition-colors disabled:opacity-40"
        >
          {pending && <Spinner />}
          {labels.submit}
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
