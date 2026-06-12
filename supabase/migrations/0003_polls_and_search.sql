-- TOK Forum — polls + prefix search
-- Run this in the Supabase SQL editor (after 0001 and 0002).

-- ---------------------------------------------------------------------------
-- Polls: a teacher post can carry one poll; students vote (single choice,
-- changeable). Results are shown aggregated in the UI.
-- ---------------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts (id) on delete cascade,
  question text not null,
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null,
  position int not null default 0
);

create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- A vote's option must belong to the same poll.
create or replace function public.check_vote_option()
returns trigger
language plpgsql
as $$
begin
  if (select poll_id from public.poll_options where id = new.option_id)
     is distinct from new.poll_id then
    raise exception 'Option does not belong to this poll';
  end if;
  return new;
end;
$$;

create trigger poll_votes_check_option
  before insert or update on public.poll_votes
  for each row execute function public.check_vote_option();

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "polls_select" on public.polls
  for select to authenticated using (public.is_active_member());
create policy "polls_teacher_all" on public.polls
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy "poll_options_select" on public.poll_options
  for select to authenticated using (public.is_active_member());
create policy "poll_options_teacher_all" on public.poll_options
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy "poll_votes_select" on public.poll_votes
  for select to authenticated using (public.is_active_member());
create policy "poll_votes_insert_own" on public.poll_votes
  for insert to authenticated
  with check (public.is_active_member() and user_id = auth.uid());
create policy "poll_votes_delete_own" on public.poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Search v2: prefix matching, so partial words match too
-- ("tech" finds "technology"). Language-agnostic 'simple' config as before.
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
  with query as (
    select to_tsquery(
      'simple',
      nullif(
        (
          select string_agg(w || ':*', ' & ')
          from (
            select regexp_replace(word, '[^[:alnum:]]+', '', 'g') as w
            from unnest(regexp_split_to_array(lower(trim(q)), '\s+')) as word
          ) words
          where w <> ''
        ),
        ''
      )
    ) as tsq
  )
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
    join query on query.tsq is not null and p.search @@ query.tsq
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
    join query on query.tsq is not null and c.search @@ query.tsq
    join public.posts p on p.id = c.post_id
    join public.groups g on g.id = p.group_id
    join public.profiles pr on pr.id = c.author_id
    where c.hidden_at is null and p.hidden_at is null
  ) results
  order by rank desc, created_at desc
  limit 40;
$$;
