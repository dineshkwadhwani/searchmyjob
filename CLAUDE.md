# SearchMyJob AI — Claude Code Context

## What This App Is
A modern, AI-driven job search SaaS application built for Indian job seekers. Users can search LinkedIn and Naukri simultaneously via Apify actors, match their resume to job descriptions using Groq AI, and get their resume customized for specific roles. Credits are purchased via Razorpay.

## Tech Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS (dark theme, slate/violet palette)
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions in Deno)
- **AI:** Groq API — model `llama-3.3-70b-versatile` (user brings own key)
- **Job Scraping:** Apify actors (user brings own key)
- **Payments:** Razorpay (India, INR)
- **Mobile:** Capacitor (wraps web app)

## Apify Actors
- LinkedIn: `dineshwadhwani/linkedin-jobs-scraper`
  - Input: `{ roles: string[], skills: string[], locations: string[], timeFrame: 'r86400'|'r172800'|'r604800'|'r1296000' }`
- Naukri: `dineshwadhwani/naukri-job-scrapper`
  - Input: `{ roles: string[], skills: string[], locations: string[], timeFrame: '1'|'2'|'7'|'15' }`
- Max 3 roles, 3 locations, 3 skills per actor call
- Naukri timeFrame mapping: r86400→'1', r172800→'2', r604800→'7', r1296000→'15'

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
  App.tsx                    — Router, auth guard, role-based routing
  main.tsx
  index.css                  — Tailwind + custom classes
  context/
    AuthContext.tsx           — useAuth() hook, profile state
  lib/
    supabase.ts              — Supabase client
    constants.ts             — TIME_FRAME_OPTIONS, PLATFORM_OPTIONS, NAUKRI_TIME_MAP, etc.
  types/
    index.ts                 — All TypeScript interfaces
  components/
    ui/index.tsx             — Shared components: Button, Input, Select, Card, Badge, TagInput, MatchScoreRing, etc.
    layout/AppLayout.tsx     — Sidebar nav, mobile overlay, credits pill
  pages/
    auth/
      LoginPage.tsx          — Split screen with animated left panel
      RegisterPage.tsx
    jobseeker/
      SearchPage.tsx         — Main search + job cards + match inline
      JobBucketPage.tsx      — Applied jobs list
      WalletPage.tsx         — Credits, Razorpay top-up, ledger
      CustomizePage.tsx      — AI resume customization + PDF download
      CustomizedResumesPage.tsx — Grid of archived customized resumes
      SettingsPages.tsx      — ResumeSettings, SearchSettings, ApifySettings, GroqSettings (all exported)
    admin/
      AdminPages.tsx         — AdminFeaturesPage, AdminAffiliateKeysPage, AdminUsersPage (all exported)
supabase/
  functions/
    run-search/              — Starts Apify actor runs, deducts credits
    apify-webhook/           — Receives Apify completion, saves job_results, marks run complete
    match-resume/            — Calls Groq for resume match score
    customize-resume/        — Calls Groq to rewrite resume as HTML
    validate-apify-key/      — Tests Apify key against /users/me endpoint
    create-razorpay-order/   — Creates RazorPay order, stores in DB
    razorpay-webhook/        — Verifies payment, credits wallet
