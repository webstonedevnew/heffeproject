"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { uploadToBucket } from "@/lib/upload-client";
import { updateAvatar, removeAvatar } from "@/app/(app)/settings/actions";

export interface AvatarUploaderLabels {
  heading: string;
  hint: string;
  change: string;
  remove: string;
  error: string;
}

export function AvatarUploader({
  name,
  initialPath,
  labels,
}: {
  name: string;
  initialPath: string | null;
  labels: AvatarUploaderLabels;
}) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    startTransition(async () => {
      try {
        const { path: newPath } = await uploadToBucket("attachments", file, file.name);
        await updateAvatar(newPath);
        setPath(newPath);
      } catch (err) {
        console.error(err);
        setError(labels.error);
      }
    });
  };

  const clear = () => {
    setError(null);
    startTransition(async () => {
      try {
        await removeAvatar();
        setPath(null);
      } catch (err) {
        console.error(err);
        setError(labels.error);
      }
    });
  };

  return (
    <div className="bg-card border border-line rounded-lg p-4">
      <h2 className="font-display text-lg mb-1">{labels.heading}</h2>
      <p className="text-xs text-ink-soft mb-3">{labels.hint}</p>
      <div className="flex items-center gap-4">
        <Avatar name={name} path={path} size={64} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="border border-ink rounded px-3 py-1.5 text-sm hover:bg-paper-deep cursor-pointer inline-flex items-center gap-1.5">
            {pending && <Spinner />}
            {labels.change}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={pending}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {path && (
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="text-sm underline text-ink-soft hover:text-ink disabled:opacity-40"
            >
              {labels.remove}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-accent mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
