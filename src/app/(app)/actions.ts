"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeRichText, htmlToText, excerpt } from "@/lib/sanitize";
import { notifyNewAssignment, notifyReply, notifyFlag } from "@/lib/notify";
import { getCohorts, normalizeCohortId } from "@/lib/cohorts-data";
import type { Comment, Post } from "@/types/db";

export interface AttachmentInput {
  path: string;
  filename: string;
  size: number;
  mime: string;
}

// ---------------------------------------------------------------------------
// Posts (teacher only — RLS enforces it too)
// ---------------------------------------------------------------------------

export async function createPost(input: {
  title: string;
  groupId: string;
  cohortId: string | null;
  bodyHtml: string;
  dueAtResponse: string | null;
  dueAtReplies: string | null;
  attachments: AttachmentInput[];
  poll?: { question: string; options: string[] } | null;
}) {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  const bodyHtml = sanitizeRichText(input.bodyHtml);

  // Resolve the target year group (null = shared with every cohort).
  const cohorts = await getCohorts(supabase);
  const cohortId = normalizeCohortId(cohorts, input.cohortId);

  const { data: group } = await supabase
    .from("groups")
    .select("id, slug, name")
    .eq("id", input.groupId)
    .single();
  if (!group) throw new Error("Group not found");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      group_id: group.id,
      author_id: teacher.id,
      cohort_id: cohortId,
      title,
      body_html: bodyHtml,
      body_text: htmlToText(bodyHtml),
      due_at_response: input.dueAtResponse,
      due_at_replies: input.dueAtReplies,
    })
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);

  if (input.attachments.length > 0) {
    await supabase.from("attachments").insert(
      input.attachments.map((a) => ({
        post_id: post.id,
        uploader_id: teacher.id,
        storage_path: a.path,
        filename: a.filename,
        size_bytes: a.size,
        mime_type: a.mime,
      }))
    );
  }

  if (input.poll && input.poll.question.trim() && input.poll.options.length >= 2) {
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({ post_id: post.id, question: input.poll.question.trim() })
      .select("id")
      .single();
    if (!pollError && poll) {
      await supabase.from("poll_options").insert(
        input.poll.options.map((label, i) => ({
          poll_id: poll.id,
          label,
          position: i,
        }))
      );
    }
  }

  await notifyNewAssignment({
    post,
    cohortId,
    groupSlug: group.slug,
    groupName: group.name,
    teacherName: teacher.name,
  });

  revalidatePath("/");
  revalidatePath(`/groups/${group.slug}`);
  redirect(`/posts/${post.id}`);
}

export async function updatePost(input: {
  postId: string;
  title: string;
  bodyHtml: string;
  dueAtResponse: string | null;
  dueAtReplies: string | null;
}) {
  await requireTeacher();
  const supabase = await createClient();
  const bodyHtml = sanitizeRichText(input.bodyHtml);
  const { error } = await supabase
    .from("posts")
    .update({
      title: input.title.trim(),
      body_html: bodyHtml,
      body_text: htmlToText(bodyHtml),
      due_at_response: input.dueAtResponse,
      due_at_replies: input.dueAtReplies,
    })
    .eq("id", input.postId);
  if (error) throw new Error(error.message);
  revalidatePath(`/posts/${input.postId}`);
  redirect(`/posts/${input.postId}`);
}

export async function setPostHidden(postId: string, hidden: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  await supabase
    .from("posts")
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq("id", postId);
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/");
}

