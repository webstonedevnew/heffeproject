import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadParticipation } from "@/lib/participation-data";
import { sendReminder } from "@/lib/notify";
import type { Profile } from "@/types/db";

export const maxDuration = 60;

/**
 * Deadline reminders — call this every hour (Vercel cron, GitHub Action,
 * pg_cron + http, anything). Sends each student a reminder ~24h before a
 * deadline they haven't completed. Each post+kind is processed exactly once
 * (reminders_sent table), so the schedule frequency doesn't cause duplicates.
 *
 *   GET /api/cron/reminders
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 3600_000).toISOString();
  const nowIso = now.toISOString();

  const { data: sentRows } = await admin.from("reminders_sent").select("post_id, kind");
  const alreadySent = new Set((sentRows ?? []).map((r) => `${r.post_id}:${r.kind}`));

  const { data: postRows } = await admin
    .from("posts")
    .select("id, title, due_at_response, due_at_replies")
    .is("hidden_at", null)
    .or(
      `and(due_at_response.gte.${nowIso},due_at_response.lte.${windowEnd}),and(due_at_replies.gte.${nowIso},due_at_replies.lte.${windowEnd})`
    );
  const posts = postRows ?? [];
  if (posts.length === 0) {
    return NextResponse.json({ processed: 0, remindersSent: 0 });
  }

  const { students, byPost } = await loadParticipation(admin, posts);
  const { data: profileRows } = await admin
    .from("profiles")
    .select("*")
    .in("id", students.map((s) => s.id));
  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p as Profile]));

  let remindersSent = 0;
  let processed = 0;

  for (const post of posts) {
    const participation = byPost.get(post.id);
    if (!participation) continue;

    const dueWithin = (iso: string | null) =>
      iso !== null && iso >= nowIso && iso <= windowEnd;

    const work: { kind: "response" | "replies"; dueAt: string }[] = [];
    if (dueWithin(post.due_at_response) && !alreadySent.has(`${post.id}:response`)) {
      work.push({ kind: "response", dueAt: post.due_at_response! });
    }
    if (dueWithin(post.due_at_replies) && !alreadySent.has(`${post.id}:replies`)) {
      work.push({ kind: "replies", dueAt: post.due_at_replies! });
    }

    for (const { kind, dueAt } of work) {
      processed++;
      for (const student of students) {
        const p = participation.get(student.id);
        if (!p) continue;
        const incomplete = kind === "response" ? !p.responded : !p.repliesDone;
        if (!incomplete) continue;
        const profile = profileById.get(student.id);
        if (!profile || profile.status !== "active") continue;
        await sendReminder({
          student: profile,
          kind,
          post: { id: post.id, title: post.title },
          dueAt,
          repliesDone: p.classmatesRepliedTo,
        });
        remindersSent++;
      }
      await admin.from("reminders_sent").insert({ post_id: post.id, kind });
    }
  }

  return NextResponse.json({ processed, remindersSent });
}
