import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { fetchPostCards } from "@/lib/post-cards";
import { PostCard } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";
import type { Group } from "@/types/db";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const supabase = await createClient();
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { data } = await supabase
    .from("groups")
    .select("*")
    .eq("slug", slug)
    .single();
  const group = data as Group | null;
  if (!group) notFound();

  const { cards, hasMore } = await fetchPostCards(supabase, profile, {
    groupId: group.id,
    page,
  });

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-display text-2xl">
          {group.name}
          {group.archived_at && (
            <span className="ml-2 text-sm text-ink-faint uppercase tracking-wide">
              {t("groups.archivedTag")}
            </span>
          )}
        </h1>
        {group.description && <p className="text-ink-soft mt-1">{group.description}</p>}
      </header>

      {cards.length === 0 ? (
        <p className="text-ink-soft bg-card border border-line rounded-lg p-6 text-center">
          {t("groups.noPosts")}
        </p>
      ) : (
        <div className="space-y-3 stagger">
          {cards.map((card) => (
            <PostCard key={card.id} {...card} />
          ))}
        </div>
      )}
      <Pagination
        basePath={`/groups/${slug}`}
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
