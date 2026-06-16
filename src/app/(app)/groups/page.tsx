import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createGroup, renameGroup, setGroupArchived } from "./actions";
import type { Group } from "@/types/db";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const supabase = await createClient();
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const { data } = await supabase
    .from("groups")
    .select("*, posts(count)")
    .order("position")
    .order("name");
  const allGroups = (data ?? []) as (Group & { posts: { count: number }[] })[];
  const groups = allGroups.filter((g) =>
    showArchived ? true : g.archived_at === null
  );
  const isTeacher = profile.role === "teacher";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl">{t("groups.title")}</h1>
        <Link
          href={showArchived ? "/groups" : "/groups?archived=1"}
          className="text-sm underline text-ink-soft"
        >
          {t("groups.showArchived")} {showArchived ? "✓" : ""}
        </Link>
      </div>

      <ul className="grid sm:grid-cols-2 gap-3 stagger">
        {groups.map((group) => (
          <li
            key={group.id}
            className={`lift bg-card border border-line rounded-lg p-4 ${
              group.archived_at ? "opacity-60" : ""
            }`}
          >
            <h2 className="font-display text-lg leading-snug">
              <Link href={`/groups/${group.slug}`} className="hover:text-accent">
                {group.name}
              </Link>
              {group.archived_at && (
                <span className="ml-2 text-xs text-ink-faint uppercase tracking-wide">
                  {t("groups.archivedTag")}
                </span>
              )}
            </h2>
            {group.description && (
              <p className="text-sm text-ink-soft mt-1">{group.description}</p>
            )}
            <p className="text-xs text-ink-faint mt-2">
              {t("groups.postCount", { count: group.posts?.[0]?.count ?? 0 })}
            </p>

            {isTeacher && (
              <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-line/60 text-xs">
                <details>
                  <summary className="cursor-pointer underline text-ink-soft">
                    {t("groups.rename")}
                  </summary>
                  <form action={renameGroup} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={group.id} />
                    <label className="block">
                      <span className="sr-only">{t("groups.nameLabel")}</span>
                      <input
                        name="name"
                        defaultValue={group.name}
                        required
                        className="w-full border border-line rounded px-2 py-1 bg-paper"
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">{t("groups.descriptionLabel")}</span>
                      <input
                        name="description"
                        defaultValue={group.description ?? ""}
                        placeholder={t("groups.descriptionLabel")}
                        className="w-full border border-line rounded px-2 py-1 bg-paper"
                      />
                    </label>
                    <button type="submit" className="bg-ink text-paper rounded px-3 py-1">
                      {t("common.save")}
                    </button>
                  </form>
                </details>
                <ConfirmButton
                  action={setGroupArchived.bind(null, group.id, group.archived_at === null)}
                  confirmText={
                    group.archived_at ? t("groups.unarchive") + "?" : t("groups.archive") + "?"
                  }
                  className="underline text-ink-soft"
                >
                  {group.archived_at ? t("groups.unarchive") : t("groups.archive")}
                </ConfirmButton>
              </div>
            )}
          </li>
        ))}
      </ul>

      {isTeacher && (
        <section className="mt-8 bg-card border border-line rounded-lg p-4 max-w-md">
          <h2 className="font-display text-lg mb-2">{t("groups.createTitle")}</h2>
          <form action={createGroup} className="space-y-2">
            <div>
              <label htmlFor="new-group-name" className="block text-sm mb-1">
                {t("groups.nameLabel")}
              </label>
              <input
                id="new-group-name"
                name="name"
                required
                className="w-full border border-line rounded px-3 py-2 bg-paper"
              />
            </div>
            <div>
              <label htmlFor="new-group-desc" className="block text-sm mb-1">
                {t("groups.descriptionLabel")}
              </label>
              <input
                id="new-group-desc"
                name="description"
                className="w-full border border-line rounded px-3 py-2 bg-paper"
              />
            </div>
            <button type="submit" className="bg-ink text-paper rounded px-4 py-2 text-sm">
              {t("groups.create")}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
