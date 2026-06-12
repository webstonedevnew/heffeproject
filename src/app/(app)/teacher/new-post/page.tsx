import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { PostForm } from "@/components/PostForm";

export default async function NewPostPage() {
  const profile = await requireTeacher();
  const t = getT(profile.locale);
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .is("archived_at", null)
    .order("position");

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl mb-4">{t("post.newAssignment")}</h1>
      <PostForm
        groups={groups ?? []}
        labels={{
          title: t("post.titleLabel"),
          body: t("post.bodyLabel"),
          group: t("post.groupLabel"),
          dueResponse: t("post.dueResponseLabel"),
          dueReplies: t("post.dueRepliesLabel"),
          dueHint: t("post.dueHint"),
          attachments: t("post.attachmentsLabel"),
          submit: t("post.publish"),
          error: t("common.error"),
          uploadImage: t("post.uploadImage"),
        }}
      />
    </div>
  );
}
