import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { resolveFlag } from "./actions";

interface FlagRow {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  resolved_at: string | null;
  created_at: string;
  flagger: { name: string } | null;
  post: { id: string; title: string } | null;
  comment: {
    id: string;
    post_id: string;
    body_text: string;
    author: { name: string } | null;
  } | null;
}

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ resolved?: string }>;
}) {
  const profile = await requireTeacher();
  const t = getT(profile.locale);
  const supabase = await createClient();
  const { resolved } = await searchParams;
  const showResolved = resolved === "1";

  let query = supabase
    .from("flags")
    .select(
      "id, post_id, comment_id, reason, resolved_at, created_at, flagger:profiles!flags_flagged_by_fkey(name), post:posts(id, title), comment:comments(id, post_id, body_text, author:profiles!comments_author_id_fkey(name))"
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (!showResolved) query = query.is("resolved_at", null);

  const { data } = await query;
  const flags = (data ?? []) as unknown as FlagRow[];

  return (
    <div className="max-w-2xl">
      <Link
        href="/teacher/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium border border-line rounded-full px-4 py-1.5 text-ink-soft hover:bg-paper-deep hover:text-ink mb-4"
      >
        <span aria-hidden>←</span> {t("nav.dashboard")}
      </Link>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl">{t("flagsPage.title")}</h1>
        <Link
          href={showResolved ? "/teacher/flags" : "/teacher/flags?resolved=1"}
          className="text-sm underline text-ink-soft"
        >
          {t("flagsPage.showResolved")} {showResolved ? "✓" : ""}
        </Link>
      </div>

      {flags.length === 0 ? (
        <p className="text-ink-soft bg-card border border-line rounded-lg p-6 text-center">
          {t("flagsPage.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {flags.map((flag) => {
            const targetPostId = flag.comment?.post_id ?? flag.post?.id;
            const anchor = flag.comment ? `#comment-${flag.comment.id}` : "";
            return (
              <li
                key={flag.id}
                className={`bg-card rounded-lg p-4 border ${
                  flag.resolved_at
                    ? "border-line opacity-60"
                    : "border-warn/50 border-l-4 border-l-warn shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-lg leading-none">🚩</span>
                  <p className="text-xs text-ink-faint">
                    {t("flagsPage.flaggedBy", {
                      name: flag.flagger?.name ?? "—",
                      date: formatDateTime(flag.created_at, profile.locale),
                    })}
                  </p>
                  {flag.resolved_at && (
                    <span className="ml-auto text-xs uppercase tracking-wide text-sage font-medium">
                      ✓ {t("flagsPage.resolvedTag")}
                    </span>
                  )}
                </div>

                {/* The student's reason — the most important thing here. */}
                <div className="mt-3 rounded-r border-l-4 border-warn bg-warn-soft px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-warn font-semibold">
                    {t("flagsPage.reason")}
                  </p>
                  <p className="text-sm mt-0.5 text-ink">
                    {flag.reason ? (
                      `“${flag.reason}”`
                    ) : (
                      <em className="text-ink-faint">{t("flagsPage.noReason")}</em>
                    )}
                  </p>
                </div>

                {/* What was flagged. */}
                <div className="mt-2 rounded border border-line bg-paper-deep/40 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                    {t("flagsPage.flaggedContent")}
                  </p>
                  {flag.comment ? (
                    <p className="text-sm mt-0.5">
                      <span className="font-medium">{flag.comment.author?.name}:</span>{" "}
                      <span className="text-ink-soft">
                        {flag.comment.body_text.slice(0, 200) || "🎙"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm mt-0.5 font-medium">{flag.post?.title}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  {targetPostId && (
                    <Link
                      href={`/posts/${targetPostId}${anchor}`}
                      className="underline text-accent font-medium"
                    >
                      {t("flagsPage.openContent")} →
                    </Link>
                  )}
                  {!flag.resolved_at && (
                    <ConfirmButton
                      action={resolveFlag.bind(null, flag.id)}
                      confirmText={t("flagsPage.resolve") + "?"}
                      className="underline text-ink-soft"
                    >
                      {t("flagsPage.resolve")}
                    </ConfirmButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
