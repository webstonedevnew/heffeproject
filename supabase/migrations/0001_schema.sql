-- TOK Forum — core schema
-- Run with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('teacher', 'student');
create type public.user_status as enum ('active', 'deactivated');

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users; only name + email are collected — GDPR)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'student',
  name text not null,
  email text not null unique,
  status public.user_status not null default 'active',
  locale text not null default 'en' check (locale in ('en', 'hu')),
  notification_prefs jsonb not null default
    '{"email_new_assignment": true, "email_reply": true, "email_reminder": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invites (registration is closed; teacher invites by email)
-- ---------------------------------------------------------------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_email_idx on public.invites (email);

-- ---------------------------------------------------------------------------
-- Groups (every student is implicitly a member of every group)
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Posts (top-level threads; teacher-only via RLS)
-- body_html is sanitized server-side before insert; body_text feeds search.
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body_html text not null default '',
  body_text text not null default '',
  due_at_response timestamptz,
  due_at_replies timestamptz,
  pinned boolean not null default false,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body_text, ''))
  ) stored
);

create index posts_group_created_idx on public.posts (group_id, created_at desc);
create index posts_search_idx on public.posts using gin (search);

-- ---------------------------------------------------------------------------
-- Comments: top-level comment = a student's "own response" to an assignment;
-- a comment with parent_comment_id = a peer reply. Max depth 1 (trigger).
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body_html text not null default '',
  body_text text not null default '',
  audio_path text,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', coalesce(body_text, ''))
  ) stored
);

create index comments_post_idx on public.comments (post_id, created_at);
create index comments_parent_idx on public.comments (parent_comment_id);
create index comments_search_idx on public.comments using gin (search);

create or replace function public.enforce_comment_rules()
returns trigger
language plpgsql
as $$
declare
  parent record;
begin
  if new.parent_comment_id is not null then
    select post_id, parent_comment_id into parent
    from public.comments where id = new.parent_comment_id;
    if parent is null then
      raise exception 'Parent comment does not exist';
    end if;
    if parent.parent_comment_id is not null then
      raise exception 'Comments can only be nested one level deep';
    end if;
    if parent.post_id <> new.post_id then
      raise exception 'Reply must belong to the same post as its parent';
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_enforce_rules
  before insert or update on public.comments
  for each row execute function public.enforce_comment_rules();

-- ---------------------------------------------------------------------------
-- Attachments (files live in the private "attachments" storage bucket)
-- ---------------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id) = 1)
);

create index attachments_post_idx on public.attachments (post_id);
create index attachments_comment_idx on public.attachments (comment_id);

-- ---------------------------------------------------------------------------
-- Reactions (on posts or comments, one emoji per user per target)
-- ---------------------------------------------------------------------------
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id) = 1),
  unique nulls not distinct (user_id, post_id, comment_id, emoji)
);

create index reactions_post_idx on public.reactions (post_id);
create index reactions_comment_idx on public.reactions (comment_id);

-- ---------------------------------------------------------------------------
-- Post views (unique per user; count = "seen by N")
-- ---------------------------------------------------------------------------
create table public.post_views (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Flags (students flag content for the teacher)
-- ---------------------------------------------------------------------------
create table public.flags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  flagged_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null default '',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id) = 1)
);

-- ---------------------------------------------------------------------------
-- Notifications (in-app; email delivery handled by the app per prefs)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in
    ('new_assignment', 'reply', 'reminder_response', 'reminder_replies', 'flag')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Reminder bookkeeping (so the cron never double-sends)
-- ---------------------------------------------------------------------------
create table public.reminders_sent (
  post_id uuid not null references public.posts (id) on delete cascade,
  kind text not null check (kind in ('response', 'replies')),
  sent_at timestamptz not null default now(),
  primary key (post_id, kind)
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger groups_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Full-text search across posts and comments (invoker rights -> RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.search_content(q text)
returns table (
  kind text,
  id uuid,
  post_id uuid,
  post_title text,
  group_slug text,
  group_name text,
  author_name text,
  snippet text,
  created_at timestamptz,
  rank real
)
language sql
stable
as $$
  with query as (select websearch_to_tsquery('simple', q) as tsq)
  select * from (
    select
      'post'::text as kind,
      p.id,
      p.id as post_id,
      p.title as post_title,
      g.slug as group_slug,
      g.name as group_name,
      pr.name as author_name,
      ts_headline('simple', p.body_text, query.tsq,
        'MaxWords=24, MinWords=12, MaxFragments=1') as snippet,
      p.created_at,
      ts_rank(p.search, query.tsq) as rank
    from public.posts p
    join query on p.search @@ query.tsq
    join public.groups g on g.id = p.group_id
    join public.profiles pr on pr.id = p.author_id
    where p.hidden_at is null
    union all
    select
      'comment'::text as kind,
      c.id,
      c.post_id,
      p.title as post_title,
      g.slug as group_slug,
      g.name as group_name,
      pr.name as author_name,
      ts_headline('simple', c.body_text, query.tsq,
        'MaxWords=24, MinWords=12, MaxFragments=1') as snippet,
      c.created_at,
      ts_rank(c.search, query.tsq) as rank
    from public.comments c
    join query on c.search @@ query.tsq
    join public.posts p on p.id = c.post_id
    join public.groups g on g.id = p.group_id
    join public.profiles pr on pr.id = c.author_id
    where c.hidden_at is null and p.hidden_at is null
  ) results
  order by rank desc, created_at desc
  limit 40;
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets (private; files are served via short-lived signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false), ('audio', 'audio', false)
on conflict (id) do nothing;
