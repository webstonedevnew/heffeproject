-- TOK Forum — search v3: higher recall + smarter ranking
-- Function only (no table/column changes), so RLS still scopes results per
-- cohort. Run in the SQL editor after 0004.
--
-- Improvements over v2:
--   • Any keyword can match (OR of prefix terms) instead of requiring all of
--     them — so partial / loosely-remembered queries still find things.
--   • Results are ranked by relevance (ts_rank) with a strong boost when the
--     query appears in a post's title, and a smaller boost for body matches.
--   • A substring (ILIKE) fallback catches matches in the middle of a word or
--     across punctuation that prefix full-text search would miss.

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
  with raw as (
    select
      lower(trim(coalesce(q, ''))) as q_text,
      (
        select array_agg(w)
        from (
          select regexp_replace(word, '[^[:alnum:]]+', '', 'g') as w
          from unnest(regexp_split_to_array(lower(trim(coalesce(q, ''))), '\s+')) as word
        ) s
        where w <> ''
      ) as words
  ),
  query as (
    select
      q_text,
      '%' || q_text || '%' as ilike_q,
      to_tsquery(
        'simple',
        nullif((select string_agg(w || ':*', ' | ') from unnest(words) as w), '')
      ) as tsq
    from raw
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
      ts_headline('simple', p.body_text,
        coalesce(query.tsq, plainto_tsquery('simple', query.q_text)),
        'MaxWords=24, MinWords=12, MaxFragments=1') as snippet,
      p.created_at,
      (
        coalesce(ts_rank(p.search, query.tsq), 0)
        + case when query.q_text <> '' and lower(p.title) like query.ilike_q then 1.0 else 0 end
        + case when query.q_text <> '' and lower(p.body_text) like query.ilike_q then 0.3 else 0 end
      )::real as rank
    from public.posts p
    cross join query
    join public.groups g on g.id = p.group_id
    join public.profiles pr on pr.id = p.author_id
    where p.hidden_at is null
      and (
        (query.tsq is not null and p.search @@ query.tsq)
        or (query.q_text <> '' and lower(p.title) like query.ilike_q)
        or (query.q_text <> '' and lower(p.body_text) like query.ilike_q)
      )
    union all
    select
      'comment'::text as kind,
      c.id,
      c.post_id,
      p.title as post_title,
      g.slug as group_slug,
      g.name as group_name,
      pr.name as author_name,
      ts_headline('simple', c.body_text,
        coalesce(query.tsq, plainto_tsquery('simple', query.q_text)),
        'MaxWords=24, MinWords=12, MaxFragments=1') as snippet,
      c.created_at,
      (
        coalesce(ts_rank(c.search, query.tsq), 0)
        + case when query.q_text <> '' and lower(c.body_text) like query.ilike_q then 0.5 else 0 end
      )::real as rank
    from public.comments c
    cross join query
    join public.posts p on p.id = c.post_id
    join public.profiles pr on pr.id = c.author_id
    join public.groups g on g.id = p.group_id
    where c.hidden_at is null and p.hidden_at is null
      and (
        (query.tsq is not null and c.search @@ query.tsq)
        or (query.q_text <> '' and lower(c.body_text) like query.ilike_q)
      )
  ) results
  order by rank desc, created_at desc
  limit 50;
$$;
