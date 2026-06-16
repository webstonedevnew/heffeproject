"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteProblem } from "@/lib/invites";
import type { Invite } from "@/types/db";

function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!token || name.length < 2) redirect(`/invite/${token}?error=name`);
  if (password && password.length < 8) redirect(`/invite/${token}?error=password`);

  const admin = createAdminClient();
  const { data } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .single();
  const invite = data as Invite | null;
  if (!invite) redirect(`/invite/${token}`); // page shows "invalid"
  const problem = inviteProblem({
    acceptedAt: invite.accepted_at,
    expiresAt: invite.expires_at,
  });
  if (problem) redirect(`/invite/${token}`);

  // Create the auth user (or reuse an existing one for re-invites).
  let userId: string | null = null;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password: password || undefined,
    email_confirm: true,
  });
  if (createError) {
    const exists = /already|registered|exists/i.test(createError.message);
    if (!exists) {
      console.error("createUser failed:", createError.message);
      redirect(`/invite/${token}?error=unknown`);
    }
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId =
      list?.users.find(
        (u) => u.email?.toLowerCase() === invite.email.toLowerCase()
      )?.id ?? null;
  } else {
    userId = created.user.id;
  }
  if (!userId) redirect(`/invite/${token}?error=unknown`);

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    role: "student",
    name,
    email: invite.email.toLowerCase(),
    status: "active",
    cohort_id: invite.cohort_id,
  });
  if (profileError) {
    console.error("profile upsert failed:", profileError.message);
    redirect(`/invite/${token}?error=unknown`);
  }

  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (password) {
    // Sign in immediately with the chosen password.
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    });
    if (!error) redirect("/");
  }

  // Otherwise email a magic link and tell them to check their inbox.
  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: invite.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: siteUrl("/auth/callback"),
    },
  });
  redirect(`/invite/${token}?done=1`);
}
