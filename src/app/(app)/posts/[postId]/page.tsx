import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT, type Translator } from "@/lib/i18n";
import { formatDateTime, timeAgo } from "@/lib/format";
import { canModifyContent, type Actor } from "@/lib/permissions";
import { loadParticipation } from "@/lib/participation-data";
import { getCohorts } from "@/lib/cohorts-data";
import { cohortName } from "@/lib/cohorts";
import { statusLine, statusComplete } from "@/lib/status";
import { REQUIRED_PEER_REPLIES } from "@/lib/participation";
import { tallyPoll } from "@/lib/polls";
import { RichTextView } from "@/components/RichTextView";
import { PollSection } from "@/components/PollSection";
import { ReactionBar, type ReactionSummary } from "@/components/ReactionBar";
import { CommentComposer, type ComposerLabels } from "@/components/CommentComposer";
import { EditableBody } from "@/components/EditableBody";
import { ConfirmButton } from "@/components/ConfirmButton";
import { FlagForm } from "@/components/FlagForm";
import {
  deletePost,
  setPostHidden,
  deleteComment,
  setCommentHidden,
} from "@/app/(app)/actions";
import type { Attachment, Comment, Locale, Profile, Reaction } from "@/types/db";

type CommentWithAuthor = Comment & { author: { name: string; role: string } | null };

function summarizeReactions(
  rows: Reaction[],
  target: { postId?: string; commentId?: string },
  userId: string
): ReactionSummary[] {
  const relevant = rows.filter((r) =>
    target.postId ? r.post_id === target.postId : r.comment_id === target.commentId
  );
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of relevant) {
    const entry = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (r.user_id === userId) entry.mine = true;
    byEmoji.set(r.emoji, entry);
  }
  return [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, ...v }));
}

function isImage(att: Attachment): boolean {
  return (att.mime_type ?? "").startsWith("image/");
}

