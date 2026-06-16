import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { fetchPostCards } from "@/lib/post-cards";
import { getCohorts, normalizeCohortId } from "@/lib/cohorts-data";
import { PostCard } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; cohort?: string }>;
}) {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const supabase = await createClient();
  const { page: pageParam, cohort: cohortParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const isTeacher = profile.role === "teacher";
  // Only the teacher can preview a single grade; students are scoped by RLS.
  const cohorts = isTeacher ? await getCohorts(supabase) : [];
  const cohortId = isTeacher ? normalizeCohortId(cohorts, cohortParam) : null;

  const { cards, hasMore } = await fetchPostCards(supabase, profile, {
    page,
    cohortId,
  });

  const filterLink = (value: string | null) => {
    const params = new URLSearchParams();
    if (value) params.set("cohort", value);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="font-display text-2xl">{t("home.latestAssignments")}</h1>
        {isTeacher && cohorts.length > 0 && (
          <nav aria-label={t("cohorts.filterLabel")} className="flex flex-wrap gap-1 text-sm">
            <Link
              href={filterLink(null)}
              className={`px-3 py-1 rounded-full ${
                cohortId === null ? "bg-ink text-paper" : "hover:bg-paper-deep"
              }`}
            >
              {t("cohorts.allGrades")}
            </Link>
            {cohorts.map((c) => (
              <Link
                key={c.id}
                href={filterLink(c.id)}
                className={`px-3 py-1 rounded-full ${
                  cohortId === c.id ? "bg-ink text-paper" : "hover:bg-paper-deep"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="text-ink-soft bg-card border border-line rounded-lg p-6 text-center">
          {t("home.noPosts")}
        </p>
      ) : (
        <div className="space-y-3 stagger">
          {cards.map((card) => (
            <PostCard key={card.id} {...card} />
          ))}
        </div>
      )}
      <Pagination
        basePath="/"
        page={page}
        hasMore={hasMore}
        extraQuery={cohortId ? `cohort=${cohortId}` : ""}
        labels={{
          previous: t("common.previous"),
          next: t("common.next"),
          page: t("common.page", { page }),
        }}
      />
    </div>
  );
}
