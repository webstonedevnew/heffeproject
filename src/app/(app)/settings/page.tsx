import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { updateSettings, setPassword } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; password?: string; error?: string }>;
}) {
  const profile = await requireProfile();
  const t = getT(profile.locale);
  const sp = await searchParams;

  const checkbox =
    "rounded border-line accent-[var(--color-accent)] w-4 h-4 align-middle";

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl mb-4">{t("settings.title")}</h1>

      {sp.saved && (
        <p role="status" className="mb-3 text-sm bg-sage-soft text-sage rounded px-3 py-2">
          {t("settings.saved")}
        </p>
      )}
      {sp.password && (
        <p role="status" className="mb-3 text-sm bg-sage-soft text-sage rounded px-3 py-2">
          {t("settings.passwordSet")}
        </p>
      )}
      {sp.error && (
        <p role="alert" className="mb-3 text-sm bg-accent-soft text-accent rounded px-3 py-2">
          {t("common.error")}
        </p>
      )}

      <form action={updateSettings} className="bg-card border border-line rounded-lg p-4 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            {t("settings.nameLabel")}
          </label>
          <input
            id="name"
            name="name"
            defaultValue={profile.name}
            required
            minLength={2}
            className="w-full border border-line rounded px-3 py-2 bg-paper"
          />
        </div>

        <div>
          <label htmlFor="locale" className="block text-sm font-medium mb-1">
            {t("settings.languageLabel")}
          </label>
          <select
            id="locale"
            name="locale"
            defaultValue={profile.locale}
            className="w-full border border-line rounded px-3 py-2 bg-paper"
          >
            <option value="en">{t("settings.english")}</option>
            <option value="hu">{t("settings.hungarian")}</option>
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium mb-1">
            {t("settings.emailNotifications")}
          </legend>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="pref_new_assignment"
                defaultChecked={profile.notification_prefs.email_new_assignment}
                className={checkbox}
              />
              {t("settings.prefNewAssignment")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="pref_reply"
                defaultChecked={profile.notification_prefs.email_reply}
                className={checkbox}
              />
              {t("settings.prefReply")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="pref_reminder"
                defaultChecked={profile.notification_prefs.email_reminder}
                className={checkbox}
              />
              {t("settings.prefReminder")}
            </label>
          </div>
          <p className="text-xs text-ink-faint mt-1.5">{t("settings.inAppNote")}</p>
        </fieldset>

        <button
          type="submit"
          className="bg-ink text-paper rounded px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          {t("common.save")}
        </button>
      </form>

      <form action={setPassword} className="bg-card border border-line rounded-lg p-4 mt-4 space-y-3">
        <h2 className="font-display text-lg">{t("settings.passwordTitle")}</h2>
        <p className="text-xs text-ink-soft">{t("settings.passwordHint")}</p>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            {t("auth.passwordLabel")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full border border-line rounded px-3 py-2 bg-paper"
          />
        </div>
        <button
          type="submit"
          className="border border-ink rounded px-4 py-2 text-sm hover:bg-paper-deep"
        >
          {t("settings.setPassword")}
        </button>
      </form>
    </div>
  );
}
