import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/db";
import { DecorativeBackground } from "@/components/DecorativeBackground";
import { SubmitButton } from "@/components/SubmitButton";
import { GoogleButton } from "@/components/GoogleButton";
import { sendMagicLink, passwordSignIn, verifyMagicCode } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    sent?: string;
    email?: string;
    mode?: string;
    lang?: string;
  }>;
}) {
  const params = await searchParams;
  const locale: Locale = params.lang === "hu" ? "hu" : "en";
  const t = getT(locale);

  const errorMessages: Record<string, string> = {
    deactivated: t("auth.errorDeactivated"),
    noaccount: t("auth.errorNoAccount"),
    invalid: t("auth.errorInvalid"),
    code: t("auth.codeError"),
    existing: t("auth.errorExisting"),
  };
  const idle = params.error === "idle";
  const error =
    !idle && params.error ? errorMessages[params.error] ?? t("auth.errorInvalid") : null;

  const sentEmail = params.email ?? "";
  const codeStep = Boolean(params.sent);

  return (
    <main className="relative min-h-svh flex items-center justify-center p-4">
      {/* Still on mobile — no drifting shapes on the sign-in screen. */}
      <DecorativeBackground animated={false} />
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-tight">{t("common.appName")}</h1>
          <p className="text-ink-soft mt-2">{t("common.tagline")}</p>
        </header>

        <div className="bg-card border border-line rounded-lg p-6 shadow-sm">
          {idle && (
            <p role="status" className="mb-4 text-sm bg-paper-deep text-ink-soft rounded px-3 py-2">
              {t("auth.signedOutIdle")}
            </p>
          )}
          {error && (
            <p role="alert" className="mb-4 text-sm bg-accent-soft text-accent rounded px-3 py-2">
              {error}
            </p>
          )}

          {codeStep ? (
            /* ---- Step 2: enter the code (signs in THIS device) ---- */
            <>
              <h2 className="font-display text-xl mb-1">{t("auth.checkEmailTitle")}</h2>
              <p className="text-sm text-ink-soft mb-1">
                {t("auth.checkEmailBody", { email: sentEmail })}
              </p>
              <p className="text-sm text-ink-soft mb-4">{t("auth.codeHint")}</p>

              <form action={verifyMagicCode} className="space-y-3">
                <input type="hidden" name="email" value={sentEmail} />
                <div>
                  <label htmlFor="code" className="block text-sm font-medium mb-1">
                    {t("auth.codeLabel")}
                  </label>
                  <input
                    id="code"
                    name="token"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={10}
                    required
                    autoFocus
                    placeholder="••••••"
                    className="w-full border border-line rounded px-3 py-2.5 bg-paper text-center text-2xl tracking-[0.3em] font-mono focus:border-accent"
                  />
                </div>
                <SubmitButton className="w-full bg-ink text-paper rounded px-4 py-2.5 font-medium hover:bg-accent">
                  {t("auth.verifyCode")}
                </SubmitButton>
              </form>

              <p className="text-xs text-ink-faint mt-4">{t("auth.linkAlso")}</p>
              <a href={`/login${params.lang === "hu" ? "?lang=hu" : ""}`} className="inline-block mt-2 text-sm underline text-ink-soft">
                {t("auth.useDifferentEmail")}
              </a>
            </>
          ) : (
            /* ---- Step 1: enter email / password ---- */
            <>
              <h2 className="font-display text-xl mb-1">{t("auth.signInTitle")}</h2>
              <p className="text-sm text-ink-soft mb-4">{t("auth.signInIntro")}</p>

              <GoogleButton
                label={t("auth.continueWithGoogle")}
                errorLabel={t("auth.googleError")}
              />
              <div className="flex items-center gap-3 my-4 text-xs text-ink-faint">
                <span className="flex-1 h-px bg-line" />
                {t("auth.or")}
                <span className="flex-1 h-px bg-line" />
              </div>

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
                <SubmitButton className="w-full bg-ink text-paper rounded px-4 py-2.5 font-medium hover:bg-accent">
                  {t("auth.sendMagicLink")}
                </SubmitButton>
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
                  <SubmitButton className="w-full border border-ink rounded px-4 py-2 font-medium hover:bg-paper-deep">
                    {t("auth.signInWithPassword")}
                  </SubmitButton>
                </form>
              </details>
            </>
          )}
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
