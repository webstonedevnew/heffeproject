import Link from "next/link";
import { getT } from "@/lib/i18n";
import { formatDateTime, timeAgo } from "@/lib/format";
import { statusLine, statusComplete } from "@/lib/status";
import type { StudentParticipation } from "@/lib/participation";
import type { Locale } from "@/types/db";

export interface PostCardProps {
  id: string;
  title: string;
  excerpt: string;
  groupName: string;
  authorName: string;
  createdAt: string;
  dueAtResponse: string | null;
  dueAtReplies: string | null;
  hidden: boolean;
  pinned: boolean;
  responseCount: number;
  locale: Locale;
  /** Student's own participation (null for the teacher / non-assignment). */
  myStatus: StudentParticipation | null;
  /** Teacher-side summary, e.g. "12/20 students complete". */
  teacherSummary?: string | null;
  /** Year-group label shown to the teacher (e.g. "Grade 11"); null hides it. */
  cohortLabel?: string | null;
}

export function PostCard(props: PostCardProps) {
  const t = getT(props.locale);
  const hasDeadlines = props.dueAtResponse || props.dueAtReplies;

  return (
    <article className="lift relative bg-card border border-line rounded-lg p-4 sm:p-5 hover:border-ink-faint">
      <div className="flex items-center gap-2 text-xs text-ink-faint uppercase tracking-wide">
        <span>{props.groupName}</span>
        {props.cohortLabel && (
          <span className="normal-case rounded-full bg-paper-deep text-ink-soft px-2 py-0.5">
            {props.cohortLabel}
          </span>
        )}
        {props.pinned && <span aria-label="pinned">📌</span>}
        {props.hidden && (
          <span className="text-warn normal-case">({t("post.hiddenTag")})</span>
        )}
      </div>
      <h3 className="font-display text-lg mt-1 leading-snug">
        <Link
          href={`/posts/${props.id}`}
          className="hover:text-accent after:absolute after:inset-0 after:content-['']"
        >
          {props.title}
        </Link>
      </h3>
      {props.excerpt && (
        <p className="text-sm text-ink-soft mt-1 line-clamp-2">{props.excerpt}</p>
      )}

      {hasDeadlines && (
        <dl className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-ink-soft">
          {props.dueAtResponse && (
            <div>
              <dt className="sr-only">{t("post.dueResponseLabel")}</dt>
              <dd>
                ✍️ {t("post.ownResponseDue", { date: formatDateTime(props.dueAtResponse, props.locale) })}
              </dd>
            </div>
          )}
          {props.dueAtReplies && (
            <div>
              <dt className="sr-only">{t("post.dueRepliesLabel")}</dt>
              <dd>
                💬 {t("post.peerRepliesDue", { count: 2, date: formatDateTime(props.dueAtReplies, props.locale) })}
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-line/60 text-xs text-ink-faint">
        <span>
          {props.authorName} · {timeAgo(props.createdAt, props.locale)} ·{" "}
          {t("post.responses", { count: props.responseCount })}
        </span>
        {props.myStatus && (
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${
              statusComplete(props.myStatus)
                ? "bg-sage-soft text-sage"
                : "bg-warn-soft text-warn"
            }`}
          >
            {statusLine(t, props.myStatus)}
          </span>
        )}
        {props.teacherSummary && (
          <span className="px-2 py-0.5 rounded-full bg-paper-deep text-ink-soft font-medium">
            {props.teacherSummary}
          </span>
        )}
      </div>
    </article>
  );
}
