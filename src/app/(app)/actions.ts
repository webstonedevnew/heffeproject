"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeRichText, htmlToText, excerpt } from "@/lib/sanitize";
import { notifyNewAssignment, notifyReply, notifyFlag } from "@/lib/notify";
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
  bodyHtml: string;
  dueAtResponse: string | null;
  dueAtReplies: string | null;
  attachments: AttachmentInput[];
}) {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  const bodyHtml = sanitizeRichText(input.bodyHtml);

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

  await notifyNewAssignment({
    post,
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
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const bodyHtml = sanitizeRichText(input.bodyHtml);
  const bodyText = htmlToText(bodyHtml);
  if (!bodyText && !input.audioPath) throw new Error("Empty comment");

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
