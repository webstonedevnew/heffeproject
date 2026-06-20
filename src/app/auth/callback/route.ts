import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteProblem } from "@/lib/invites";
import type { Invite } from "@/types/db";

/**
 * PKCE code exchange — used by Google OAuth (and as a magic-link fallback).
 *
 * Registration stays invite-only: an OAuth sign-in creates a Supabase auth
 * user automatically, so a user with no profile yet is gated here. They're let
 * in only if their email has a valid invite (and isn't already an account) —
 * in which case we provision their student profile with the invite's cohort.
 * Everyone else is signed out and turned away.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const fail = (err: string) =>
    NextResponse.redirect(new URL(`/login?error=${err}`, request.url));

  if (!code) return fail("invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("invalid");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("invalid");

  // Already provisioned (returning OAuth user, or magic-link login) → let in.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) return NextResponse.redirect(new URL(next, request.url));

  // First-time OAuth user with no profile — gate against the invite list.
  const admin = createAdminClient();
  const reject = async (err: string) => {
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
    await supabase.auth.signOut();
    return fail(err);
  };

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return reject("invalid");

  // The email already belongs to an account → use that sign-in method instead.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return reject("existing");

  // Must have a valid invite.
  const { data: inviteRows } = await admin
    .from("invites")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1);
  const invite = (inviteRows?.[0] ?? null) as Invite | null;
  if (
    !invite ||
    inviteProblem({ acceptedAt: invite.accepted_at, expiresAt: invite.expires_at })
  ) {
    return reject("noaccount");
  }

  // Provision the student profile from the invite (cohort included).
  const name = String(
    user.user_metadata?.full_name || user.user_metadata?.name || email
  ).slice(0, 80);
  const { error: insertError } = await admin.from("profiles").insert({
    id: user.id,
    role: "student",
    name,
    email,
    status: "active",
    cohort_id: invite.cohort_id,
  });
  if (insertError) return reject("invalid");

  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.redirect(new URL(next, request.url));
}
