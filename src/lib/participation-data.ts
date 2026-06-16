import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeParticipation,
  type StudentParticipation,
} from "@/lib/participation";
import { studentsInCohort } from "@/lib/cohorts";

export interface StudentLite {
  id: string;
  name: string;
  cohortId: string | null;
}

export interface PostForParticipation {
  id: string;
  due_at_response: string | null;
  due_at_replies: string | null;
  /** Year group the post targets; null = shared with every cohort. */
  cohort_id: string | null;
}

export interface ParticipationData {
  /** Every active student. */
  students: StudentLite[];
  /** The students each post concerns (its cohort, or all for a shared post). */
  rosterByPost: Map<string, StudentLite[]>;
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
 * Participation for each post is scored against that post's cohort only, so a
 * grade-11 assignment is never judged against grade-12 students (or vice versa).
 * Works with both the session client (RLS) and the admin client (cron).
 */
export async function loadParticipation(
  supabase: SupabaseClient,
  posts: PostForParticipation[]
): Promise<ParticipationData> {
  const { data: studentRows } = await supabase
    .from("profiles")
    .select("id, name, cohort_id")
    .eq("role", "student")
    .eq("status", "active")
    .order("name");
  const students = ((studentRows ?? []) as {
    id: string;
    name: string;
    cohort_id: string | null;
  }[]).map((s) => ({ id: s.id, name: s.name, cohortId: s.cohort_id }));

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
  const rosterByPost = new Map<string, StudentLite[]>();
  for (const post of posts) {
    const roster = studentsInCohort(students, post.cohort_id);
    rosterByPost.set(post.id, roster);
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
        roster.map((s) => s.id)
      )
    );
  }

  return { students, rosterByPost, byPost, commentsByPost };
}
