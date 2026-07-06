# SearchMyJob AI — Claude Code Context

## What This App Is
A modern, AI-driven job search SaaS application built for Indian job seekers. Users can search LinkedIn, Naukri, and Indeed (individually or all at once) via Apify actors, match their resume to job descriptions using Groq AI, get their resume customized for specific roles, and run their resume through a deterministic ATS (Applicant Tracking System) scoring engine with an optional AI-powered rewrite. Credits are purchased via Razorpay.

## Tech Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS (dark theme, slate/violet palette)
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions in Deno)
- **AI:** Groq API — model `llama-3.3-70b-versatile` (user brings own key)
- **Job Scraping:** Apify actors (user brings own key)
- **Payments:** Razorpay (India, INR) — client-side signature verification, not a webhook (see Payment Flow below)
- **PDF generation (AI-produced resumes):** `pdfmake` — generates PDFs directly client-side with deterministic margins (see PDF Generation below)
- **PDF/DOCX text extraction (user-uploaded resumes):** `pdfjs-dist` (PDF) + `mammoth` (DOCX)
- **Mobile:** Capacitor (wraps web app) — not yet implemented, see Pending

## Search Platforms & Actor Configuration
Search platforms are `linkedin` | `naukri` | `indeed` | `all`. **Every platform — including `all` — maps to exactly one Apify actor call.** `all` is NOT "run LinkedIn + Naukri and merge" (that was the old design); it's a single dedicated multi-platform actor.

**Actor IDs are NOT hardcoded.** They live in the `actor_config` table, managed from **Super Admin → Actor Configuration** (`/admin/actor-config`). `run-search` reads this table at request time; hardcoded constants in the edge function are fallback defaults only, used if a DB row is somehow missing. To point at a renamed/replaced actor, update it in the admin UI — no code change or deploy needed.

