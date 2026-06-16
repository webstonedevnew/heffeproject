"use client";

import { useEffect, useState, useTransition } from "react";
import { Editor } from "@/components/Editor";
import { AudioRecorder } from "@/components/AudioRecorder";
import { uploadToBucket } from "@/lib/upload-client";
import { createComment, type AttachmentInput } from "@/app/(app)/actions";

export interface ComposerLabels {
  placeholder: string;
  submit: string;
  record: string;
  stop: string;
  discard: string;
  attached: string;
  micDenied: string;
  addImages: string;
  removeImage: string;
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
  const [images, setImages] = useState<File[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Object URLs for the local previews; revoked when the selection changes.
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setImages((prev) => [...prev, ...picked]);
  };
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const hasContent = Boolean(html) || Boolean(audio) || images.length > 0;

  const submit = () => {
    if (!hasContent) return;
    setError(null);
    startTransition(async () => {
      try {
        let audioPath: string | null = null;
        if (audio) {
          const ext = audio.type.includes("mp4") ? "m4a" : "webm";
          const { path } = await uploadToBucket("audio", audio, `reply.${ext}`);
          audioPath = path;
        }
        const attachments: AttachmentInput[] = [];
        for (const file of images) {
          const { path, size, mime } = await uploadToBucket(
            "attachments",
            file,
            file.name
          );
          attachments.push({ path, filename: file.name, size, mime });
        }
        await createComment({
          postId,
          parentCommentId,
          bodyHtml: html,
          audioPath,
          attachments,
        });
        setHtml("");
        setAudio(null);
        setImages([]);
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

      {previews.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-2">
          {previews.map((src, i) => (
            <li key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={images[i]?.name ?? ""}
                className="h-20 w-20 object-cover rounded border border-line"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={labels.removeImage}
                className="absolute -top-2 -right-2 bg-ink text-paper rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center hover:bg-accent"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
        <div className="flex flex-wrap items-center gap-2">
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
          <label className="px-3 py-1.5 border border-line rounded-full hover:bg-paper-deep cursor-pointer text-sm">
            🖼 {labels.addImages}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addImages(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !hasContent}
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
