export type Role = "teacher" | "student";
export type UserStatus = "active" | "deactivated";
export type Locale = "en" | "hu";

export interface NotificationPrefs {
  email_new_assignment: boolean;
  email_reply: boolean;
  email_reminder: boolean;
}

export interface Cohort {
  id: string;
  key: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Profile {
  id: string;
  role: Role;
  name: string;
  email: string;
  status: UserStatus;
  locale: Locale;
  /** Year group. null for the teacher, who sees every cohort. */
  cohort_id: string | null;
  notification_prefs: NotificationPrefs;
  created_at: string;
  updated_at: string;
}

export interface Invite {
  id: string;
  email: string;
  token: string;
  invited_by: string;
  /** Year group the invited student will join. */
  cohort_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  group_id: string;
  author_id: string;
  /** Year group this assignment targets. null = shared with every cohort. */
  cohort_id: string | null;
  title: string;
  body_html: string;
  body_text: string;
  due_at_response: string | null;
  due_at_replies: string | null;
  pinned: boolean;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_id: string;
  body_html: string;
  body_text: string;
  audio_path: string | null;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  uploader_id: string;
  storage_path: string;
  filename: string;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface Reaction {
  id: string;
  user_id: string;
  post_id: string | null;
  comment_id: string | null;
  emoji: string;
  created_at: string;
}

export interface Flag {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  flagged_by: string;
  reason: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export type NotificationType =
  | "new_assignment"
  | "reply"
  | "reminder_response"
  | "reminder_replies"
  | "flag";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: {
    post_id?: string;
    post_title?: string;
    group_slug?: string;
    comment_id?: string;
    actor_name?: string;
    excerpt?: string;
  };
  read_at: string | null;
  created_at: string;
}

export const REACTION_EMOJIS = ["👍", "💡", "🤔", "🎉", "❤️"] as const;
