"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // registration is closed — invite only
      emailRedirectTo: siteUrl("/auth/callback"),
    },
  });

  if (error) {
    const noAccount = /signup|not allowed|not found/i.test(error.message);
    redirect(`/login?error=${noAccount ? "noaccount" : "invalid"}`);
  }
  // Carry the email so the next screen can offer code entry (which signs in
  // THIS device — handy when the email is read on a different device).
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}

/**
 * Finish sign-in with the 6-digit code from the email. Unlike clicking the
 * link, this logs in the device the code is typed on — so you can request it on
 * your laptop, read it off your phone, and the laptop is the one that's signed
 * in. Stateless (no PKCE cookie), so it works across devices.
 */
export async function verifyMagicCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Codes are 6–10 digits depending on the Supabase "Email OTP Length" setting.
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  const back = `/login?sent=1&email=${encodeURIComponent(email)}`;
  if (!email || token.length < 4) redirect(`${back}&error=code`);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) redirect(`${back}&error=code`);
  redirect("/");
}

export async function passwordSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid&mode=password");
  redirect("/");
}
