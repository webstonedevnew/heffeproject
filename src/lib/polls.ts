/** Pure poll tallying — unit-tested. */

export interface PollOptionLite {
  id: string;
  label: string;
}

export interface PollVoteLite {
  optionId: string;
  userId: string;
}

export interface PollResult {
  optionId: string;
  label: string;
  count: number;
  /** 0–100, rounded. */
  percent: number;
  mine: boolean;
}

export function tallyPoll(
  options: PollOptionLite[],
  votes: PollVoteLite[],
  currentUserId: string
): { results: PollResult[]; totalVotes: number; myOptionId: string | null } {
  const validOptionIds = new Set(options.map((o) => o.id));
  // One vote per user; last one in the list wins (DB enforces uniqueness).
  const voteByUser = new Map<string, string>();
  for (const v of votes) {
    if (validOptionIds.has(v.optionId)) voteByUser.set(v.userId, v.optionId);
  }

  const counts = new Map<string, number>();
  for (const optionId of voteByUser.values()) {
    counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
  }
  const totalVotes = voteByUser.size;
  const myOptionId = voteByUser.get(currentUserId) ?? null;

  const results = options.map((o) => {
    const count = counts.get(o.id) ?? 0;
    return {
      optionId: o.id,
      label: o.label,
      count,
      percent: totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100),
      mine: o.id === myOptionId,
    };
  });

  return { results, totalVotes, myOptionId };
}

/** Parse the "one option per line" textarea into clean option labels. */
export function parsePollOptions(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const label = line.trim().slice(0, 200);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out.slice(0, 10);
}
