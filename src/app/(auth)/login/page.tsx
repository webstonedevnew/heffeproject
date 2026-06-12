import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/db";
import { sendMagicLink, passwordSignIn } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; mode?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const locale: Locale = params.lang === "hu" ? "hu" : "en";
  const t = getT(locale);

  const errorMessages: Record<string, string> = {
    deactivated: t("auth.errorDeactivated"),
    noaccount: t("auth.errorNoAccount"),
    invalid: t("auth.errorInvalid"),
  };
  const error = params.error ? errorMessages[params.error] ?? t("auth.errorInvalid") : null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-tight">{t("common.appName")}</h1>
          <p className="text-ink-soft mt-2">{t("common.tagline")}</p>
        </header>

        <div className="bg-card border border-line rounded-lg p-6 shadow-sm">
          <h2 className="font-display text-xl mb-1">{t("auth.signInTitle")}</h2>
          <p className="text-sm text-ink-soft mb-4">{t("auth.signInIntro")}</p>

          {error && (
            <p role="alert" className="mb-4 text-sm bg-accent-soft text-accent rounded px-3 py-2">
              {error}
            </p>
          )}
          {params.sent && (
            <p role="status" className="mb-4 text-sm bg-sage-soft text-sage rounded px-3 py-2">
              {t("auth.magicLinkSent")}
            </p>
          )}

          <form action={sendMagicLink} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                {t("auth.emailLabel")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full border border-line rounded px-3 py-2 bg-paper focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-ink text-paper rounded px-4 py-2.5 font-medium hover:bg-accent transition-colors"
            >
              {t("auth.sendMagicLink")}
            </button>
          </form>

          <details className="mt-5" open={params.mode === "password"}>
            <summary className="text-sm text-ink-soft cursor-pointer select-none">
              {t("auth.orPassword")}
            </summary>
            <form action={passwordSignIn} className="space-y-3 mt-3">
              <div>
                <label htmlFor="pw-email" className="block text-sm font-medium mb-1">
                  {t("auth.emailLabel")}
                </label>
                <input
                  id="pw-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full border border-line rounded px-3 py-2 bg-paper"
                />
              </div>
              <div>
                <label htmlFor="pw-password" className="block text-sm font-medium mb-1">
                  {t("auth.passwordLabel")}
                </label>
                <input
                  id="pw-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full border border-line rounded px-3 py-2 bg-paper"
                />
              </div>
              <button
                type="submit"
                className="w-full border border-ink rounded px-4 py-2 font-medium hover:bg-paper-deep"
              >
                {t("auth.signInWithPassword")}
              </button>
            </form>
          </details>
        </div>

        <footer className="text-center mt-6 text-xs text-ink-faint space-x-3">
          <span>{t("auth.privateNotice")}</span>
          <span aria-hidden>·</span>
          <a className="underline" href="/login?lang=en">English</a>
          <a className="underline" href="/login?lang=hu">Magyar</a>
        </footer>
      </div>
    </main>
  );
}
