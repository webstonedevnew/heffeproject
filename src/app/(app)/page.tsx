import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { fetchPostCards } from "@/lib/post-cards";
import { PostCard } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const supabase = await createClient();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { cards, hasMore } = await fetchPostCards(supabase, profile, { page });

  return (
    <div>
      <h1 className="font-display text-2xl mb-4">{t("home.latestAssignments")}</h1>
      {cards.length === 0 ? (
        <p className="text-ink-soft bg-card border border-line rounded-lg p-6 text-center">
          {t("home.noPosts")}
        </p>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <PostCard key={card.id} {...card} />
          ))}
        </div>
      )}
      <Pagination
        basePath="/"
        page={page}
        hasMore={hasMore}
        labels={{
          previous: t("common.previous"),
          next: t("common.next"),
          page: t("common.page", { page }),
        }}
      />
    </div>
  );
}
