import { requireProfile } from "@/lib/auth";
import { getT, getList } from "@/lib/i18n";

export default async function PrivacyPage() {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const paragraphs = getList(profile.locale, "privacy.body");

  return (
    <article className="max-w-xl">
      <h1 className="font-display text-2xl mb-4">{t("privacy.title")}</h1>
      <div className="space-y-4 leading-relaxed text-[15px]">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  );
}
