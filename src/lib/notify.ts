import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email";
import { getT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { REQUIRED_PEER_REPLIES } from "@/lib/participation";
import type { Profile, NotificationType } from "@/types/db";

function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

type Payload = {
  post_id: string;
  post_title: string;
  group_slug?: string;
  comment_id?: string;
  actor_name?: string;
  excerpt?: string;
};

async function insertNotifications(
  rows: { user_id: string; type: NotificationType; payload: Payload }[]
) {
  if (rows.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert(rows);
  if (error) console.error("notification insert failed:", error.message);
}

/**
 * New assignment → the active students it concerns, in-app + email per
 * preference. A cohort-targeted post reaches only that year group; a shared
 * post (cohortId null) reaches everyone.
 */
export async function notifyNewAssignment(opts: {
  post: { id: string; title: string };
  cohortId: string | null;
  groupSlug: string;
  groupName: string;
  teacherName: string;
}) {
  const admin = createAdminClient();
  let studentsQuery = admin
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .eq("status", "active");
  if (opts.cohortId !== null) {
    studentsQuery = studentsQuery.eq("cohort_id", opts.cohortId);
  }
  const { data: students } = await studentsQuery;
  const recipients = (students ?? []) as Profile[];

  const payload: Payload = {
    post_id: opts.post.id,
    post_title: opts.post.title,
    group_slug: opts.groupSlug,
    actor_name: opts.teacherName,
  };
  await insertNotifications(
    recipients.map((s) => ({ user_id: s.id, type: "new_assignment" as const, payload }))
  );

  await Promise.all(
    recipients
      .filter((s) => s.notification_prefs?.email_new_assignment !== false)
      .map((s) => {
        const t = getT(s.locale);
        return sendEmail({
          to: s.email,
          subject: t("emails.newAssignment.subject", { title: opts.post.title }),
          html: emailLayout({
            greeting: t("emails.greeting", { name: s.name }),
            paragraphs: [
              t("emails.newAssignment.body", { group: opts.groupName }),
              `“${opts.post.title}”`,
            ],
            cta: {
              label: t("emails.openLink", { appName: t("common.appName") }),
              url: siteUrl(`/posts/${opts.post.id}`),
            },
            footer: t("emails.signoff", { appName: t("common.appName") }),
          }),
        });
      })
  );
}

/** Someone replied to your contribution. */
export async function notifyReply(opts: {
  recipientId: string;
  actorName: string;
  post: { id: string; title: string };
  commentId: string;
  excerpt: string;
}) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("id", opts.recipientId)
    .single();
  const recipient = data as Profile | null;
  if (!recipient || recipient.status !== "active") return;

  await insertNotifications([
    {
      user_id: recipient.id,
      type: "reply",
      payload: {
        post_id: opts.post.id,
        post_title: opts.post.title,
        comment_id: opts.commentId,
        actor_name: opts.actorName,
        excerpt: opts.excerpt,
      },
    },
  ]);

  if (recipient.notification_prefs?.email_reply !== false) {
    const t = getT(recipient.locale);
    await sendEmail({
      to: recipient.email,
      subject: t("emails.reply.subject", { actor: opts.actorName }),
      html: emailLayout({
        greeting: t("emails.greeting", { name: recipient.name }),
        paragraphs: [
          t("emails.reply.body", { actor: opts.actorName, title: opts.post.title }),
          opts.excerpt ? `“${opts.excerpt}”` : "",
        ].filter(Boolean),
        cta: {
          label: t("emails.openLink", { appName: t("common.appName") }),
          url: siteUrl(`/posts/${opts.post.id}#comment-${opts.commentId}`),
        },
        footer: t("emails.signoff", { appName: t("common.appName") }),
      }),
    });
  }
}

/** A student flagged content → notify the teacher(s), in-app only. */
export async function notifyFlag(opts: {
  actorName: string;
  post: { id: string; title: string };
  commentId?: string;
}) {
  const admin = createAdminClient();
  const { data: teachers } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "teacher")
    .eq("status", "active");
  await insertNotifications(
    (teachers ?? []).map((tch) => ({
      user_id: tch.id,
      type: "flag" as const,
      payload: {
        post_id: opts.post.id,
        post_title: opts.post.title,
        comment_id: opts.commentId,
        actor_name: opts.actorName,
      },
    }))
  );
}

/** Deadline reminder for one student (called by the cron route). */
export async function sendReminder(opts: {
  student: Profile;
  kind: "response" | "replies";
  post: { id: string; title: string };
  dueAt: string;
  repliesDone?: number;
}) {
  const { student } = opts;
  const type =
    opts.kind === "response" ? ("reminder_response" as const) : ("reminder_replies" as const);

  await insertNotifications([
    {
      user_id: student.id,
      type,
      payload: { post_id: opts.post.id, post_title: opts.post.title },
    },
  ]);

  if (student.notification_prefs?.email_reminder === false) return;
  const t = getT(student.locale);
  const due = formatDateTime(opts.dueAt, student.locale);
  const subject =
    opts.kind === "response"
      ? t("emails.reminderResponse.subject", { title: opts.post.title })
      : t("emails.reminderReplies.subject", { title: opts.post.title });
  const body =
    opts.kind === "response"
      ? t("emails.reminderResponse.body", { title: opts.post.title, date: due })
      : t("emails.reminderReplies.body", {
          title: opts.post.title,
          date: due,
          count: REQUIRED_PEER_REPLIES,
          done: opts.repliesDone ?? 0,
        });

  await sendEmail({
    to: student.email,
    subject,
    html: emailLayout({
      greeting: t("emails.greeting", { name: student.name }),
      paragraphs: [body],
      cta: {
        label: t("emails.openLink", { appName: t("common.appName") }),
        url: siteUrl(`/posts/${opts.post.id}`),
      },
      footer: t("emails.signoff", { appName: t("common.appName") }),
    }),
  });
}