/** Pictures and files attached to a response/reply. */
function CommentAttachments({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter(isImage);
  const files = attachments.filter((a) => !isImage(a));
  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((a) => (
            <li key={a.id}>
              <a
                href={`/api/files/attachments/${a.storage_path}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/attachments/${a.storage_path}`}
                  alt={a.filename}
                  loading="lazy"
                  className="max-h-48 rounded border border-line object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((a) => (
            <li key={a.id}>
              📎{" "}
              <a
                href={`/api/files/attachments/${a.storage_path}`}
                className="underline text-accent"
                download={a.filename}
              >
                {a.filename}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentCard({
  comment,
  replies,
  profile,
  actor,
  t,
  locale,
  postId,
  reactions,
  attachmentsByComment,
  composerLabels,
  isTeacher,
}: {
  comment: CommentWithAuthor;
  replies: CommentWithAuthor[];
  profile: Profile;
  actor: Actor;
  t: Translator;
  locale: Locale;
  postId: string;
  reactions: Reaction[];
  attachmentsByComment: Map<string, Attachment[]>;
  composerLabels: ComposerLabels;
  isTeacher: boolean;
}) {
  const commentAttachments = attachmentsByComment.get(comment.id) ?? [];
  const isTopLevel = comment.parent_comment_id === null;
  const hidden = comment.hidden_at !== null;
  const canEdit = canModifyContent(actor, {
    authorId: comment.author_id,
    createdAt: comment.created_at,
  });
  const edited =
    new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() >
    60_000;

  return (
    <article
      id={`comment-${comment.id}`}
      className={`${isTopLevel ? "bg-card border border-line rounded-lg p-4" : "border-l-2 border-line pl-3 py-2"} ${
        hidden ? "opacity-70" : ""
      }`}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{comment.author?.name ?? "—"}</span>
        {comment.author?.role === "teacher" && (
          <span className="text-xs bg-accent text-paper rounded-full px-1.5 py-0.5">
            {t("common.teacherBadge")}
          </span>
        )}
        <time dateTime={comment.created_at} className="text-xs text-ink-faint">
          {timeAgo(comment.created_at, locale)}
        </time>
        {edited && <span className="text-xs text-ink-faint">({t("comments.edited")})</span>}
        {hidden && (
          <span className="text-xs text-warn">
            {comment.author_id === profile.id && !isTeacher
              ? t("comments.hiddenOwn")
              : t("comments.hiddenByTeacher")}
          </span>
        )}
      </header>

      <div className="mt-2 text-[15px]">
        <EditableBody
          commentId={comment.id}
          html={comment.body_html}
          canEdit={canEdit}
          labels={{
            edit: t("common.edit"),
            save: t("common.save"),
            cancel: t("common.cancel"),
            error: t("common.error"),
          }}
        />
        {comment.audio_path && (
          <div className="mt-2">
            <span className="text-xs text-ink-faint block mb-1">
              🎙 {t("comments.audioReply")}
            </span>
            <audio controls preload="none" src={`/api/files/audio/${comment.audio_path}`} className="max-w-full" />
          </div>
        )}
        {commentAttachments.length > 0 && (
          <CommentAttachments attachments={commentAttachments} />
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
        <ReactionBar
          commentId={comment.id}
          reactions={summarizeReactions(reactions, { commentId: comment.id }, profile.id)}
          pathToRevalidate={`/posts/${postId}`}
        />
        {canEdit && (
          <ConfirmButton
            action={deleteComment.bind(null, comment.id, postId)}
            confirmText={t("common.confirmDelete")}
          >
            {t("common.delete")}
          </ConfirmButton>
        )}
        {isTeacher && (
          <ConfirmButton
            action={setCommentHidden.bind(null, comment.id, postId, !hidden)}
            confirmText={(hidden ? t("common.unhide") : t("common.hide")) + "?"}
            className="text-xs text-ink-soft underline"
          >
            {hidden ? t("common.unhide") : t("common.hide")}
          </ConfirmButton>
        )}
        {comment.author_id !== profile.id && (
          <FlagForm
            commentId={comment.id}
            pagePostId={postId}
            labels={{
              flagAction: t("common.flagAction"),
              reason: t("flagsPage.reason"),
              submit: t("common.flagAction"),
              done: t("common.flagged"),
              error: t("common.error"),
            }}
          />
        )}
      </footer>

      {isTopLevel && (
        <div className="mt-3 space-y-1">
          {replies.length > 0 && (
            <p className="text-xs text-ink-faint uppercase tracking-wide">
              {t("comments.repliesHeading", { count: replies.length })}
            </p>
          )}
          {replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              replies={[]}
              profile={profile}
              actor={actor}
              t={t}
              locale={locale}
              postId={postId}
              reactions={reactions}
              attachmentsByComment={attachmentsByComment}
              composerLabels={composerLabels}
              isTeacher={isTeacher}
            />
          ))}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-accent select-none">
              ↳ {t("common.reply")}
            </summary>
            <CommentComposer
              postId={postId}
              parentCommentId={comment.id}
              labels={composerLabels}
              compact
            />
          </details>
        </div>
      )}
    </article>
  );
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const locale = profile.locale;
  const supabase = await createClient();
  const { postId } = await params;

  const { data: postRow } = await supabase
    .from("posts")
    .select("*, group:groups(slug, name), author:profiles!posts_author_id_fkey(name)")
    .eq("id", postId)
    .single();
  if (!postRow) notFound();
  const post = postRow as unknown as import("@/types/db").Post & {
    group: { slug: string; name: string } | null;
    author: { name: string } | null;
  };

  // Record the view (unique per user), then count.
  await supabase
    .from("post_views")
    .upsert(
      { post_id: postId, user_id: profile.id },
      { onConflict: "post_id,user_id", ignoreDuplicates: true }
    );
  const { count: viewCount } = await supabase
    .from("post_views")
    .select("user_id", { count: "exact", head: true })
    .eq("post_id", postId);

  const [{ data: commentRows }, { data: attachmentRows }] = await Promise.all([
    supabase
      .from("comments")
      .select("*, author:profiles!comments_author_id_fkey(name, role)")
      .eq("post_id", postId)
      .order("created_at"),
    supabase.from("attachments").select("*").eq("post_id", postId),
  ]);

  const comments = (commentRows ?? []) as CommentWithAuthor[];
  const attachments = (attachmentRows ?? []) as Attachment[];

  const commentIdList = comments.map((c) => c.id);
  const reactionFilter =
    commentIdList.length > 0
      ? `post_id.eq.${postId},comment_id.in.(${commentIdList.join(",")})`
      : `post_id.eq.${postId}`;
  const { data: reactionRows } = await supabase
    .from("reactions")
    .select("*")
    .or(reactionFilter);
  const reactions = (reactionRows ?? []) as Reaction[];

  // Attachments (pictures/files) on the responses & replies, grouped by comment.
  const attachmentsByComment = new Map<string, Attachment[]>();
  if (commentIdList.length > 0) {
    const { data: commentAttachmentRows } = await supabase
      .from("attachments")
      .select("*")
      .in("comment_id", commentIdList);
    for (const a of (commentAttachmentRows ?? []) as Attachment[]) {
      if (!a.comment_id) continue;
      const list = attachmentsByComment.get(a.comment_id) ?? [];
      list.push(a);
      attachmentsByComment.set(a.comment_id, list);
    }
  }

  const topLevel = comments.filter((c) => c.parent_comment_id === null);
  const repliesByParent = new Map<string, CommentWithAuthor[]>();
  for (const c of comments) {
    if (!c.parent_comment_id) continue;
    const list = repliesByParent.get(c.parent_comment_id) ?? [];
    list.push(c);
    repliesByParent.set(c.parent_comment_id, list);
  }

  const isTeacher = profile.role === "teacher";
  const actor: Actor = { id: profile.id, role: profile.role, status: profile.status };
  const hasDeadlines = post.due_at_response || post.due_at_replies;

  // Teacher sees which year group this assignment targets.
  let cohortLabel: string | null = null;
  if (isTeacher) {
    const cohorts = await getCohorts(supabase);
    cohortLabel = cohortName(cohorts, post.cohort_id, t("cohorts.allGrades"));
  }

  // Optional poll attached to this post.
  const { data: pollRow } = await supabase
    .from("polls")
    .select("id, question")
    .eq("post_id", postId)
    .maybeSingle();
  let poll: {
    id: string;
    question: string;
    tally: ReturnType<typeof tallyPoll>;
  } | null = null;
  if (pollRow) {
    const [{ data: optionRows }, { data: voteRows }] = await Promise.all([
      supabase
        .from("poll_options")
        .select("id, label")
        .eq("poll_id", pollRow.id)
        .order("position"),
      supabase
        .from("poll_votes")
        .select("option_id, user_id")
        .eq("poll_id", pollRow.id),
    ]);
    poll = {
      id: pollRow.id,
      question: pollRow.question,
      tally: tallyPoll(
        optionRows ?? [],
        (voteRows ?? []).map((v) => ({ optionId: v.option_id, userId: v.user_id })),
        profile.id
      ),
    };
  }

  let myStatus = null;
  if (profile.role === "student" && hasDeadlines) {
    const { byPost } = await loadParticipation(supabase, [
      {
        id: post.id,
        due_at_response: post.due_at_response,
        due_at_replies: post.due_at_replies,
        cohort_id: post.cohort_id,
      },
    ]);
    myStatus = byPost.get(post.id)?.get(profile.id) ?? null;
  }

  const composerLabels: ComposerLabels = {
    placeholder: t("post.responsePlaceholder"),
    submit: t("comments.submitReply"),
    record: t("comments.recordAudio"),
    stop: t("comments.stopRecording"),
    discard: t("comments.discardAudio"),
    attached: t("comments.audioAttached"),
    micDenied: t("comments.micDenied"),
    addImages: t("comments.addImages"),
    removeImage: t("comments.removeImage"),
    error: t("common.error"),
  };

  return (
    <div>
      <nav className="text-xs text-ink-faint mb-3">
        <Link href={`/groups/${post.group?.slug}`} className="underline hover:text-ink">
          {post.group?.name}
        </Link>
      </nav>

      <article className="animate-fade-in-up bg-card border border-line rounded-lg p-4 sm:p-6">
        <header>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {cohortLabel && (
              <span className="text-xs rounded-full bg-paper-deep text-ink-soft px-2 py-0.5">
                {cohortLabel}
              </span>
            )}
            {post.hidden_at && (
              <span className="text-xs text-warn">({t("post.hiddenTag")})</span>
            )}
          </div>
          <h1 className="font-display text-2xl leading-tight">{post.title}</h1>
          <p className="text-xs text-ink-faint mt-1">
            {post.author?.name} · {formatDateTime(post.created_at, locale)} ·{" "}
            {t("post.views", { count: viewCount ?? 0 })}
          </p>
        </header>

        {hasDeadlines && (
          <div className="mt-3 bg-paper-deep rounded p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">
              {t("post.deadlines")}
            </p>
            <ul className="space-y-0.5">
              {post.due_at_response && (
                <li>✍️ {t("post.ownResponseDue", { date: formatDateTime(post.due_at_response, locale) })}</li>
              )}
              {post.due_at_replies && (
                <li>
                  💬 {t("post.peerRepliesDue", {
                    count: REQUIRED_PEER_REPLIES,
                    date: formatDateTime(post.due_at_replies, locale),
                  })}
                </li>
              )}
            </ul>
          </div>
        )}

        {myStatus && (
          <p
            className={`mt-3 text-sm rounded px-3 py-2 font-medium ${
              statusComplete(myStatus) ? "bg-sage-soft text-sage" : "bg-warn-soft text-warn"
            }`}
          >
            {t("post.yourStatus")}: {statusLine(t, myStatus)}
          </p>
        )}

        <div className="mt-4">
          <RichTextView html={post.body_html} />
        </div>

        {poll && (
          <PollSection
            pollId={poll.id}
            postId={post.id}
            question={poll.question}
            results={poll.tally.results}
            totalVotes={poll.tally.totalVotes}
            myOptionId={poll.tally.myOptionId}
            isTeacher={isTeacher}
            labels={{
              heading: t("poll.heading"),
              vote: t("poll.vote"),
              changeVote: t("poll.changeVote"),
              totalVotes: t("poll.totalVotes", { count: poll.tally.totalVotes }),
              resultsHidden: t("poll.resultsHidden"),
              error: t("common.error"),
            }}
          />
        )}

        {attachments.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            <li className="text-xs uppercase tracking-wide text-ink-faint">
              {t("post.attachmentsLabel")}
            </li>
            {attachments.map((a) => (
              <li key={a.id}>
                📎{" "}
                <a
                  href={`/api/files/attachments/${a.storage_path}`}
                  className="underline text-accent"
                  download={a.filename}
                >
                  {a.filename}
                </a>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-line/60">
          <ReactionBar
            postId={post.id}
            reactions={summarizeReactions(reactions, { postId: post.id }, profile.id)}
            pathToRevalidate={`/posts/${post.id}`}
          />
          {isTeacher && (
            <span className="flex items-center gap-3 text-xs ml-auto">
              <Link href={`/posts/${post.id}/edit`} className="underline text-ink-soft">
                {t("common.edit")}
              </Link>
              <ConfirmButton
                action={setPostHidden.bind(null, post.id, post.hidden_at === null)}
                confirmText={(post.hidden_at ? t("common.unhide") : t("common.hide")) + "?"}
                className="underline text-ink-soft text-xs"
              >
                {post.hidden_at ? t("common.unhide") : t("common.hide")}
              </ConfirmButton>
              <ConfirmButton
                action={deletePost.bind(null, post.id)}
                confirmText={t("common.confirmDelete")}
              >
                {t("common.delete")}
              </ConfirmButton>
            </span>
          )}
          {!isTeacher && (
            <FlagForm
              postId={post.id}
              pagePostId={post.id}
              labels={{
                flagAction: t("common.flagAction"),
                reason: t("flagsPage.reason"),
                submit: t("common.flagAction"),
                done: t("common.flagged"),
                error: t("common.error"),
              }}
            />
          )}
        </footer>
      </article>

      <section className="mt-6">
        <h2 className="font-display text-xl mb-3">
          {t("comments.responsesHeading")}{" "}
          <span className="text-ink-faint text-base">({topLevel.length})</span>
        </h2>

        <div className="bg-card border border-line rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium">
            {myStatus?.responded
              ? t("post.alreadyResponded", { count: REQUIRED_PEER_REPLIES })
              : t("post.writeResponse")}
          </h3>
          <CommentComposer
            postId={post.id}
            labels={{ ...composerLabels, submit: t("post.submitResponse") }}
          />
          <p className="text-xs text-ink-faint mt-2">{t("comments.editWindowNote")}</p>
        </div>

        {topLevel.length === 0 ? (
          <p className="text-ink-soft text-sm">{t("comments.empty")}</p>
        ) : (
          <div className="space-y-3">
            {topLevel.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                replies={repliesByParent.get(c.id) ?? []}
                profile={profile}
                actor={actor}
                t={t}
                locale={locale}
                postId={post.id}
                reactions={reactions}
                attachmentsByComment={attachmentsByComment}
                composerLabels={composerLabels}
                isTeacher={isTeacher}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
