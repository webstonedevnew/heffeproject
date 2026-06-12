import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadParticipation } from "@/lib/participation-data";
import { statusComplete } from "@/lib/status";
import { getT } from "@/lib/i18n";
import type { Profile } from "@/types/db";
import type { PostCardProps } from "@/components/PostCard";

export const PAGE_SIZE = 10;

/** Loads a page of posts and assembles everything PostCard needs. */
export async function fetchPostCards(
  supabase: SupabaseClient,
  profile: Profile,
  opts: { groupId?: string; page: number }
): Promise<{ cards: PostCardProps[]; hasMore: boolean }> {
  const from = (opts.page - 1) * PAGE_SIZE;
  let query = supabase
    .from("posts")
    .select(
      "id, title, body_text, due_at_response, due_at_replies, pinned, hidden_at, created_at, group:groups(name), author:profiles(name)"
    )
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE); // one extra row to detect "has more"
  if (opts.groupId) query = query.eq("group_id", opts.groupId);

  const { data } = await query;
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);

  const { students, byPost, commentsByPost } = await loadParticipation(
    supabase,
    pageRows.map((p) => ({
      id: p.id,
      due_at_response: p.due_at_response,
      due_at_replies: p.due_at_replies,
    }))
  );

  const t = getT(profile.locale);
  const cards: PostCardProps[] = pageRows.map((p) => {
    const participation = byPost.get(p.id);
    const myStatus =
      profile.role === "student" && (p.due_at_response || p.due_at_replies)
        ? participation?.get(profile.id) ?? null
        : null;

    let teacherSummary: string | null = null;
    if (
      profile.role === "teacher" &&
      participation &&
      (p.due_at_response || p.due_at_replies) &&
      students.length > 0
    ) {
      const done = students.filter((s) => {
        const st = participation.get(s.id);
        return st ? statusComplete(st) : false;
      }).length;
      teacherSummary = t("participation.complete", {
        done,
        total: students.length,
      });
    }

    const responseCount = (commentsByPost.get(p.id) ?? []).filter(
      (c) => c.parent_comment_id === null && c.hidden_at === null
    ).length;

    const group = p.group as unknown as { name: string } | null;
    const author = p.author as unknown as { name: string } | null;

    return {
      id: p.id,
      title: p.title,
      excerpt:
        p.body_text.length > 180 ? p.body_text.slice(0, 179) + "…" : p.body_text,
      groupName: group?.name ?? "",
      authorName: author?.name ?? "",
      createdAt: p.created_at,
      dueAtResponse: p.due_at_response,
      dueAtReplies: p.due_at_replies,
      hidden: p.hidden_at !== null,
      pinned: p.pinned,
      responseCount,
      locale: profile.locale,
      myStatus,
      teacherSummary,
    };
  });

  return { cards, hasMore };
}
