import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { getCohorts } from "@/lib/cohorts-data";
import { PostForm } from "@/components/PostForm";

export default async function NewPostPage() {
  const profile = await requireTeacher();
  const t = getT(profile.locale);
  const supabase = await createClient();

  const [{ data: groups }, cohorts] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name")
      .is("archived_at", null)
      .order("position"),
    getCohorts(supabase),
  ]);

  return (
    <div className="max-w-2xl">
      <Link
        href="/teacher/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium border border-line rounded-full px-4 py-1.5 text-ink-soft hover:bg-paper-deep hover:text-ink mb-4"
      >
        <span aria-hidden>←</span> {t("nav.dashboard")}
      </Link>
      <h1 className="font-display text-2xl mb-4">{t("post.newAssignment")}</h1>
      <PostForm
        groups={groups ?? []}
        cohorts={cohorts.map((c) => ({ id: c.id, name: c.name }))}
        labels={{
          title: t("post.titleLabel"),
          body: t("post.bodyLabel"),
          group: t("post.groupLabel"),
          cohort: t("post.cohortLabel"),
          cohortHint: t("post.cohortHint"),
          allGrades: t("cohorts.allGrades"),
          dueResponse: t("post.dueResponseLabel"),
          dueReplies: t("post.dueRepliesLabel"),
          dateLabel: t("post.dateLabel"),
          timeLabel: t("post.timeLabel"),
          dueHint: t("post.dueHint"),
          attachments: t("post.attachmentsLabel"),
          submit: t("post.publish"),
          error: t("common.error"),
          uploadImage: t("post.uploadImage"),
          pollQuestion: t("poll.questionLabel"),
          pollOptions: t("poll.optionsLabel"),
          pollHint: t("poll.optionsHint"),
        }}
      />
    </div>
  );
}
