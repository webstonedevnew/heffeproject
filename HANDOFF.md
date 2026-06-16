# Handoff — cohorts (Grade 11/12) + pictures on responses

Branch: `feature/cohorts-and-image-replies`

Two features were added to the TOK Journal forum:

1. **One site, two year groups.** 11th- and 12th-graders share a single
   deployment/domain but never see each other's content.
2. **Pictures on responses & replies.** Students can attach images (and other
   files) to the contributions they write, not just to teacher posts.

---

## 1. Cohorts (year groups)

### Model
- New table **`cohorts`** (`key`, `name`, `position`) seeded with `g11` / `g12`.
- **`profiles.cohort_id`** — a student's grade. `NULL` for the teacher, who
  sees and manages every cohort.
- **`invites.cohort_id`** — the grade a pending invite will join.
- **`posts.cohort_id`** — the grade an assignment targets. `NULL` = shared with
  every cohort (e.g. Coffee Corner / announcements).
- Comments inherit their post's cohort (no column of their own).

### Where separation is enforced
Primarily in **Postgres RLS** (`supabase/migrations/0004_cohorts.sql`) so it
holds even against a direct API call with the anon key:
- `posts_select`, `comments_select`, `attachments_select` were re-scoped with a
  helper `post_in_my_cohort(cohort_id)` (teacher → always; shared post → always;
  otherwise the viewer's `cohort_id` must match).
- **Search needs no change** — `search_content` runs with invoker rights, so the
  re-scoped table policies filter it automatically.
- Students can't change their own cohort: `cohort_id` is deliberately outside
  the `profiles` column-update grant; the teacher moves students via the service
  role (`setStudentCohort`).

The pure mirror of these rules lives in `src/lib/cohorts.ts`
(`studentsInCohort`, `canSeeCohort`, `cohortName`) and is unit-tested in
`tests/cohorts.test.ts`.

### App-layer changes
- **New post** (`PostForm` + `new-post` page): a year-group selector
  (Grade 11 / Grade 12 / **All grades**). `createPost` stores `cohort_id`.
- **Feed/cards**: teacher gets grade-filter pills on the home page and a cohort
  badge on each card / on the post page. Students are scoped by RLS.
- **Participation** (`participation-data.ts`): now scores each post against
  *its cohort's* students only (`rosterByPost`). Dashboard, CSV export and the
  reminder cron all use the per-post roster, so "12/20 complete" and deadline
  reminders are grade-correct.
- **Notifications**: a new-assignment notification only fans out to the
  targeted cohort (shared posts → everyone).
- **Invites/students admin**: invite form picks a grade; pending invites show
  it; each student row has a grade selector; accepting an invite copies its
  cohort onto the new profile.
- **Seed**: creates both cohorts; demo students 1–3 → Grade 11 (with the
  existing demo assignment), demo student 4 → Grade 12 with its own assignment,
  so the split is visible immediately.

## 2. Pictures on responses & replies
- The `attachments` table already supported `comment_id`; nothing schema-wise
  was needed beyond the cohort gate above.
- `CommentComposer` gained an image picker (multi-select, thumbnail previews,
  remove buttons). On submit it uploads to the private `attachments` bucket and
  passes the files to `createComment`, which writes `attachments` rows linked to
  the new comment.
- The post page loads attachments for every comment and renders images as
  inline thumbnails (click → full size) and any non-image files as download
  links — matching how post attachments already look.
- GDPR erasure already covers these (files live under `<userId>/…` and the rows
  cascade on account/comment delete).

---

## How to deploy the change
1. **Run the new migration** `supabase/migrations/0004_cohorts.sql` (CLI
   `supabase db push`, or paste it into the SQL editor after 0001–0003). It is
   additive and safe on an existing DB: existing posts keep `cohort_id = NULL`
   (shared), so nothing disappears — re-target them from the UI as needed.
2. Assign existing students to a grade on **Teacher → Students**.
3. (Optional) re-run `npm run seed` on a dev DB for demo content.

## Verification — NOT yet run here
Node/npm were not available on the machine where this was written, so the
type-check, tests and build have **not** been run. Please run:

```sh
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest (includes the new tests/cohorts.test.ts)
npm run build       # next production build
```

Then a manual smoke test:
- Sign in as the teacher → post an assignment to Grade 11, another to Grade 12,
  one to All grades.
- Sign in as a Grade 11 demo student → should see the Grade 11 + All-grades
  posts only; search and groups must not surface Grade 12 content.
- As a student, write a response and attach a picture → it renders for the
  teacher and same-grade classmates; confirm a different-grade student can't.
