import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const supabase = await createClient();

  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("read_at", null);

  let openFlags = 0;
  if (profile.role === "teacher") {
    const { count } = await supabase
      .from("flags")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null);
    openFlags = count ?? 0;
  }

  const navLink =
    "px-3 py-1.5 rounded-full text-sm hover:bg-paper-deep transition-colors whitespace-nowrap";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <Link href="/" className="font-display text-2xl tracking-tight">
              {t("common.appName")}
            </Link>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden sm:inline text-ink-soft">{profile.name}</span>
              {profile.role === "teacher" && (
                <span className="text-xs bg-accent text-paper rounded-full px-2 py-0.5">
                  {t("common.teacherBadge")}
                </span>
              )}
              <a href="/auth/signout" className="text-ink-soft hover:text-ink underline">
                {t("nav.signOut")}
              </a>
            </div>
          </div>
          <nav
            aria-label="Main"
            className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1"
          >
            <Link href="/" className={navLink}>{t("nav.home")}</Link>
            <Link href="/groups" className={navLink}>{t("nav.groups")}</Link>
            <Link href="/search" className={navLink}>{t("nav.search")}</Link>
            <Link href="/notifications" className={navLink}>
              {t("nav.notifications")}
              {(unread ?? 0) > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 text-xs bg-accent text-paper rounded-full px-1">
                  {unread}
                </span>
              )}
            </Link>
            <Link href="/settings" className={navLink}>{t("nav.settings")}</Link>
            {profile.role === "teacher" && (
              <>
                <span aria-hidden className="self-center text-line">│</span>
                <Link href="/teacher/participation" className={navLink}>
                  {t("nav.participation")}
                </Link>
                <Link href="/teacher/students" className={navLink}>
                  {t("nav.students")}
                </Link>
                <Link href="/teacher/flags" className={navLink}>
                  {t("nav.flags")}
                  {openFlags > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 text-xs bg-warn text-paper rounded-full px-1">
                      {openFlags}
                    </span>
                  )}
                </Link>
                <Link
                  href="/teacher/new-post"
                  className="px-3 py-1.5 rounded-full text-sm bg-ink text-paper hover:bg-accent transition-colors whitespace-nowrap"
                >
                  + {t("nav.newPost")}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-line py-4 text-center text-xs text-ink-faint">
        <Link href="/privacy" className="underline">
          {t("nav.privacy")}
        </Link>
      </footer>
    </div>
  );
}