export async function deletePost(postId: string) {
  await requireTeacher();
  const supabase = await createClient();
  await supabase.from("posts").delete().eq("id", postId);
  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Comments (responses + peer replies)
// ---------------------------------------------------------------------------

export async function createComment(input: {
  postId: string;
  parentCommentId: string | null;
  bodyHtml: string;
  audioPath: string | null;
  attachments?: AttachmentInput[];
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const bodyHtml = sanitizeRichText(input.bodyHtml);
  const bodyText = htmlToText(bodyHtml);
  const attachments = input.attachments ?? [];
  if (!bodyText && !input.audioPath && attachments.length === 0) {
    throw new Error("Empty comment");
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      post_id: input.postId,
      parent_comment_id: input.parentCommentId,
      author_id: profile.id,
      body_html: bodyHtml,
      body_text: bodyText,
      audio_path: input.audioPath,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Pictures (and any other files) attached to this response/reply.
  if (attachments.length > 0) {
    const { error: attachError } = await supabase.from("attachments").insert(
      attachments.map((a) => ({
        comment_id: comment.id,
        uploader_id: profile.id,
        storage_path: a.path,
        filename: a.filename,
        size_bytes: a.size,
        mime_type: a.mime,
      }))
    );
    if (attachError) throw new Error(attachError.message);
  }

  // Notify the author of the parent comment (someone replied to you).
  if (input.parentCommentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", input.parentCommentId)
      .single();
    const { data: post } = await supabase
      .from("posts")
      .select("id, title")
      .eq("id", input.postId)
      .single();
    if (parent && post && parent.author_id !== profile.id) {
      await notifyReply({
        recipientId: parent.author_id,
        actorName: profile.name,
        post,
        commentId: comment.id,
        excerpt: excerpt(bodyHtml),
      });
    }
  }

  revalidatePath(`/posts/${input.postId}`);
}

export async function updateComment(input: {
  commentId: string;
  bodyHtml: string;
}) {
  await requireProfile();
  const supabase = await createClient();
  const bodyHtml = sanitizeRichText(input.bodyHtml);
  // RLS allows: own comment within 30 minutes, or teacher.
  const { data, error } = await supabase
    .from("comments")
    .update({ body_html: bodyHtml, body_text: htmlToText(bodyHtml) })
    .eq("id", input.commentId)
    .select("post_id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Not allowed");
  revalidatePath(`/posts/${(data as Comment).post_id}`);
}

export async function deleteComment(commentId: string, postId: string) {
  await requireProfile();
  const supabase = await createClient();
  // RLS allows: own comment within 30 minutes, or teacher.
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/posts/${postId}`);
}

export async function setCommentHidden(
  commentId: string,
  postId: string,
  hidden: boolean
) {
  await requireTeacher();
  // hidden_at is not updatable through the authenticated role (column
  // grants) — moderation goes through the service role after the role check.
  const admin = createAdminClient();
  await admin
    .from("comments")
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq("id", commentId);
  revalidatePath(`/posts/${postId}`);
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export async function toggleReaction(input: {
  postId?: string;
  commentId?: string;
  emoji: string;
  pathToRevalidate: string;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("reactions")
    .select("id")
    .eq("user_id", profile.id)
    .eq("emoji", input.emoji);
  query = input.postId
    ? query.eq("post_id", input.postId)
    : query.eq("comment_id", input.commentId!);
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("reactions").insert({
      user_id: profile.id,
      post_id: input.postId ?? null,
      comment_id: input.commentId ?? null,
      emoji: input.emoji,
    });
  }
  revalidatePath(input.pathToRevalidate);
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

export async function flagContent(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const postId = (formData.get("postId") as string) || null;
  const commentId = (formData.get("commentId") as string) || null;
  const reason = String(formData.get("reason") ?? "").slice(0, 500);
  const pagePostId = String(formData.get("pagePostId") ?? "");

  // One open flag per user per target — repeated clicks are no-ops, so the
  // teacher gets a single flag instead of a hundred.
  let dupQuery = supabase
    .from("flags")
    .select("id")
    .eq("flagged_by", profile.id)
    .is("resolved_at", null);
  dupQuery = postId
    ? dupQuery.eq("post_id", postId)
    : dupQuery.eq("comment_id", commentId!);
  const { data: existing } = await dupQuery.limit(1);
  if (existing && existing.length > 0) return;

  const { error } = await supabase.from("flags").insert({
    post_id: postId,
    comment_id: commentId,
    flagged_by: profile.id,
    reason,
  });
  if (error) throw new Error(error.message);

  const { data: post } = await supabase
    .from("posts")
    .select("id, title")
    .eq("id", pagePostId || postId!)
    .single();
  if (post) {
    await notifyFlag({
      actorName: profile.name,
      post: post as Pick<Post, "id" | "title">,
      commentId: commentId ?? undefined,
    });
  }
  revalidatePath(`/posts/${pagePostId || postId}`);
}

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

export async function votePoll(input: {
  pollId: string;
  optionId: string;
  postId: string;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Verify the option belongs to the poll (also enforced by a DB trigger).
  const { data: option } = await supabase
    .from("poll_options")
    .select("id")
    .eq("id", input.optionId)
    .eq("poll_id", input.pollId)
    .single();
  if (!option) throw new Error("Invalid option");

  // Single choice, changeable: replace any previous vote.
  await supabase
    .from("poll_votes")
    .delete()
    .eq("poll_id", input.pollId)
    .eq("user_id", profile.id);
  const { error } = await supabase.from("poll_votes").insert({
    poll_id: input.pollId,
    option_id: input.optionId,
    user_id: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/posts/${input.postId}`);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markAllNotificationsRead() {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);
  revalidatePath("/notifications");
}
