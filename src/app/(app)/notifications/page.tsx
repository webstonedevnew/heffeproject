import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { markAllNotificationsRead } from "@/app/(app)/actions";
import type { AppNotification } from "@/types/db";

const TYPE_KEY: Record<AppNotification["type"], string> = {
  new_assignment: "notifications.newAssignment",
  reply: "notifications.reply",
  reminder_response: "notifications.reminderResponse",
  reminder_replies: "notifications.reminderReplies",
  flag: "notifications.flag",
};

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const notifications = (data ?? []) as AppNotification[];
  const hasUnread = notifications.some((n) => n.read_at === null);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl">{t("notifications.title")}</h1>
        {hasUnread && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="text-sm underline text-ink-soft hover:text-ink">
              {t("notifications.markAllRead")}
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-ink-soft bg-card border border-line rounded-lg p-6 text-center">
          {t("notifications.empty")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {notifications.map((n) => {
            const text = t(TYPE_KEY[n.type], {
              actor: n.payload.actor_name ?? "",
              title: n.payload.post_title ?? "",
            });
            const href = n.payload.post_id
              ? `/posts/${n.payload.post_id}${n.payload.comment_id ? `#comment-${n.payload.comment_id}` : ""}`
              : "/";
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className={`block rounded-lg border px-4 py-3 text-sm transition-colors hover:border-ink-faint ${
                    n.read_at
                      ? "bg-paper border-line/60 text-ink-soft"
                      : "bg-card border-line font-medium"
                  }`}
                >
                  <span className="block">{text}</span>
                  {n.payload.excerpt && (
                    <span className="block text-xs text-ink-faint font-normal mt-0.5">
                      “{n.payload.excerpt}”
                    </span>
                  )}
                  <time dateTime={n.created_at} className="block text-xs text-ink-faint font-normal mt-0.5">
                    {timeAgo(n.created_at, profile.locale)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
