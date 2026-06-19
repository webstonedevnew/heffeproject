import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { getCohorts } from "@/lib/cohorts-data";
import { cohortName } from "@/lib/cohorts";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  inviteStudents,
  resendInvite,
  revokeInvite,
  setStudentStatus,
  setStudentCohort,
  eraseStudent,
} from "./actions";
import type { Invite, Profile } from "@/types/db";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; skipped?: string; erased?: string; error?: string }>;
}) {
  const profile = await requireTeacher();
  const t = getT(profile.locale);
  const sp = await searchParams;
  const admin = createAdminClient();

  const [{ data: studentRows }, { data: inviteRows }, cohorts] = await Promise.all([
    admin.from("profiles").select("*").eq("role", "student").order("name"),
    admin
      .from("invites")
      .select("*")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    getCohorts(admin),
  ]);
  const students = (studentRows ?? []) as Profile[];
  const invites = (inviteRows ?? []) as Invite[];
  const now = Date.now();
  const allGradesLabel = t("cohorts.allGrades");

  return (
    <div className="max-w-2xl">
      <Link
        href="/teacher/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium border border-line rounded-full px-4 py-1.5 text-ink-soft hover:bg-paper-deep hover:text-ink mb-4"
      >
        <span aria-hidden>←</span> {t("nav.dashboard")}
      </Link>
      <h1 className="font-display text-2xl mb-4">{t("students.title")}</h1>

      {sp.sent && Number(sp.sent) > 0 && (
        <p role="status" className="mb-3 text-sm bg-sage-soft text-sage rounded px-3 py-2">
          {t("students.invitesSent", { count: sp.sent })}
        </p>
      )}
      {sp.skipped && (
        <p role="alert" className="mb-3 text-sm bg-warn-soft text-warn rounded px-3 py-2">
          {t("students.invalidSkipped", { list: sp.skipped })}
        </p>
      )}
      {sp.erased && (
        <p role="status" className="mb-3 text-sm bg-sage-soft text-sage rounded px-3 py-2">
          {t("students.erased")}
        </p>
      )}
      {sp.error && (
        <p role="alert" className="mb-3 text-sm bg-accent-soft text-accent rounded px-3 py-2">
          {sp.error === "confirm"
            ? t("students.eraseErrorConfirm")
            : sp.error === "erase"
              ? t("students.eraseErrorErase")
              : t("common.error")}
        </p>
      )}

      <section className="bg-card border border-line rounded-lg p-4 mb-6">
        <h2 className="font-display text-lg mb-1">{t("students.inviteTitle")}</h2>
        <p className="text-xs text-ink-soft mb-2">{t("students.inviteHint")}</p>
        <form action={inviteStudents}>
          <label htmlFor="invite-emails" className="sr-only">
            {t("students.inviteHint")}
          </label>
          <textarea
            id="invite-emails"
            name="emails"
            rows={3}
            required
            placeholder="anna@school.eu, bela@school.eu"
            className="w-full border border-line rounded px-3 py-2 bg-paper text-sm"
          />
          {cohorts.length > 0 && (
            <div className="mt-2">
              <label htmlFor="invite-cohort" className="block text-xs text-ink-soft mb-1">
                {t("students.inviteCohort")}
              </label>
              <select
                id="invite-cohort"
                name="cohortId"
                defaultValue={cohorts[0]?.id ?? ""}
                className="border border-line rounded px-3 py-2 bg-paper text-sm"
              >
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            className="mt-2 bg-ink text-paper rounded px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            {t("students.sendInvites")}
          </button>
        </form>
      </section>

      {invites.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-lg mb-2">{t("students.pendingInvites")}</h2>
          <ul className="space-y-1">
            {invites.map((invite) => {
              const expired = new Date(invite.expires_at).getTime() <= now;
              const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
              const inviteUrl = `${base}/invite/${invite.token}`;
              return (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center gap-2 bg-card border border-line rounded px-3 py-2 text-sm"
                >
                  <span className="font-medium">{invite.email}</span>
                  <span className="text-xs rounded-full bg-paper-deep text-ink-soft px-2 py-0.5">
                    {cohortName(cohorts, invite.cohort_id, allGradesLabel)}
                  </span>
                  {expired && (
                    <span className="text-xs text-warn uppercase">{t("students.expired")}</span>
                  )}
                  <label className="basis-full order-last text-xs text-ink-faint">
                    {t("students.inviteLink")}
                    <input
                      readOnly
                      value={inviteUrl}
                      className="w-full border border-line rounded px-2 py-1 mt-0.5 bg-paper text-ink-soft font-mono text-[11px]"
                    />
                  </label>
                  <span className="ml-auto flex gap-3 text-xs">
                    <ConfirmButton
                      action={resendInvite.bind(null, invite.id)}
                      confirmText={t("students.resend") + "?"}
                      className="underline text-ink-soft"
                    >
                      {t("students.resend")}
                    </ConfirmButton>
                    <ConfirmButton
                      action={revokeInvite.bind(null, invite.id)}
                      confirmText={t("students.revoke") + "?"}
                    >
                      {t("students.revoke")}
                    </ConfirmButton>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg mb-2">
          {t("students.title")}{" "}
          <span className="text-ink-faint text-sm">({students.length})</span>
        </h2>
        {students.length === 0 ? (
          <p className="text-ink-soft text-sm">{t("students.noStudents")}</p>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => (
              <li
                key={s.id}
                className={`bg-card border border-line rounded-lg px-4 py-3 ${
                  s.status === "deactivated" ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-ink-faint">
                      {s.email} · {t("students.joined", { date: formatDate(s.created_at, profile.locale) })}
                    </p>
                  </div>
                  {cohorts.length > 0 && (
                    <form action={setStudentCohort} className="ml-auto flex items-center gap-1">
                      <input type="hidden" name="studentId" value={s.id} />
                      <label htmlFor={`cohort-${s.id}`} className="sr-only">
                        {t("students.cohortLabel")}
                      </label>
                      <select
                        id={`cohort-${s.id}`}
                        name="cohortId"
                        defaultValue={s.cohort_id ?? ""}
                        className="text-xs border border-line rounded px-2 py-1 bg-paper"
                      >
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value="">{allGradesLabel}</option>
                      </select>
                      <button
                        type="submit"
                        className="text-xs underline text-ink-soft hover:text-ink"
                      >
                        {t("common.save")}
                      </button>
                    </form>
                  )}
                  <span
                    className={`${cohorts.length > 0 ? "" : "ml-auto"} text-xs rounded-full px-2 py-0.5 ${
                      s.status === "active"
                        ? "bg-sage-soft text-sage"
                        : "bg-warn-soft text-warn"
                    }`}
                  >
                    {s.status === "active"
                      ? t("students.statusActive")
                      : t("students.statusDeactivated")}
                  </span>
                  <ConfirmButton
                    action={setStudentStatus.bind(
                      null,
                      s.id,
                      s.status === "active" ? "deactivated" : "active"
                    )}
                    confirmText={
                      (s.status === "active"
                        ? t("students.deactivate")
                        : t("students.reactivate")) + "?"
                    }
                    className="text-xs underline text-ink-soft"
                  >
                    {s.status === "active"
                      ? t("students.deactivate")
                      : t("students.reactivate")}
                  </ConfirmButton>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-accent underline select-none">
                    {t("students.erase")}
                  </summary>
                  <div className="mt-2 p-3 bg-accent-soft rounded">
                    <p className="text-xs text-accent mb-2">
                      {t("students.eraseWarning", { name: s.name })}
                    </p>
                    <form action={eraseStudent} className="flex flex-wrap gap-2 items-end">
                      <input type="hidden" name="studentId" value={s.id} />
                      <label className="block text-xs flex-1 min-w-48">
                        {t("students.eraseConfirmLabel")}
                        <input
                          name="confirmEmail"
                          type="email"
                          required
                          className="w-full border border-line rounded px-2 py-1.5 bg-paper mt-1"
                        />
                      </label>
                      <button
                        type="submit"
                        className="bg-accent text-paper rounded px-3 py-1.5 text-xs font-medium"
                      >
                        {t("students.eraseConfirm")}
                      </button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
