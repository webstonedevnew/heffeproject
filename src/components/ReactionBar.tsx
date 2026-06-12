"use client";

import { useOptimistic, useTransition } from "react";
import { toggleReaction } from "@/app/(app)/actions";
import { REACTION_EMOJIS } from "@/types/db";

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

export function ReactionBar({
  postId,
  commentId,
  reactions,
  pathToRevalidate,
}: {
  postId?: string;
  commentId?: string;
  reactions: ReactionSummary[];
  pathToRevalidate: string;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    reactions,
    (state: ReactionSummary[], emoji: string) => {
      const found = state.find((r) => r.emoji === emoji);
      if (!found) return [...state, { emoji, count: 1, mine: true }];
      return state
        .map((r) =>
          r.emoji === emoji
            ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) }
            : r
        )
        .filter((r) => r.count > 0);
    }
  );

  const toggle = (emoji: string) => {
    startTransition(async () => {
      applyOptimistic(emoji);
      await toggleReaction({ postId, commentId, emoji, pathToRevalidate });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Reactions">
      {REACTION_EMOJIS.map((emoji) => {
        const r = optimistic.find((x) => x.emoji === emoji);
        const active = r?.mine ?? false;
        const count = r?.count ?? 0;
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={active}
            aria-label={`React ${emoji}`}
            onClick={() => toggle(emoji)}
            className={`px-2 py-0.5 rounded-full text-sm border transition-colors ${
              active
                ? "border-accent bg-accent-soft"
                : count > 0
                  ? "border-line bg-card hover:bg-paper-deep"
                  : "border-transparent opacity-50 hover:opacity-100 hover:bg-paper-deep"
            }`}
          >
            {emoji}
            {count > 0 && <span className="ml-1 text-xs text-ink-soft">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
