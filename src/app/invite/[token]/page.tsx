import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteProblem } from "@/lib/invites";
import { getT } from "@/lib/i18n";
import { DecorativeBackground } from "@/components/DecorativeBackground";
import { SubmitButton } from "@/components/SubmitButton";
import { GoogleButton } from "@/components/GoogleButton";
import type { Invite, Locale } from "@/types/db";
import { acceptInvite } from "./actions";

export const metadata = { title: "Invitation" };

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; done?: string; lang?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const locale: Locale = sp.lang === "hu" ? "hu" : "en";
  const t = getT(locale);

  const admin = createAdminClient();
  const { data } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .single();
  const invite = data as Invite | null;

  const problem = invite
    ? inviteProblem({ acceptedAt: invite.accepted_at, expiresAt: invite.expires_at })
    : "unknown";

  const shell = (children: React.ReactNode) => (
    <main className="relative min-h-svh flex items-center justify-center p-4">
      <DecorativeBackground animated={false} />
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-tight">{t("common.appName")}</h1>
          <p className="text-ink-soft mt-2">{t("common.tagline")}</p>
        </header>
        <div className="bg-card border border-line rounded-lg p-6 shadow-sm">{children}</div>
        <footer className="text-center mt-6 text-xs text-ink-faint space-x-3">
          <Link className="underline" href={`/invite/${token}?lang=en`}>English</Link>
          <Link className="underline" href={`/invite/${token}?lang=hu`}>Magyar</Link>
        </footer>
      </div>
    </main>
  );

  if (sp.done) {
    return shell(
      <div className="text-center py-4">
        <p className="text-lg">📬</p>
        <p className="mt-2">{t("invite.checkEmail")}</p>
      </div>
    );
  }

  if (!invite || (problem && sp.done === undefined)) {
    const message =
      problem === "accepted"
        ? t("invite.invalidAccepted")
        : problem === "expired"
          ? t("invite.invalidExpired")
          : t("invite.invalidUnknown");
    return shell(
      <div className="text-center py-4">
        <h2 className="font-display text-xl mb-2">{t("invite.invalidTitle")}</h2>
        <p className="text-ink-soft">{message}</p>
        <Link
          href="/login"
          className="inline-block mt-4 border border-ink rounded px-4 py-2 hover:bg-paper-deep"
        >
          {t("invite.goToSignIn")}
        </Link>
      </div>
    );
  }

  return shell(
    <>
      <h2 className="font-display text-xl mb-1">
        {t("invite.title", { appName: t("common.appName") })}
      </h2>
      <p className="text-sm text-ink-soft mb-1">{t("invite.intro")}</p>
      <p className="text-sm font-medium mb-4">
        {t("invite.invitedAs", { email: invite.email })}
      </p>

      {sp.error && (
        <p role="alert" className="mb-4 text-sm bg-accent-soft text-accent rounded px-3 py-2">
          {t("common.error")}
        </p>
      )}

      <GoogleButton
        label={t("auth.continueWithGoogle")}
        errorLabel={t("auth.googleError")}
      />
      <p className="text-xs text-ink-faint mt-1.5">
        {t("invite.googleHint", { email: invite.email })}
      </p>
      <div className="flex items-center gap-3 my-4 text-xs text-ink-faint">
        <span className="flex-1 h-px bg-line" />
        {t("auth.or")}
        <span className="flex-1 h-px bg-line" />
      </div>

      <form action={acceptInvite} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            {t("invite.nameLabel")}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            autoComplete="name"
            className="w-full border border-line rounded px-3 py-2 bg-paper"
            aria-describedby="name-hint"
          />
          <p id="name-hint" className="text-xs text-ink-faint mt-1">
            {t("invite.nameHint")}
          </p>
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            {t("invite.passwordLabel")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            className="w-full border border-line rounded px-3 py-2 bg-paper"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-ink-faint mt-1">
            {t("invite.passwordHint")}
          </p>
        </div>
        <SubmitButton className="w-full bg-ink text-paper rounded px-4 py-2.5 font-medium hover:bg-accent">
          {t("invite.join")}
        </SubmitButton>
      </form>
    </>
  );
}
