"use client";

import { useState, useTransition } from "react";
import { votePoll } from "@/app/(app)/actions";
import type { PollResult } from "@/lib/polls";

export interface PollLabels {
  heading: string;
  vote: string;
  changeVote: string;
  totalVotes: string; // already interpolated server-side
  resultsHidden: string;
  error: string;
}

export function PollSection({
  pollId,
  postId,
  question,
  results,
  totalVotes,
  myOptionId,
  isTeacher,
  labels,
}: {
  pollId: string;
  postId: string;
  question: string;
  results: PollResult[];
  totalVotes: number;
  myOptionId: string | null;
  isTeacher: boolean;
  labels: PollLabels;
}) {
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<string | null>(myOptionId);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasVoted = myOptionId !== null;
  const showResults = (hasVoted || isTeacher) && !choosing;

  const submit = () => {
    if (!selected) return;
    setError(false);
    startTransition(async () => {
      try {
        await votePoll({ pollId, optionId: selected, postId });
        setChoosing(false);
      } catch (err) {
        console.error(err);
        setError(true);
      }
    });
  };

  return (
    <section
      aria-label={labels.heading}
      className="mt-4 border border-line rounded-lg p-4 bg-paper-deep/50"
    >
      <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">
        📊 {labels.heading}
      </p>
      <h2 className="font-display text-lg leading-snug mb-3">{question}</h2>

      {showResults ? (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.optionId}>
              <div className="flex justify-between text-sm mb-0.5">
                <span className={r.mine ? "font-semibold" : ""}>
                  {r.label}
                  {r.mine && " ✓"}
                </span>
                <span className="text-ink-faint text-xs">
                  {r.count} · {r.percent}%
                </span>
              </div>
              <div
                className="h-2 rounded-full bg-line/60 overflow-hidden"
                role="progressbar"
                aria-valuenow={r.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={r.label}
              >
                <div
                  className={`h-full rounded-full ${r.mine ? "bg-accent" : "bg-ink-faint"}`}
                  style={{ width: `${r.percent}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-ink-faint">{labels.totalVotes}</span>
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="text-xs underline text-ink-soft"
            >
              {hasVoted ? labels.changeVote : labels.vote}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <fieldset className="space-y-1.5">
            <legend className="sr-only">{question}</legend>
            {results.map((r) => (
              <label
                key={r.optionId}
                className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 hover:bg-paper-deep"
              >
                <input
                  type="radio"
                  name={`poll-${pollId}`}
                  value={r.optionId}
                  checked={selected === r.optionId}
                  onChange={() => setSelected(r.optionId)}
                  className="accent-[var(--color-accent)]"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !selected}
              className="bg-ink text-paper rounded px-4 py-1.5 text-sm disabled:opacity-40"
            >
              {pending ? "…" : labels.vote}
            </button>
            {!hasVoted && !isTeacher && (
              <span className="text-xs text-ink-faint">{labels.resultsHidden}</span>
            )}
          </div>
          {error && (
            <p role="alert" className="text-xs text-accent mt-1">
              {labels.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
