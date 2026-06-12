/**
 * Pure permission rules. RLS in the database enforces the same rules; these
 * exist so the UI and server actions can decide fast and be unit-tested.
 */

export const EDIT_WINDOW_MINUTES = 30;

export type Role = "teacher" | "student";

export interface Actor {
  id: string;
  role: Role;
  status: "active" | "deactivated";
}

export interface OwnedContent {
  authorId: string;
  createdAt: string; // ISO timestamp
}

export function isActive(actor: Actor): boolean {
  return actor.status === "active";
}

export function canCreatePost(actor: Actor): boolean {
  return isActive(actor) && actor.role === "teacher";
}

export function canComment(actor: Actor): boolean {
  return isActive(actor);
}

export function canModerate(actor: Actor): boolean {
  return isActive(actor) && actor.role === "teacher";
}

/** Edit or delete a piece of content (post or comment). */
export function canModifyContent(
  actor: Actor,
  content: OwnedContent,
  now: Date = new Date()
): boolean {
  if (!isActive(actor)) return false;
  if (actor.role === "teacher") return true;
  if (content.authorId !== actor.id) return false;
  const ageMs = now.getTime() - new Date(content.createdAt).getTime();
  return ageMs < EDIT_WINDOW_MINUTES * 60 * 1000;
}

export function canViewParticipationDashboard(actor: Actor): boolean {
  return canModerate(actor);
}

export function canManageUsers(actor: Actor): boolean {
  return canModerate(actor);
}
