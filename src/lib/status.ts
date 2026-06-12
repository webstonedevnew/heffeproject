import type { Translator } from "@/lib/i18n";
import type { StudentParticipation } from "@/lib/participation";

/** "✓ posted · 1/2 replies done" — the student's own status line. */
export function statusLine(t: Translator, p: StudentParticipation): string {
  const posted = p.responded
    ? p.responseLate
      ? t("post.statusPostedLate")
      : t("post.statusPosted")
    : t("post.statusNotPosted");
  const replies = t("post.statusReplies", {
    done: Math.min(p.classmatesRepliedTo, p.repliesRequired),
    required: p.repliesRequired,
  });
  return `${posted} · ${replies}`;
}

export function statusComplete(p: StudentParticipation): boolean {
  return p.responded && p.repliesDone;
}
