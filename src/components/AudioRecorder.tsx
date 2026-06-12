"use client";

import { useRef, useState, useEffect } from "react";

interface Labels {
  record: string;
  stop: string;
  discard: string;
  attached: string;
  micDenied: string;
}

export function AudioRecorder({
  labels,
  onChange,
}: {
  labels: Labels;
  onChange: (blob: Blob | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [url]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const result = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setBlob(result);
        setUrl(URL.createObjectURL(result));
        onChange(result);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError(labels.micDenied);
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const discard = () => {
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    onChange(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {!recording && !blob && (
        <button
          type="button"
          onClick={start}
          className="px-3 py-1.5 border border-line rounded-full hover:bg-paper-deep"
        >
          🎙 {labels.record}
        </button>
      )}
      {recording && (
        <button
          type="button"
          onClick={stop}
          className="px-3 py-1.5 rounded-full bg-accent text-paper animate-pulse"
        >
          ■ {labels.stop}
        </button>
      )}
      {blob && url && (
        <>
          <span className="text-sage">{labels.attached}</span>
          <audio controls src={url} className="h-8 max-w-full" />
          <button type="button" onClick={discard} className="underline text-ink-soft">
            {labels.discard}
          </button>
        </>
      )}
      {error && <p role="alert" className="text-accent">{error}</p>}
    </div>
  );
}
