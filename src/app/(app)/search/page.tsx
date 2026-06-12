import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

interface SearchResult {
  kind: "post" | "comment";
  id: string;
  post_id: string;
  post_title: string;
  group_slug: string;
  group_name: string;
  author_name: string;
  snippet: string;
  created_at: string;
  rank: number;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const supabase = await createClient();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let results: SearchResult[] = [];
  if (query) {
    const { data } = await supabase.rpc("search_content", { q: query });
    results = (data ?? []) as SearchResult[];
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl mb-4">{t("search.title")}</h1>

      <form method="get" role="search" className="flex gap-2 mb-6">
        <label htmlFor="q" className="sr-only">
          {t("search.placeholder")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t("search.placeholder")}
          className="flex-1 border border-line rounded px-3 py-2 bg-card"
        />
        <button
          type="submit"
          className="bg-ink text-paper rounded px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          {t("nav.search")}
        </button>
      </form>

      {query && (
        <p className="text-sm text-ink-soft mb-3">
          {results.length > 0
            ? t("search.results", { count: results.length, query })
            : t("search.noResults", { query })}
        </p>
      )}

      <ul className="space-y-2">
        {results.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="bg-card border border-line rounded-lg p-4">
            <p className="text-xs text-ink-faint uppercase tracking-wide">
              {r.kind === "post" ? t("search.kindPost") : t("search.kindComment")} ·{" "}
              {t("search.inGroup", { group: r.group_name })} · {r.author_name} ·{" "}
              {formatDate(r.created_at, profile.locale)}
            </p>
            <h2 className="font-display mt-1">
              <Link
                href={`/posts/${r.post_id}${r.kind === "comment" ? `#comment-${r.id}` : ""}`}
                className="hover:text-accent"
              >
                {r.post_title}
              </Link>
            </h2>
            {r.snippet && (
              <p
                className="text-sm text-ink-soft mt-1 [&_b]:bg-warn-soft [&_b]:font-semibold"
                dangerouslySetInnerHTML={{ __html: r.snippet }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