Current actors (defaults / current DB values — check the admin page for the live values):
- `linkedin` → `dineshwadhwani/linkedin-jobs-scraper` — Input: `{ roles, skills, locations, timeFrame: 'r86400'|'r172800'|'r604800'|'r1296000' }`
- `naukri` → `dineshwadhwani/naukri-job-scrapper` — Input: `{ roles, skills, locations, timeFrame: '1'|'2'|'7'|'15' }` (mapped from the app's `r*` format)
- `indeed` → `dineshwadhwani/indeed-job-scrapper` — Input: `{ roles, skills, locations, timeFrame: '1'|'3'|'7'|'14', maxJobs: 100 }` (mapped from `r*`, rounding UP to the nearest wider bucket since Indeed has no exact 2-day/15-day option)
- `all` → `dineshwadhwani/multiplatform-job-scrapper` — Input: `{ roles, skills, locations, timeFrame: '1'|'7'|'15' }` (mapped from `r*` via `ALL_PLATFORMS_TIME_MAP`, rounding UP to the nearest wider bucket — confirmed from the actor's own validation error, which only accepts `"", "1", "7", "15"`, i.e. Naukri's format minus the 48-hour option; no `maxJobs` field observed to be needed/accepted)
- Max 3 roles, 3 locations, 3 skills per actor call (enforced by `TagInput` max, `MAX_ROLES`/`MAX_LOCATIONS`/`MAX_SKILLS` in `constants.ts`)

The admin "Actor Configuration" page accepts either the bare `username/actor-name` slug or a full `apify.com/...` URL and normalizes on save.

`job_runs.apify_run_id_2` is a legacy column from the old dual-actor "all" design — it's no longer written by new searches (every platform now populates only `apify_run_id`), but old historical rows may still have it populated. Don't remove the column or the UI that conditionally displays it.

The webhook (`apify-webhook`) tags each `job_results` row with `item.platform ?? item.source ?? <run-level platform>`, **lowercased** — if the multiplatform actor tags each item with its real source, per-item platform filtering on the Search page works automatically; if not, everything from an "all" run is just tagged `all` and the sub-filter UI doesn't render (it only shows when more than one distinct platform is present in the results). The lowercasing matters: the multiplatform actor tags items `"LinkedIn"`/`"Naukri"` (Title Case), which doesn't match the `search_platform` Postgres enum's lowercase values and silently failed the *entire* batch insert (Postgres rejects the whole multi-row insert on one bad enum value) until this was caught. `job_results.insert()`'s error is now checked and thrown rather than ignored — previously a failed insert still reported the run as `completed` with `result_count: 0`, which is exactly how this bug went unnoticed (actor logs showed real results, DB showed none, no error anywhere). `search_platform` enum values: `linkedin`, `naukri`, `all`, `indeed` (added later — if the enum and this code ever drift again, expect the exact same silent-failure symptom).

## Design System
- **Background:** `bg-slate-950` (near black)
- **Cards:** `glass-card` class = dark bg + backdrop blur + slate border
- **Primary color:** Violet (`violet-600`) with indigo gradient
- **Text:** slate-100 (primary), slate-400 (secondary), slate-500/600 (muted)
- **Borders:** slate-700/50 (subtle)
- **Glow effects:** `glow` and `glow-sm` classes
- **Animations:** float, pulse-slow, shimmer (defined in tailwind.config.js)
- **Buttons:** `btn-primary` (violet gradient), `btn-secondary` (slate), `btn-danger` (red), `btn-ghost`
- DO NOT use light backgrounds. Everything is dark themed.

## Project Structure
```
src/
  App.tsx                    — Router, auth guard, role-based routing, feature-flag route gating
  main.tsx
  index.css                  — Tailwind + custom classes
  context/
    AuthContext.tsx           — useAuth() hook, profile state, isFeatureEnabled(name) helper
  lib/
    supabase.ts              — Supabase client
    constants.ts             — TIME_FRAME_OPTIONS, PLATFORM_OPTIONS, MAX_* limits, CREDIT_PACKAGES, format helpers
    pdf.ts                   — extractPdfText/extractPdfTextWithPageCount (pdfjs-dist) — also extracts PdfVisualInfo
                                (fonts, margins, images, column layout) genuinely from PDF internals, used by the
                                ATS scoring engine. See "PDF Visual Analysis" below.
    resumeParsing.ts         — parseResumeFile(file): unified PDF/DOCX/TXT → text entry point for the ATS Evaluator
    resumePdf.ts             — downloadResumeAsPdf(html, filename) via pdfmake — see "PDF Generation" below
    atsScoring.ts            — analyzeResume(): deterministic, rule-based ATS scoring engine (NOT AI-based)
  types/
    index.ts                 — All TypeScript interfaces + FeatureName/SearchPlatform/CreditTxType unions
  components/
    ui/index.tsx             — Shared components: Button, Input, Select, Card, Badge, TagInput, MatchScoreRing, etc.
    layout/
      AppLayout.tsx          — Sidebar nav (feature-flag filtered), mobile overlay, credits pill
      Footer.tsx             — Single-line footer (links to legal pages)
    ats/
      ScoreResults.tsx       — ATS score breakdown UI (overall ring, category bars, strengths, recommendations w/ evidence)
      RewriteModal.tsx       — AI rewrite before/after comparison + PDF download
  pages/
    auth/
      LoginPage.tsx          — Split screen with animated left panel
      RegisterPage.tsx
      ForgotPasswordPage.tsx
    legal/
      LegalPageLayout.tsx
      PrivacyPolicyPage.tsx
      TermsOfServicePage.tsx
    jobseeker/
      DashboardPage.tsx      — Default landing page: connector status, search config status, activity tiles
      SearchPage.tsx         — Main search + job cards + match inline; up to 3 saved search config tiles
      JobBucketPage.tsx      — Applied jobs list
      WalletPage.tsx         — Credits, Razorpay top-up, ledger
      CustomizePage.tsx      — AI resume customization + PDF download (pdfmake)
      CustomizedResumesPage.tsx — Grid of archived customized resumes
      AtsEvaluatorPage.tsx   — ATS Resume Evaluator: upload → score → optional AI rewrite → PDF download
      SettingsPages.tsx      — ResumeSettings, SearchSettings, ApifySettings, GroqSettings (all exported)
    admin/
      AdminPages.tsx         — AdminFeaturesPage, AdminActorConfigPage, AdminAffiliateKeysPage, AdminUsersPage (all exported)
supabase/
  functions/
    run-search/              — Starts one Apify actor run (per actor_config), deducts credits
    apify-webhook/           — Receives Apify completion, saves job_results, marks run complete
    match-resume/            — Calls Groq for resume match score
    customize-resume/        — Calls Groq to rewrite resume as HTML (tailored to a specific job)
    ats-rewrite-resume/      — Calls Groq to rewrite resume as HTML (general ATS optimization, no job-specific tailoring)
    validate-apify-key/      — Tests Apify key against /users/me endpoint
    create-razorpay-order/   — Creates RazorPay order, stores in DB
    verify-razorpay-payment/ — Client-invoked signature verification + credit grant (the ACTIVE payment-confirmation path)
    razorpay-webhook/        — Legacy webhook-based verification; kept deployed but not the active path (webhook delivery
                                was unreliable, superseded by verify-razorpay-payment — don't assume this fires)
    admin-user-status/       — Superadmin-only. Aggregates a target user's 7 dashboard-equivalent rows (Apify, Groq,
                                Resume, Search Config, Wallet, Applied, Customized) for the "Setup Status" modal
    send-setup-help-email/   — Superadmin-only. Recomputes the 4 core services server-side (never trusts the client's
                                list) and emails the user a branded HTML breakdown of what's missing + why + how to
                                fix it, via Resend. No-ops with a 400 if all 4 are already set up.
    extract-profile-from-resume/ — Calls Groq to parse a resume into structured Candidate Profile fields (see below).
                                Does NOT write to the database — returns the extracted JSON only; the client merges
                                it into the on-page form for review, and nothing persists until the user hits Save.
                                Credit-gated via the `profile_extract` feature, same pattern as match/customize.
                                Same anti-omission pattern as customize-resume: the prompt explicitly forbids
                                summarizing/condensing (the model's default instinct is to shorten a "summary"
                                field down to one sentence, and to skip older jobs from "workExperience" — both
                                observed in testing), max_tokens raised to 8000, and finish_reason==='length' is
                                checked and thrown as an actionable error rather than silently returning a
                                truncated/incomplete JSON payload.
```

## Database Tables
- `profiles` — extends auth.users; role, wallet_credits, apify_key_encrypted, groq_key_encrypted, has_seen_welcome
- `search_config` — up to 3 per user (`MAX_SEARCH_CONFIGS`); name, job_titles[], locations[], skills[], time_frame, platform
- `job_runs` — each search execution; status, platform, apify_run_id (+ legacy apify_run_id_2), result_count, credits_charged
- `job_results` — individual job cards; platform, description (stripped to plain text, capped 1000 chars), is_applied flag
- `resumes` — uploaded resume file; only one active at a time (partial unique index on is_active)
- `match_results` — Groq match score + skills breakdown per job+resume pair
- `customized_resumes` — Groq HTML output (job-tailored via customize-resume); expires_at 30 days
- `credit_ledger` — immutable audit trail; never update, only insert. `type` includes `ats_rewrite` for the ATS Evaluator's AI rewrite
- `feature_config` — admin-controlled `{feature, credit_cost, is_premium, is_enabled}` per `FeatureName`; publicly readable (RLS), superadmin-writable
- `actor_config` — admin-controlled `{platform, actor_id}` per `SearchPlatform` — see "Search Platforms & Actor Configuration" above. Superadmin-only RLS (no public read — unlike feature_config, jobseekers never need this)
- `affiliate_keys` — admin-managed referral URLs for Apify + Groq
- `razorpay_orders` — payment attempt tracking
- `profile_details` — 1 row per user; all scalar Candidate Profile fields (Core Identity + Contact/Address). PK is `user_id` itself (upserted, not inserted). Note: `currentRole` is stored as `current_job_role` — `current_role` is a reserved Postgres keyword.
- `profile_tags` — flattens 8 conceptually-array fields (skills, tools, technologies, certificationsKeywords, industries, domains, functionalAreas, specializations) into one table via a `tag_type` text column, instead of 8 near-identical tables. `tag_type` is deliberately **not** an enum — see the `search_platform` incident below for why an externally/AI-influenced value going into an enum column is dangerous.
- `profile_languages`, `profile_work_experience`, `profile_education`, `profile_certifications` — one child table each, straightforward 1:many on `user_id`.
- `profile_portfolio_items` — flattens 10 conceptually-similar concepts (projects, patents, publications, case studies, GitHub repos, apps, product launches, speaking engagements, blogs, videos) into one table via an `item_type` text column, same reasoning as `profile_tags`.
- All 7 profile_* tables: owner-only RLS (`auth.uid() = user_id`), no superadmin access (personal data, not needed for admin flows today). Saving from `ProfilePage` **wholesale replaces** each child table's rows for that user (delete-all-then-reinsert) rather than diffing — simple, avoids id-matching complexity, at the cost of every save assigning fresh row ids.

## User Roles
- `superadmin` — seeded for dinesh.k.wadhwani@gmail.com via trigger; sees admin pages only
- `jobseeker` — all other users; sees job search pages. Gets 10 signup-bonus credits (`credit_ledger.type = 'signup_bonus'`)

## Feature Flag System
`feature_config` rows gate features by `FeatureName`. `AuthContext.isFeatureEnabled(name)` is the generic check (fails open — returns `true` if no row exists for that name). `ALWAYS_ON_FEATURES = ['search', 'apply']` can't be toggled off from the admin UI.

Current `FeatureName`s: `search`, `apply`, `match`, `customize`, `all_platforms`, `indeed`, `wallet`, `ats_evaluator`, `ats_rewrite`, `profile_extract`.

**Important nuance — cascading flags:** `ats_evaluator` and `ats_rewrite` are deliberately split into two independent flags with a one-way dependency: `ats_evaluator` gates the *entire* ATS Evaluator feature (page route + nav item), while `ats_rewrite` gates *only* the "Rewrite My Resume" AI action within that page. Turning `ats_evaluator` off makes the whole feature (including rewrite) unreachable via routing — there's no separate cascade check needed. Turning `ats_rewrite` off alone leaves scoring available but hides the rewrite button. The `ats-rewrite-resume` edge function checks both flags server-side as a backstop.

`all_platforms` and `indeed` gate the platform selector in `SearchSettings` and the credit-sufficiency check in `SearchPage`/`run-search` — both patterns are duplicated by hand in a few places (not routed through `isFeatureEnabled`) because they need the numeric `credit_cost`, not just the boolean. If adding a new premium platform, follow the existing `all_platforms`/`indeed` pattern in both `SettingsPages.tsx` and `SearchPage.tsx`.

## Key Flows

### Search Flow
1. User clicks "Search Now" on a saved search config tile
2. Frontend calls Edge Function `run-search`
3. Edge Function looks up the actor for `config.platform` from `actor_config`, starts that one Apify actor run, creates a `job_runs` row with status='running'
4. Frontend subscribes to Supabase Realtime on that `job_runs` row and shows a "this can take up to 3 minutes" banner
5. Apify calls `apify-webhook` when done
6. Webhook saves `job_results` (tagging each row's platform from the item itself if the actor provides it, else the run-level platform), updates `job_runs` status='completed'
7. Realtime fires → UI shows results, with a platform sub-filter if more than one distinct platform is present

### Match Flow
1. User clicks "Match Resume" on a job card
2. Client extracts PDF text using `pdf.ts` → `extractPdfText`
3. Calls Edge Function `match-resume` with `{ job_result_id, resume_text }`
4. Edge Function calls Groq, returns score + skills; classifies Apify/Groq failures into actionable messages (funds/quota vs. generic) rather than raw API errors
5. Credit deducted, `match_results` row saved
6. UI shows MatchScoreRing inline on the job card

### Customize Flow (job-tailored rewrite)
1. User clicks "Customize Resume" (only visible after a match)
2. Client extracts PDF text, calls Edge Function `customize-resume`
3. Groq returns HTML resume content (anti-omission prompt: explicitly instructed not to drop/shorten content, doubled max_tokens, checks `finish_reason==='length'`)
4. Edge Function saves to `customized_resumes`
5. Frontend renders HTML in a div; "Save as PDF" generates the PDF directly via `resumePdf.ts` (pdfmake) — see PDF Generation below

### ATS Resume Evaluator Flow
1. User uploads a PDF/DOCX/TXT resume on `AtsEvaluatorPage` → `parseResumeFile()` (`resumeParsing.ts`) extracts text; for PDF also extracts `PdfVisualInfo` (see below)
2. `analyzeResume()` (`atsScoring.ts`) runs entirely client-side, no AI call, no credit cost — a deterministic rule-based scorer across 6 weighted categories (File Format 10%, Formatting 15%, Structure 15%, Keywords & Content 40%, Content Quality 20%, Dates & Work History 5%)
3. Results show an overall score, category breakdown, top strengths, and top 5 recommendations — each recommendation is phrased as the actual problem (not the passing-condition label) and includes concrete evidence pulled from the resume itself (offending bullet excerpts, detected repeated words, etc.) so the user can verify what was flagged rather than trust a black box
4. Optional "Rewrite My Resume" (gated by `ats_rewrite` flag + credits) calls `ats-rewrite-resume`, which prompts Groq to rewrite for general ATS best practices (no job-description tailoring — deliberately removed; this feature is NOT about matching a specific job posting) while preserving length/content and merging true duplicates rather than padding
5. The rewritten HTML is re-analyzed with the same `analyzeResume()` (via `htmlToPlainText()`) for a genuine before/after score comparison — not a fabricated estimate
6. "Download as PDF" uses `resumePdf.ts` (pdfmake), same as Customize

### Admin "Setup Status" & Send Help Flow
1. Superadmin clicks a jobseeker's email in **Manage Users** (`/admin/users`) — superadmin rows aren't clickable, they have no setup checklist
2. Opens a modal calling `admin-user-status`, showing the same 7 rows as the jobseeker's own Dashboard: 4 core services (Apify, Groq, Resume, Search Config — green/red) + 3 activity stats (Wallet, Applied, Customized — informational only)
3. If any of the 4 core services is red, a "Send Help Email" button appears, calling `send-setup-help-email`
4. That function **recomputes** which of the 4 are missing itself (never trusts what the client sends) and emails the user a branded HTML breakdown — per missing service: why it's required, numbered setup steps, and a direct link into that Settings page — via the Resend API
5. If a user already has all 4 core services set up, the endpoint returns a 400 rather than sending anything

### Candidate Profile Flow (`/profile`)
1. `ProfilePage` shows the resume upload (shared `ResumeUploadCard` component, also used by `Settings → Resume`) as the first section
2. Below it, an explanation card with two entry points: **"Fill Profile from Resume"** (disabled until a resume is uploaded AND a Groq key is configured — shows an inline `Alert` pointing at Settings → Groq Connector if the key is missing, rather than a toast) and **"Fill Manually"** (just scrolls to the Core Identity section — the full form is always rendered below, whether empty or already filled)
3. "Fill from Resume" downloads the active resume from Storage, extracts text via `extractPdfText` (`pdf.ts`), and calls `extract-profile-from-resume`
4. The edge function's extracted JSON uses **camelCase** keys (`companyName`, `isCurrent`, etc.) that are a deliberate 1:1 mirror of the DB's snake_case columns — `ProfilePage`'s `camelToSnake()` does a blind regex conversion (`companyName` → `company_name`) with no per-field mapping table. If a new field is ever added to the extraction prompt, name it as the exact camelCase form of its snake_case column or this conversion silently produces a key that matches nothing.
5. Extraction **merges into the existing form state** (nothing is saved to the DB yet) — the user reviews/edits every field, including ones the AI got wrong, before anything persists
6. Repeatable sections (Work Experience, Education, Certifications, Portfolio, Languages) use a generic `RepeatableSection` + field-metadata-driven `FieldGrid`/`FieldControl` renderer (`ProfilePage.tsx`) rather than hand-built per-section forms — adding a field to any section means adding one entry to that section's `FieldDef[]` array, not writing new JSX
7. Mandatory fields: first name, last name, phone, current city — everything else (all ~100+ fields) is optional. Validated client-side in `handleSave()`; email/phone format also validated (`profileValidation.ts`) when present. On failure, the Core Identity accordion force-opens and the first invalid field (in on-page order, not validation-check order) is focused + scrolled into view — every `FieldControl` gets an `id` of `${idPrefix}${field.key}` from `FieldGrid` for exactly this.
8. On Save: `profile_details` is upserted (`onConflict: user_id`), then every child table is wholesale-replaced (delete all rows for that user, reinsert current form state) — see the `profile_*` tables note above
9. Every section (Core Identity, Contact, Skills, and each repeatable section) renders as a collapsible accordion — Core Identity/Contact/Skills default open, repeatable sections default open only if they already have items, and `handleSave()`'s validation-failure focus force-opens Core Identity regardless of its current state.
10. Profile photo is a real image upload (not a URL text field) to a public `avatars` Storage bucket (owner-write via RLS, public read since it's rendered as a plain `<img src>`), separate from the private `resumes`/`customized-resumes` buckets. `PhotoUpload` writes straight to `profile_details.profile_photo_url` on upload/remove — unlike every other field, it doesn't wait for "Save Profile" (matches the resume upload's immediate-persist behavior, since it's a file action, not text review).

**Scoring engine limitations (by design, disclosed in-code):** a handful of checks can't be verified from extracted text/PDF internals at all (text color) and are marked `assumed: true`, always awarding full credit rather than faking a result. For DOCX/TXT, ALL visual checks (fonts, margins, images, columns) fall back to assumed-pass too, since `mammoth`/raw-text parsing discards styling entirely — only PDF gets real visual analysis.

## PDF Visual Analysis (`pdf.ts`)
For PDF uploads only, `extractPdfTextWithPageCount()` also returns `PdfVisualInfo`, extracted from pdfjs-dist's low-level text/operator APIs (not just `getTextContent()`'s flat string):
- **Fonts** — via `content.styles[item.fontName].fontFamily`; flags fonts not matching a common ATS-safe pattern
- **Font sizes** — via `item.height` as a proxy (not exact pt value) — flags very-small or wildly-inconsistent sizing, not a strict pt range (avoids penalizing a normal large name header)
- **Margins** — only **left and top** are reported. Right/bottom margins are deliberately NOT computed: with ragged-right, variable-length resume text, "gap to the far edge" mostly reflects how long the longest line happens to be, not the actual margin — this produced real false positives in testing and was removed rather than patched further.
- **Multi-column layout** — detected by finding a left-band line and a right-band line landing at the same page height (a real 2-column layout signature that sequential single-column sections never produce); requires ≥3 such pairs to avoid false positives from incidental right-aligned text (e.g. a date next to a job title)
- **Images** — read directly from the PDF's operator list (`paintImageXObject`/`paintInlineImageXObject`)

This module benefits the Match/Customize flows too (better line-structure reconstruction for Groq), not just the ATS Evaluator.

## PDF Generation (`resumePdf.ts`)
AI-produced resumes (Customize, ATS Rewrite) are rendered to PDF via **`pdfmake`, generating the PDF bytes directly client-side** — NOT the browser print dialog. This was a deliberate architecture change: the previous `window.open()` + `document.write()` + `window.print()` approach relied on the browser's own print-margin behavior (`@page` CSS support is inconsistent across browsers, and stacking body padding with the browser's own default print margin produced unpredictable — sometimes near-zero — real margins). pdfmake sidesteps this entirely: margins (`pageMargins: [54,54,54,54]`, i.e. 0.75in) are baked into the generated PDF bytes, independent of the user's browser/OS.

- `pdfmake` + its bundled Roboto font data (~1.8MB) is **lazy-loaded via dynamic `import()`** only when a download is actually triggered — it is NOT in the main bundle. Always `import('../../lib/resumePdf')` inside the click handler, never as a static top-level import, or it bloats every page load.
- `htmlResumeToPdfContent` is a small hand-written HTML→pdfmake-content translator (h1/h2/h3/p/ul/li only) — it is NOT a general HTML-to-PDF renderer. If the Groq prompts ever start returning other tags, this needs updating.

## Environment Variables
**Frontend (.env.local):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RAZORPAY_KEY_ID=
```
**Edge Functions (supabase/.env or set via `supabase secrets set`):**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RESEND_API_KEY=          # used by send-setup-help-email
RESEND_FROM_EMAIL=       # noreply@searchmyjob.online — must be a domain verified in Resend
RESEND_FROM_NAME=        # "SearchMyJob AI"
SITE_URL=                # https://searchmyjob.online — base URL for links inside the setup-help email
```

**Auth email sender (Reset Password, Confirm Signup, etc.):** configured via Supabase's Management API (`PATCH /v1/projects/{ref}/config/auth`), not the CLI — there's no `supabase` subcommand for this. It points at Resend's SMTP relay (`smtp.resend.com`, user `resend`, password = the Resend API key) with `smtp_sender_name = "SearchMyJob AI"` and `smtp_admin_email = noreply@searchmyjob.online`, replacing Supabase's default shared (dev-only, "Supabase Auth"-branded) mailer. Changing the sender address again means either re-running that PATCH or editing it in Dashboard → Authentication → Settings → SMTP Settings — the two are equivalent.

## Running Locally
```bash
npm install
npm run dev              # Start Vite dev server on :5173 (falls back to :5174+ if in use)
supabase start           # Start local Supabase (requires Supabase CLI)
supabase functions serve # Serve Edge Functions locally
```
`supabase` CLI is a local npm devDependency (`npx supabase ...`), not global — Homebrew install had permission issues. `npx supabase db query --linked "<sql>"` runs SQL directly against the linked project via the Management API without needing the DB password (unlike db push/pull/diff). Enum additions (`alter type ... add value`) must be a separate query call from anything that uses the new value — Postgres requires the addition to commit first.

## Deploying Edge Functions
```bash
supabase functions deploy run-search --use-api
supabase functions deploy apify-webhook --use-api
supabase functions deploy match-resume --use-api
supabase functions deploy customize-resume --use-api
supabase functions deploy ats-rewrite-resume --use-api
supabase functions deploy validate-apify-key --use-api
supabase functions deploy create-razorpay-order --use-api
supabase functions deploy verify-razorpay-payment --use-api
supabase functions deploy razorpay-webhook --use-api
supabase functions deploy admin-user-status --use-api
supabase functions deploy send-setup-help-email --use-api
supabase functions deploy extract-profile-from-resume --use-api
```
`--use-api` deploys without needing Docker.

## Important Rules for Claude Code
1. **Never lighten the theme** — always dark (slate-950 backgrounds, slate-900 cards)
2. **Violet is the primary color** — buttons, highlights, active states use violet-600
3. **Keys are sensitive** — apify_key_encrypted and groq_key_encrypted are stored in profiles table. Never log or expose them
4. **Credits are atomic** — always use Postgres transactions or sequential DB ops: check balance → deduct → write ledger → call external API
5. **Every search platform, including `all`, is a single actor call** — don't reintroduce dual-actor orchestration for "all". Actor IDs come from `actor_config`, not hardcoded strings — see "Search Platforms & Actor Configuration"
6. **TagInput max** = 3 (actors cap at 3 roles, 3 locations, 3 skills)
7. **One active resume** per user — enforced by partial unique index in DB
8. **Customized resumes expire** in 30 days — check expires_at before showing download
9. **Realtime subscription** on job_runs table drives the async search UX — don't replace with polling
10. **PDF output for AI-generated resumes** (Customize, ATS Rewrite) is generated via `pdfmake` directly (`resumePdf.ts`), lazy-loaded on demand — NOT the browser print dialog. Don't reintroduce `window.print()` for these flows; it was replaced specifically because print-margin behavior is unreliable across browsers.
11. **ATS scoring is deterministic, not AI** — `atsScoring.ts`'s `analyzeResume()` has no Groq/LLM call and no credit cost. Only the optional rewrite uses AI.
12. **Recommendation text must describe the failure, not the passing condition** — `atsScoring.ts` check labels (e.g. "No obvious spelling/typing errors") are phrased as the PASS state for use in the strengths list; a separate `issueTexts` map inverts them for the recommendations list. If adding a new check, add both phrasings.
13. **DOCX/TXT never get real visual ATS checks** — only PDF does (see PDF Visual Analysis). Don't silently claim parity across file types in scoring or in UI copy.
14. **Don't put externally/AI-influenced values into a Postgres enum column.** `search_platform` (linkedin/naukri/all) once silently dropped every row of an entire batch insert because an actor tagged items `"LinkedIn"` (wrong case) and Postgres rejects the *whole* multi-row insert on one bad enum value — with no error surfaced, since the insert's `error` wasn't checked either. `profile_tags.tag_type` and `profile_portfolio_items.item_type` are deliberately plain `text`, not enums, for this reason. Always check `{ error }` from a Supabase insert/update rather than letting it fail silently.
15. **Enum additions need a separate committed statement before use** — `alter type ... add value` must run and commit in its own `db query` call before any code that inserts the new value is deployed (Postgres requires this). Use `add value if not exists` to make it safely rerunnable.
16. **Empty-string date/number inputs are not the same as absent values to Postgres.** A cleared `<input type="date">` fires onChange with `''`, and Postgres rejects `''` outright for a `date`/`numeric` column ("invalid input syntax") — a raw, unhelpful DB error with zero field-level highlighting, since it never goes through client-side `validate()`. `ProfilePage.tsx`'s `FieldControl` converts `''` to `undefined` on change for date fields (number fields already did this), and `sanitizeForSave()` is a save-time safety net that does the same for anything already sitting in state (e.g. from a resume-extraction merge). If a new date/number field is added anywhere, route it through this same pattern rather than passing raw input values straight to Supabase.
17. **Tailwind's `@apply`'d `:focus` styles inside a shared component class beat a plain utility class added conditionally at the call site**, because `@apply` bakes the pseudo-class rule directly into that component class in the `components` layer. `ui/index.tsx`'s `.input` class has `focus:border-violet-500/50` baked in this way — so `Input`/`Select`/`Textarea`'s error state must also override `focus:border-*`/`focus:ring-*` explicitly (not just the unfocused `border-*`), or the very field you auto-focus for a validation error visually loses its red border at the exact moment the user's eye lands on it.

## Pending / Next Steps (for Claude Code to continue)
- [ ] Capacitor setup for iOS/Android
- [ ] Push notifications when job run completes (FCM/APNs via Capacitor)
- [ ] 30-day expiry cleanup (Postgres cron or Supabase scheduled function to delete expired customized_resumes and Storage files)
- [ ] Rate limiting on Edge Functions
- [ ] Decide whether to fully remove the unused `razorpay-webhook` function/config (`RAZORPAY_WEBHOOK_SECRET`) now that `verify-razorpay-payment` is the active path, or keep it as a fallback
- [ ] `job_runs.apify_run_id_2` is legacy/unused for new runs — consider a migration to drop it once no historical "all" runs from before the actor-config change need it displayed
