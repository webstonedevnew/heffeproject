import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { PostForm } from "@/components/PostForm";
import type { Post } from "@/types/db";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const profile = await requireTeacher();
  const t = getT(profile.locale);
  const supabase = await createClient();
  const { postId } = await params;

  const { data } = await supabase.from("posts").select("*").eq("id", postId).single();
  const post = data as Post | null;
  if (!post) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl mb-4">{t("post.editPost")}</h1>
      <PostForm
        groups={[]}
        postId={post.id}
        initial={{
          title: post.title,
          bodyHtml: post.body_html,
          groupId: post.group_id,
          dueAtResponse: post.due_at_response,
          dueAtReplies: post.due_at_replies,
        }}
        labels={{
          title: t("post.titleLabel"),
          body: t("post.bodyLabel"),
          group: t("post.groupLabel"),
          dueResponse: t("post.dueResponseLabel"),
          dueReplies: t("post.dueRepliesLabel"),
          dueHint: t("post.dueHint"),
          attachments: t("post.attachmentsLabel"),
          submit: t("post.update"),
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
