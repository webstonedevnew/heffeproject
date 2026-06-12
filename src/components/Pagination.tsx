import Link from "next/link";

export function Pagination({
  basePath,
  page,
  hasMore,
  labels,
  extraQuery = "",
}: {
  basePath: string;
  page: number;
  hasMore: boolean;
  labels: { previous: string; next: string; page: string };
  extraQuery?: string;
}) {
  if (page <= 1 && !hasMore) return null;
  const q = extraQuery ? `&${extraQuery}` : "";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between mt-6 text-sm">
      {page > 1 ? (
        <Link href={`${basePath}?page=${page - 1}${q}`} className="underline text-ink-soft hover:text-ink">
          ← {labels.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-faint">{labels.page}</span>
      {hasMore ? (
        <Link href={`${basePath}?page=${page + 1}${q}`} className="underline text-ink-soft hover:text-ink">
          {labels.next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
