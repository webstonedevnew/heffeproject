import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { loadParticipation } from "@/lib/participation-data";
import { getCohorts } from "@/lib/cohorts-data";
import { cohortName } from "@/lib/cohorts";
import { statusComplete } from "@/lib/status";
import { Avatar } from "@/components/Avatar";

export const metadata = { title: "Dashboard" };

interface Agg {
  applicable: number;
  complete: number;
}

export default async function TeacherDashboardPage() {
  const profile = await requireTeacher();
  const t = getT(profile.locale);
  const locale = profile.locale;
  const supabase = await createClient();
  const allGrades = t("cohorts.allGrades");

  const [
    { data: studentRows },
    { data: postRows },
    { count: openFlags },
    { data: activityRows },
    cohorts,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, cohort_id, status, avatar_path")
      .eq("role", "student")
      .order("name"),
    supabase
      .from("posts")
      .select("id, title, due_at_response, due_at_replies, cohort_id")
      .is("hidden_at", null),
    supabase
      .from("flags")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null),
    supabase
      .from("comments")
      .select(
        "id, post_id, parent_comment_id, created_at, author:profiles!comments_author_id_fkey(name, avatar_path), post:posts(title)"
      )
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
    getCohorts(supabase),
  ]);

  const students = (studentRows ?? []) as {
    id: string;
    name: string;
    cohort_id: string | null;
    status: "active" | "deactivated";
    avatar_path: string | null;
  }[];
  const activeStudents = students.filter((s) => s.status === "active");
  const posts = (postRows ?? []) as {
    id: string;
    title: string;
    due_at_response: string | null;
    due_at_replies: string | null;
    cohort_id: string | null;
  }[];
  const deadlinePosts = posts.filter((p) => p.due_at_response || p.due_at_replies);

  // Per-student completion across every deadline assignment in their cohort.
  const { rosterByPost, byPost } = await loadParticipation(supabase, deadlinePosts);
  const perStudent = new Map<string, Agg>();
  let totalApplicable = 0;
  let totalComplete = 0;
  for (const post of deadlinePosts) {
    const roster = rosterByPost.get(post.id) ?? [];
    const participation = byPost.get(post.id);
    if (!participation) continue;
    for (const s of roster) {
      const st = participation.get(s.id);
      const agg = perStudent.get(s.id) ?? { applicable: 0, complete: 0 };
      agg.applicable += 1;
      totalApplicable += 1;
      if (st && statusComplete(st)) {
        agg.complete += 1;
        totalComplete += 1;
      }
      perStudent.set(s.id, agg);
    }
  }
  const avgPct =
    totalApplicable > 0 ? Math.round((totalComplete / totalApplicable) * 100) : null;

  const pctFor = (id: string): number | null => {
    const a = perStudent.get(id);
    return a && a.applicable > 0 ? Math.round((a.complete / a.applicable) * 100) : null;
  };

  // "Falling behind" = active students under half-done, lowest first.
  const fallingBehind = activeStudents
    .map((s) => ({ s, pct: pctFor(s.id) }))
    .filter((x) => x.pct !== null && (x.pct as number) < 50)
    .sort((a, b) => (a.pct as number) - (b.pct as number))
    .slice(0, 6);

  const byCohort = cohorts.map((c) => ({
    name: c.name,
    count: activeStudents.filter((s) => s.cohort_id === c.id).length,
  }));

  const activity = (activityRows ?? []) as unknown as {
    id: string;
    post_id: string;
    parent_comment_id: string | null;
    created_at: string;
    author: { name: string; avatar_path: string | null } | null;
    post: { title: string } | null;
  }[];

  const cards: {
    label: string;
    value: string;
    sub?: string;
    href: string;
    warn?: boolean;
  }[] = [
    {
      label: t("dashboard.students"),
      value: String(activeStudents.length),
      sub: byCohort.map((c) => `${c.name}: ${c.count}`).join(" · ") || undefined,
      href: "/teacher/students",
    },
    {
      label: t("dashboard.assignments"),
      value: String(posts.length),
      sub: t("dashboard.withDeadlines", { count: deadlinePosts.length }),
      href: "/teacher/participation",
    },
    {
      label: t("dashboard.avgCompletion"),
      value: avgPct === null ? "—" : `${avgPct}%`,
      sub:
        avgPct === null
          ? undefined
          : t("dashboard.completedRatio", { done: totalComplete, total: totalApplicable }),
      href: "/teacher/participation",
    },
    {
      label: t("dashboard.openFlags"),
      value: String(openFlags ?? 0),
      href: "/teacher/flags",
      warn: (openFlags ?? 0) > 0,
    },
  ];

  const action =
    "rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors";

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h1 className="font-display text-2xl">{t("dashboard.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/teacher/new-post" className={`${action} bg-ink text-paper hover:bg-accent`}>
            + {t("nav.newPost")}
          </Link>
          <Link href="/teacher/students" className={`${action} border border-line hover:bg-paper-deep`}>
            {t("dashboard.manageStudentsLink")}
          </Link>
          <Link href="/teacher/participation" className={`${action} border border-line hover:bg-paper-deep`}>
            {t("dashboard.openParticipation")}
          </Link>
          <Link href="/teacher/flags" className={`${action} border border-line hover:bg-paper-deep`}>
            {t("dashboard.openFlagsLink")}
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="lift block bg-card border border-line rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-ink-faint">{c.label}</p>
            <p className={`font-display text-3xl mt-1 ${c.warn ? "text-warn" : "text-ink"}`}>
              {c.value}
            </p>
            {c.sub && <p className="text-xs text-ink-soft mt-1 leading-snug">{c.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* Needs attention */}
        <section className="bg-card border border-line rounded-lg p-4">
          <h2 className="font-display text-lg mb-3">{t("dashboard.needsAttention")}</h2>
          {(openFlags ?? 0) > 0 && (
            <Link
              href="/teacher/flags"
              className="flex items-center gap-2 text-sm bg-warn-soft text-warn rounded px-3 py-2 mb-3 hover:opacity-90"
            >
              🚩 {t("dashboard.reviewFlags", { count: openFlags ?? 0 })}
            </Link>
          )}
          {fallingBehind.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("dashboard.allGood")}</p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">
                {t("dashboard.fallingBehind")}
              </p>
              <ul className="space-y-1.5">
                {fallingBehind.map(({ s, pct }) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <Avatar name={s.name} path={s.avatar_path} size={24} />
                    <span className="font-medium">{s.name}</span>
                    <span className="text-ink-faint text-xs">
                      {cohortName(cohorts, s.cohort_id, allGrades)}
                    </span>
                    <span className="ml-auto text-xs font-medium text-accent tabular-nums">
                      {pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Recent activity */}
        <section className="bg-card border border-line rounded-lg p-4">
          <h2 className="font-display text-lg mb-3">{t("home.recentActivity")}</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("dashboard.noActivity")}</p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={a.author?.name ?? "—"} path={a.author?.avatar_path} size={24} />
                  <Link
                    href={`/posts/${a.post_id}#comment-${a.id}`}
                    className="min-w-0 flex-1 hover:text-accent"
                  >
                    <span className="font-medium">{a.author?.name ?? "—"}</span>{" "}
                    <span className="text-ink-soft">
                      {t("dashboard.activityOn", { title: a.post?.title ?? "" })}
                    </span>
                  </Link>
                  <time
                    dateTime={a.created_at}
                    className="text-xs text-ink-faint whitespace-nowrap shrink-0"
                  >
                    {timeAgo(a.created_at, locale)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Student roster */}
      <section className="mt-4">
        <h2 className="font-display text-xl mb-3">{t("dashboard.roster")}</h2>
        {activeStudents.length === 0 ? (
          <p className="text-ink-soft bg-card border border-line rounded-lg p-6 text-center">
            {t("dashboard.noStudents")}
          </p>
        ) : (
          <div className="bg-card border border-line rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-faint border-b border-line">
                    <th scope="col" className="px-4 py-2 font-medium">{t("participation.student")}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t("dashboard.grade")}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t("dashboard.status")}</th>
                    <th scope="col" className="px-4 py-2 font-medium w-2/5">{t("dashboard.completion")}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const agg = perStudent.get(s.id);
                    const pct =
                      agg && agg.applicable > 0
                        ? Math.round((agg.complete / agg.applicable) * 100)
                        : null;
                    const deactivated = s.status !== "active";
                    return (
                      <tr
                        key={s.id}
                        className={`border-b border-line/60 last:border-0 ${deactivated ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <Avatar name={s.name} path={s.avatar_path} size={26} />
                            {s.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">
                          {cohortName(cohorts, s.cohort_id, allGrades)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 ${
                              deactivated ? "bg-warn-soft text-warn" : "bg-sage-soft text-sage"
                            }`}
                          >
                            {deactivated ? t("students.statusDeactivated") : t("students.statusActive")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {pct === null ? (
                            <span className="text-ink-faint">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-paper-deep overflow-hidden min-w-16">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 67 ? "bg-sage" : pct >= 34 ? "bg-gold" : "bg-accent"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-ink-soft whitespace-nowrap tabular-nums">
                                {agg!.complete}/{agg!.applicable}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="text-xs text-ink-faint mt-2">{t("dashboard.completionNote")}</p>
      </section>
    </div>
  );
}