```

## Database Tables
- `profiles` — extends auth.users; has role, wallet_credits, apify_key_encrypted, groq_key_encrypted
- `search_config` — one per user; job_titles[], locations[], skills[], time_frame, platform
- `job_runs` — each search execution; status, apify_run_id, apify_run_id_2 (for 'all' platform)
- `job_results` — individual job cards; is_applied flag
- `resumes` — PDF resume; only one active at a time (partial unique index)
- `match_results` — Groq match score + skills breakdown per job+resume pair
- `customized_resumes` — Groq HTML output; expires_at 30 days
- `credit_ledger` — immutable audit trail; never update, only insert
- `feature_config` — admin-controlled credit costs per feature
- `affiliate_keys` — admin-managed referral URLs for Apify + Groq
- `razorpay_orders` — payment attempt tracking

## User Roles
- `superadmin` — seeded for dinesh.k.wadhwani@gmail.com via trigger; sees admin pages only
- `jobseeker` — all other users; sees job search pages

## Key Flows

### Search Flow
1. User clicks "Search My Jobs"
2. Frontend calls Edge Function `run-search`
3. Edge Function starts Apify actor(s), creates `job_runs` row with status='running'
4. Frontend subscribes to Supabase Realtime on that `job_runs` row
5. Apify calls `apify-webhook` when done
6. Webhook saves `job_results`, updates `job_runs` status='completed'
7. Realtime fires → UI shows results

### Match Flow
1. User clicks "Match Resume" on a job card
2. Client extracts PDF text using `pdfjs-dist` (import from `pdfjs-dist`)
3. Calls Edge Function `match-resume` with `{ job_result_id, resume_text }`
4. Edge Function calls Groq, returns score + skills
5. Credit deducted, `match_results` row saved
6. UI shows MatchScoreRing inline on the job card

### Customize Flow
1. User clicks "Customize Resume" (only visible after a match)
2. Client extracts PDF text, calls Edge Function `customize-resume`
3. Groq returns HTML resume content
4. Edge Function saves to `customized_resumes`
5. Frontend renders HTML in a div, user clicks "Save as PDF" → browser print dialog

## Resume PDF Extraction (client-side)
```typescript
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString()

async function extractPdfText(filePath: string): Promise<string> {
  const { data } = await supabase.storage.from('resumes').download(filePath)
  const arrayBuffer = await data!.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item: any) => item.str).join(' ') + '\n'
  }
  return text
}
```

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
```

## Running Locally
```bash
npm install
npm run dev              # Start Vite dev server on :5173
supabase start           # Start local Supabase (requires Supabase CLI)
supabase functions serve # Serve Edge Functions locally
```

## Deploying Edge Functions
```bash
supabase functions deploy run-search
supabase functions deploy apify-webhook
supabase functions deploy match-resume
supabase functions deploy customize-resume
supabase functions deploy validate-apify-key
supabase functions deploy create-razorpay-order
supabase functions deploy razorpay-webhook
```

## Important Rules for Claude Code
1. **Never lighten the theme** — always dark (slate-950 backgrounds, slate-900 cards)
2. **Violet is the primary color** — buttons, highlights, active states use violet-600
3. **Keys are sensitive** — apify_key_encrypted and groq_key_encrypted are stored in profiles table. Never log or expose them
4. **Credits are atomic** — always use Postgres transactions or sequential DB ops: check balance → deduct → write ledger → call external API
5. **Platform = 'all'** means running BOTH actors and merging results. apify_run_id = LinkedIn run, apify_run_id_2 = Naukri run
6. **TagInput max** = 3 (actors cap at 3 roles, 3 locations, 3 skills)
7. **One active resume** per user — enforced by partial unique index in DB
8. **Customized resumes expire** in 30 days — check expires_at before showing download
9. **Realtime subscription** on job_runs table drives the async search UX — don't replace with polling
10. **PDF output** is generated client-side via browser print dialog — no server PDF generation needed

## Pending / Next Steps (for Claude Code to continue)
- [ ] Add PDF text extraction to SearchPage Match flow (currently missing the client-side pdfjs call before invoking match-resume)
- [ ] Capacitor setup for iOS/Android
- [ ] Push notifications when job run completes (FCM/APNs via Capacitor)
- [ ] ForgotPassword page (currently linked in LoginPage but not implemented)
- [ ] RazorPay webhook secret configuration in Supabase secrets
- [ ] Supabase Edge Function deployment script
- [ ] 30-day expiry cleanup (Postgres cron or Supabase scheduled function to delete expired customized_resumes and Storage files)
- [ ] Rate limiting on Edge Functions
- [ ] Toast notifications (sonner is installed, wire it up to replace Alert components for transient feedback)
