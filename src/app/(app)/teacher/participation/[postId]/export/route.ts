import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { loadParticipation } from "@/lib/participation-data";
import { toCsv } from "@/lib/csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const profile = await getProfile();
  if (!profile || profile.role !== "teacher" || profile.status !== "active") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const t = getT(profile.locale);
  const supabase = await createClient();
  const { postId } = await params;

  const { data: post } = await supabase
    .from("posts")
    .select("id, title, due_at_response, due_at_replies, cohort_id")
    .eq("id", postId)
    .single();
  if (!post) return new NextResponse("Not found", { status: 404 });

  const { rosterByPost, byPost } = await loadParticipation(supabase, [post]);
  const roster = rosterByPost.get(post.id) ?? [];
  const participation = byPost.get(post.id)!;

  const yes = t("participation.yes");
  const no = t("participation.no");
  const rows: string[][] = [
    [
      t("participation.csvStudent"),
      t("participation.csvResponse"),
      t("participation.csvResponseAt"),
      t("participation.csvResponseLate"),
      t("participation.csvReplies"),
      t("participation.csvRepliesDone"),
      t("participation.csvRepliesLate"),
    ],
    ...roster.map((s) => {
      const p = participation.get(s.id)!;
      return [
        s.name,
        p.responded ? yes : no,
        p.respondedAt ?? "",
        p.responseLate ? yes : no,
        String(p.classmatesRepliedTo),
        p.repliesDone ? yes : no,
        p.repliesLate ? yes : no,
      ];
    }),
  ];

  const filename = `participation-${post.title.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 50)}.csv`;
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
