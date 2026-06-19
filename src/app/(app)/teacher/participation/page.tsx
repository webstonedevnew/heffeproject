import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { loadParticipation } from "@/lib/participation-data";
import { getCohorts } from "@/lib/cohorts-data";
import { cohortName } from "@/lib/cohorts";
import { statusComplete } from "@/lib/status";
import { REQUIRED_PEER_REPLIES } from "@/lib/participation";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";

export default async function ParticipationPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const profile = await requireTeacher();
  const t = getT(profile.locale);
  const locale = profile.locale;
  const supabase = await createClient();
  const { post: postParam } = await searchParams;

  const [{ data: postRows }, cohorts] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, due_at_response, due_at_replies, created_at, cohort_id, group:groups(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    getCohorts(supabase),
  ]);
  const posts = (postRows ?? []) as unknown as {
    id: string;
    title: string;
    due_at_response: string | null;
    due_at_replies: string | null;
    created_at: string;
    cohort_id: string | null;
    group: { name: string } | null;
  }[];
  const allGradesLabel = t("cohorts.allGrades");

  const selected = posts.find((p) => p.id === postParam) ?? posts[0] ?? null;

  let table: React.ReactNode = null;
  if (selected) {
    const { rosterByPost, byPost } = await loadParticipation(supabase, [selected]);
    const roster = rosterByPost.get(selected.id) ?? [];
    const participation = byPost.get(selected.id)!;
    const completeCount = roster.filter((s) =>
      statusComplete(participation.get(s.id)!)
    ).length;

    table = (
      <div className="bg-card border border-line rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-line">
          <div>
            <h2 className="font-display text-lg leading-snug">
              <Link href={`/posts/${selected.id}`} className="hover:text-accent">
                {selected.title}
              </Link>
            </h2>
            <p className="text-xs text-ink-faint mt-0.5">
              {selected.group?.name} ·{" "}
              {cohortName(cohorts, selected.cohort_id, allGradesLabel)} ·{" "}
              {selected.due_at_response
                ? t("post.ownResponseDue", {
                    date: formatDateTime(selected.due_at_response, locale),
                  })
                : t("participation.noDeadline")}
              {selected.due_at_replies &&
                " · " +
                  t("post.peerRepliesDue", {
                    count: REQUIRED_PEER_REPLIES,
                    date: formatDateTime(selected.due_at_replies, locale),
                  })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium px-2 py-1 rounded bg-paper-deep">
              {t("participation.complete", {
                done: completeCount,
                total: roster.length,
              })}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint border-b border-line">
                <th scope="col" className="px-4 py-2 font-medium">
                  {t("participation.student")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t("participation.ownResponse")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t("participation.peerReplies")}
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => {
                const p = participation.get(s.id)!;
                return (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{s.name}</td>
                    <td className="px-4 py-2.5">
                      {p.responded ? (
                        <span className={p.responseLate ? "text-warn" : "text-sage"}>
                          {p.responseLate
                            ? t("participation.postedLateAt", {
                                date: formatDateTime(p.respondedAt!, locale),
                              })
                            : t("participation.postedAt", {
                                date: formatDateTime(p.respondedAt!, locale),
                              })}
                        </span>
                      ) : (
                        <span className="text-accent">✗ {t("participation.notPosted")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          p.repliesDone
                            ? p.repliesLate
                              ? "text-warn"
                              : "text-sage"
                            : "text-accent"
                        }
                      >
                        {t("participation.repliesOf", {
                          done: p.classmatesRepliedTo,
                          required: p.repliesRequired,
                        })}{" "}
                        —{" "}
                        {p.repliesDone
                          ? p.repliesLate
                            ? t("participation.doneLate")
                            : t("participation.done")
                          : t("participation.missing")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/teacher/dashboard"
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink mb-3"
      >
        ← {t("nav.dashboard")}
      </Link>
      <h1 className="font-display text-2xl mb-1">{t("participation.title")}</h1>
      <p className="text-sm text-ink-soft mb-4">
        {t("participation.intro", { count: REQUIRED_PEER_REPLIES })}
      </p>

      {posts.length === 0 ? (
        <p className="text-ink-soft bg-card border border-line rounded-lg p-6 text-center">
          {t("participation.noAssignments")}
        </p>
      ) : (
        <>
          <form method="get" className="mb-4">
            <label htmlFor="post-select" className="sr-only">
              {t("participation.selectGroup")}
            </label>
            <AutoSubmitSelect
              id="post-select"
              name="post"
              defaultValue={selected?.id}
              className="w-full sm:w-auto border border-line rounded px-3 py-2 bg-card text-sm"
            >
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {`[${cohortName(cohorts, p.cohort_id, allGradesLabel)}] `}
                  {p.group?.name ? `${p.group.name} · ` : ""}
                  {p.title}
                </option>
              ))}
            </AutoSubmitSelect>
            {/* No-JS fallback: still works without the auto-submit. */}
            <noscript>
              <button
                type="submit"
                className="ml-2 border border-line rounded px-3 py-2 text-sm hover:bg-paper-deep"
              >
                →
              </button>
            </noscript>
          </form>
          {table}
        </>
      )}
    </div>
  );
}
