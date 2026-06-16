"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEmailList, INVITE_EXPIRY_DAYS } from "@/lib/invites";
import { getCohorts, normalizeCohortId } from "@/lib/cohorts-data";
import { sendEmail, emailLayout } from "@/lib/email";
import { getT } from "@/lib/i18n";
import type { Invite } from "@/types/db";

function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function expiry(): string {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400_000).toISOString();
}

async function emailInvite(toEmail: string, token: string, teacherLocale: "en" | "hu") {
  const t = getT(teacherLocale);
  await sendEmail({
    to: toEmail,
    subject: t("emails.invite.subject", { appName: t("common.appName") }),
    html: emailLayout({
      greeting: t("emails.greeting", { name: toEmail }),
      paragraphs: [
        t("emails.invite.body"),
        t("emails.invite.expiry", { days: INVITE_EXPIRY_DAYS, email: toEmail }),
      ],
      cta: { label: t("emails.invite.cta"), url: siteUrl(`/invite/${token}`) },
      footer: t("emails.signoff", { appName: t("common.appName") }),
    }),
  });
}

export async function inviteStudents(formData: FormData) {
  const teacher = await requireTeacher();
  const admin = createAdminClient();
  const raw = String(formData.get("emails") ?? "");
  const { valid, invalid } = parseEmailList(raw);

  // Which year group these invitees will join.
  const cohorts = await getCohorts(admin);
  const cohortId = normalizeCohortId(cohorts, formData.get("cohortId") as string | null);

  // Skip addresses that already have an account or a pending invite.
  const { data: existingProfiles } = await admin
    .from("profiles")
    .select("email")
    .in("email", valid.length > 0 ? valid : ["-"]);
  const { data: existingInvites } = await admin
    .from("invites")
    .select("email")
    .is("accepted_at", null)
    .in("email", valid.length > 0 ? valid : ["-"]);
  const taken = new Set([
    ...(existingProfiles ?? []).map((p) => p.email),
    ...(existingInvites ?? []).map((i) => i.email),
  ]);
  const fresh = valid.filter((e) => !taken.has(e));

  let sent = 0;
  for (const email of fresh) {
    const token = newToken();
    const { error } = await admin.from("invites").insert({
      email,
      token,
      invited_by: teacher.id,
      cohort_id: cohortId,
      expires_at: expiry(),
    });
    if (error) {
      console.error("invite insert failed:", error.message);
      continue;
    }
    await emailInvite(email, token, teacher.locale);
    sent++;
  }

  revalidatePath("/teacher/students");
  const q = new URLSearchParams({ sent: String(sent) });
  if (invalid.length > 0) q.set("skipped", invalid.slice(0, 5).join(", "));
  redirect(`/teacher/students?${q.toString()}`);
}

export async function resendInvite(inviteId: string) {
  const teacher = await requireTeacher();
  const admin = createAdminClient();
  const token = newToken();
  const { data } = await admin
    .from("invites")
    .update({ token, expires_at: expiry() })
    .eq("id", inviteId)
    .is("accepted_at", null)
    .select("*")
    .single();
  const invite = data as Invite | null;
  if (invite) await emailInvite(invite.email, token, teacher.locale);
  revalidatePath("/teacher/students");
}

export async function revokeInvite(inviteId: string) {
  await requireTeacher();
  const admin = createAdminClient();
  await admin.from("invites").delete().eq("id", inviteId).is("accepted_at", null);
  revalidatePath("/teacher/students");
}

export async function setStudentStatus(
  studentId: string,
  status: "active" | "deactivated"
) {
  const teacher = await requireTeacher();
  if (studentId === teacher.id) return;
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ status })
    .eq("id", studentId)
    .eq("role", "student");
  revalidatePath("/teacher/students");
}

/**
 * Move a student to another year group (or clear it). Students can't change
 * their own cohort — column grants forbid it — so this goes via the service
 * role after the teacher check.
 */
export async function setStudentCohort(formData: FormData) {
  await requireTeacher();
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) return;
  const admin = createAdminClient();
  const cohorts = await getCohorts(admin);
  const cohortId = normalizeCohortId(cohorts, formData.get("cohortId") as string | null);
  await admin
    .from("profiles")
    .update({ cohort_id: cohortId })
    .eq("id", studentId)
    .eq("role", "student");
  revalidatePath("/teacher/students");
}

/**
 * GDPR erasure: permanently deletes the student's auth account, profile,
 * and — via ON DELETE CASCADE — every comment, reaction, flag, notification
 * and attachment row, plus all files in their storage folders.
 */
export async function eraseStudent(formData: FormData) {
  const teacher = await requireTeacher();
  const studentId = String(formData.get("studentId") ?? "");
  const confirmEmail = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  if (!studentId || studentId === teacher.id) return;

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", studentId)
    .single();
  if (!student || student.role !== "student") return;
  if (student.email.toLowerCase() !== confirmEmail) {
    redirect("/teacher/students?error=confirm");
  }

  // 1. Delete every file the student uploaded (paths are <user_id>/...).
  for (const bucket of ["attachments", "audio"] as const) {
    const { data: files } = await admin.storage.from(bucket).list(studentId, {
      limit: 1000,
    });
    if (files && files.length > 0) {
      await admin.storage
        .from(bucket)
        .remove(files.map((f) => `${studentId}/${f.name}`));
    }
  }

  // 2. Remove any invites tied to this email so it can't be replayed.
  await admin.from("invites").delete().eq("email", student.email);

  // 3. Delete the auth user — cascades through profiles to all content rows.
  const { error } = await admin.auth.admin.deleteUser(studentId);
  if (error) {
    console.error("GDPR erasure failed:", error.message);
    redirect("/teacher/students?error=erase");
  }

  revalidatePath("/teacher/students");
  redirect("/teacher/students?erased=1");
}
