"use client";

import { useState, useTransition } from "react";
import { Editor } from "@/components/Editor";
import { AudioRecorder } from "@/components/AudioRecorder";
import { uploadToBucket } from "@/lib/upload-client";
import { createComment } from "@/app/(app)/actions";

export interface ComposerLabels {
  placeholder: string;
  submit: string;
  record: string;
  stop: string;
  discard: string;
  attached: string;
  micDenied: string;
  error: string;
}

export function CommentComposer({
  postId,
  parentCommentId = null,
  labels,
  allowAudio = true,
  compact = false,
}: {
  postId: string;
  parentCommentId?: string | null;
  labels: ComposerLabels;
  allowAudio?: boolean;
  compact?: boolean;
}) {
  const [html, setHtml] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!html && !audio) return;
    setError(null);
    startTransition(async () => {
      try {
        let audioPath: string | null = null;
        if (audio) {
          const ext = audio.type.includes("mp4") ? "m4a" : "webm";
          const { path } = await uploadToBucket("audio", audio, `reply.${ext}`);
          audioPath = path;
        }
        await createComment({ postId, parentCommentId, bodyHtml: html, audioPath });
        setHtml("");
        setAudio(null);
        setResetSignal((n) => n + 1);
      } catch (err) {
        console.error(err);
        setError(labels.error);
      }
    });
  };

  return (
    <div className={compact ? "mt-2" : "mt-4"}>
      <Editor placeholder={labels.placeholder} onChange={setHtml} resetSignal={resetSignal} />
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
        {allowAudio ? (
          <AudioRecorder
            labels={{
              record: labels.record,
              stop: labels.stop,
              discard: labels.discard,
              attached: labels.attached,
              micDenied: labels.micDenied,
            }}
            onChange={setAudio}
          />
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || (!html && !audio)}
          className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-40"
        >
          {pending ? "…" : labels.submit}
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
