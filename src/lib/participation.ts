/**
 * Participation tracking — the heart of the product.
 *
 * Model: an assignment is a teacher post. A student's "own response" is a
 * top-level comment on that post. A "peer reply" is a nested comment whose
 * parent is a top-level response written by a *different* student.
 *
 * Rules:
 *  - Only the earliest top-level comment counts as the response.
 *  - Peer replies count per distinct classmate (replying twice to the same
 *    classmate counts once). Replies to the teacher's comments don't count.
 *  - Hidden/deleted content never counts.
 *  - "Late" is only flagged when the post has the corresponding deadline.
 *    Replies are complete at the moment the Nth distinct classmate was
 *    replied to; that moment decides late/on-time.
 */

export const REQUIRED_PEER_REPLIES = 2;

export interface ParticipationComment {
  id: string;
  parentCommentId: string | null;
  authorId: string;
  createdAt: string; // ISO timestamp
  hidden?: boolean;
}

export interface PostDeadlines {
  dueAtResponse: string | null;
  dueAtReplies: string | null;
}

export interface StudentParticipation {
  studentId: string;
  responded: boolean;
  respondedAt: string | null;
  responseLate: boolean;
  /** Distinct classmates this student has replied to. */
  classmatesRepliedTo: number;
  repliesRequired: number;
  repliesDone: boolean;
  repliesDoneAt: string | null;
  repliesLate: boolean;
}

export function computeParticipation(
  post: PostDeadlines,
  comments: ParticipationComment[],
  studentIds: string[],
  requiredReplies: number = REQUIRED_PEER_REPLIES
): Map<string, StudentParticipation> {
  const students = new Set(studentIds);
  const visible = comments.filter((c) => !c.hidden);

  // Author of every top-level comment (needed to attribute replies).
  const topLevelAuthor = new Map<string, string>();
  for (const c of visible) {
    if (c.parentCommentId === null) topLevelAuthor.set(c.id, c.authorId);
  }

  // Earliest top-level comment per student = their response.
  const responseAt = new Map<string, string>();
  for (const c of visible) {
    if (c.parentCommentId !== null || !students.has(c.authorId)) continue;
    const prev = responseAt.get(c.authorId);
    if (!prev || c.createdAt < prev) responseAt.set(c.authorId, c.createdAt);
  }

  // Earliest qualifying reply per (student -> classmate).
  const repliesByStudent = new Map<string, Map<string, string>>();
  for (const c of visible) {
    if (c.parentCommentId === null || !students.has(c.authorId)) continue;
    const parentAuthor = topLevelAuthor.get(c.parentCommentId);
    if (!parentAuthor) continue; // parent hidden or missing
    if (parentAuthor === c.authorId) continue; // replying to yourself
    if (!students.has(parentAuthor)) continue; // replying to the teacher
    let perClassmate = repliesByStudent.get(c.authorId);
    if (!perClassmate) {
      perClassmate = new Map();
      repliesByStudent.set(c.authorId, perClassmate);
    }
    const prev = perClassmate.get(parentAuthor);
    if (!prev || c.createdAt < prev) perClassmate.set(parentAuthor, c.createdAt);
  }

  const result = new Map<string, StudentParticipation>();
  for (const studentId of studentIds) {
    const respondedAt = responseAt.get(studentId) ?? null;
    const perClassmate = repliesByStudent.get(studentId);
    const firstReplyTimes = perClassmate
      ? [...perClassmate.values()].sort()
      : [];
    const repliesDone = firstReplyTimes.length >= requiredReplies;
    const repliesDoneAt = repliesDone
      ? firstReplyTimes[requiredReplies - 1]
      : null;

    result.set(studentId, {
      studentId,
      responded: respondedAt !== null,
      respondedAt,
      responseLate:
        respondedAt !== null &&
        post.dueAtResponse !== null &&
        respondedAt > post.dueAtResponse,
      classmatesRepliedTo: firstReplyTimes.length,
      repliesRequired: requiredReplies,
      repliesDone,
      repliesDoneAt,
      repliesLate:
        repliesDoneAt !== null &&
        post.dueAtReplies !== null &&
        repliesDoneAt > post.dueAtReplies,
    });
  }
  return result;
}

/** Compact status line a student sees about themselves. */
export function studentStatusSummary(p: StudentParticipation): {
  posted: boolean;
  postedLate: boolean;
  repliesDone: number;
  repliesRequired: number;
} {
  return {
    posted: p.responded,
    postedLate: p.responseLate,
    repliesDone: Math.min(p.classmatesRepliedTo, p.repliesRequired),
    repliesRequired: p.repliesRequired,
  };
}
