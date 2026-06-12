import "server-only";
import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/**
 * Sends a transactional email. In development without a RESEND_API_KEY it
 * logs to the console instead of failing, so the app stays usable.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const client = getResend();
  if (!client) {
    console.warn(`[email skipped — no RESEND_API_KEY] to=${opts.to} subject="${opts.subject}"`);
    return;
  }
  try {
    await client.emails.send({
      from: process.env.EMAIL_FROM ?? "TOK Journal <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    // Email failures must never break the user-facing action.
    console.error("Failed to send email:", err);
  }
}

/** Spartan, readable email shell — no images, no trackers. */
export function emailLayout(opts: {
  greeting: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footer: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${opts.cta.url}" style="background:#1f1b16;color:#faf7f2;padding:10px 18px;text-decoration:none;border-radius:4px;display:inline-block">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#faf7f2;color:#1f1b16;font-family:Georgia,'Times New Roman',serif;line-height:1.6">
  <div style="max-width:540px;margin:0 auto">
    <p>${esc(opts.greeting)}</p>
    ${opts.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n")}
    ${cta}
    <p style="color:#6b6257;font-size:14px;margin-top:32px">${esc(opts.footer)}</p>
  </div>
</body></html>`;
}
