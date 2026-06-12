import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeParticipation,
  type StudentParticipation,
} from "@/lib/participation";

export interface StudentLite {
  id: string;
  name: string;
}

export interface PostForParticipation {
  id: string;
  due_at_response: string | null;
  due_at_replies: string | null;
}

export interface ParticipationData {
  students: StudentLite[];
  byPost: Map<string, Map<string, StudentParticipation>>;
  /** Raw comment rows, reusable for counts. */
  commentsByPost: Map<
    string,
    { parent_comment_id: string | null; author_id: string; hidden_at: string | null }[]
  >;
}

/**
 * Loads everything needed to compute participation for a set of posts:
 * the active students and all (non-hidden) comments on those posts.
 * Works with both the session client (RLS) and the admin client (cron).
 */
export async function loadParticipation(
  supabase: SupabaseClient,
  posts: PostForParticipation[]
): Promise<ParticipationData> {
  const { data: studentRows } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "student")
    .eq("status", "active")
    .order("name");
  const students = (studentRows ?? []) as StudentLite[];
  const studentIds = students.map((s) => s.id);

  const postIds = posts.map((p) => p.id);
  const commentsByPost = new Map<
    string,
    { id: string; post_id: string; parent_comment_id: string | null; author_id: string; created_at: string; hidden_at: string | null }[]
  >();
  if (postIds.length > 0) {
    const { data: commentRows } = await supabase
      .from("comments")
      .select("id, post_id, parent_comment_id, author_id, created_at, hidden_at")
      .in("post_id", postIds);
    for (const c of commentRows ?? []) {
      const list = commentsByPost.get(c.post_id) ?? [];
      list.push(c);
      commentsByPost.set(c.post_id, list);
    }
  }

  const byPost = new Map<string, Map<string, StudentParticipation>>();
  for (const post of posts) {
    const comments = (commentsByPost.get(post.id) ?? []).map((c) => ({
      id: c.id,
      parentCommentId: c.parent_comment_id,
      authorId: c.author_id,
      createdAt: c.created_at,
      hidden: c.hidden_at !== null,
    }));
    byPost.set(
      post.id,
      computeParticipation(
        { dueAtResponse: post.due_at_response, dueAtReplies: post.due_at_replies },
        comments,
        studentIds
      )
    );
  }

  return { students, byPost, commentsByPost };
}
