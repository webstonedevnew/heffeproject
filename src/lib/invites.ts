/** Invite logic. Token generation lives in server actions (node:crypto). */

export const INVITE_EXPIRY_DAYS = 14;

export interface InviteLike {
  acceptedAt: string | null;
  expiresAt: string;
}

export type InviteProblem = "accepted" | "expired" | null;

export function inviteProblem(
  invite: InviteLike,
  now: Date = new Date()
): InviteProblem {
  if (invite.acceptedAt) return "accepted";
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return "expired";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/**
 * Parse a pasted list of emails (newline-, comma-, semicolon- or
 * space-separated; tolerates "Name <a@b.com>" shapes). Lowercases and dedupes.
 */
export function parseEmailList(raw: string): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(/[\s,;]+/)) {
    if (!piece) continue;
    const candidate = piece.replace(/^.*</, "").replace(/>.*$/, "").trim().toLowerCase();
    if (!candidate) continue;
    if (!isValidEmail(candidate)) {
      invalid.push(piece);
      continue;
    }
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    valid.push(candidate);
  }
  return { valid, invalid };
}
