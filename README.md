# BarberFlow

Multi-tenant SaaS for barbershops: an automated phone booking agent, staff calendars, and SMS reminders.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, RLS, pg_cron) · Twilio (Voice + SMS) · Zod · Vitest

## Setup

1. `npm install`
2. Create a Supabase project. Enable the `pg_cron` extension (Database > Extensions).
3. Apply the schema: `npx supabase db push`, or paste each file in `supabase/migrations/` into the SQL editor, oldest first.
4. In Supabase Auth > URL Configuration, set the Site URL. Add `<site>/auth/confirm` to the redirect allow list. Edit the "Confirm signup" and "Invite user" email templates so the link is `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` (use `type=invite` for invites).
5. `cp .env.example .env.local` and fill it in. Then run `npm run check-env`.
6. `npm run dev`

### Twilio

Buy a number. Set its **Voice** webhook to `POST <site>/api/voice/incoming`, its **Call status changes** callback to `POST <site>/api/voice/status` (call duration and final status for analytics), and its **Messaging** webhook to `POST <site>/api/sms/incoming`. Enter the number in Dashboard > Settings. Forward the shop's existing line to it. `TWILIO_WEBHOOK_BASE_URL` must match the URL in the Twilio console exactly, or every webhook is rejected with 403 and a `twilio signature rejected` log line.

`TWILIO_WEBHOOK_BASE_URL` must be the exact public origin Twilio calls, because request signatures are computed over the full URL. For local testing use a tunnel such as `ngrok`.

### Cron

`vercel.json` schedules:

- `/api/cron/reminders` every 15 minutes. It sends SMS reminders for appointments starting 1 to 2 hours from now.
- `/api/cron/archive` nightly. This is a fallback; pg_cron already runs `archive_old_appointments()` at 03:15 UTC.

Both need `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends it automatically when `CRON_SECRET` is set. The Vercel Hobby plan only allows daily crons, so reminders need Pro or an external scheduler.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server (`start` validates env first) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run check-env` | Validate required env vars |
| `npm run audit` | Production dependency audit |

## Architecture

```
src/
  proxy.ts                 CSP nonce, rate limiting, session refresh, /dashboard gate
  app/
    (marketing)/           Home, contact, legal pages (public, indexed)
    (auth)/                Login, signup, server actions
    auth/confirm, signout  Email link verification, POST-only sign-out
    dashboard/             Bento overview, appointments, clients, services, team, settings, account
    api/voice/[step]       Twilio voice state machine (incoming > service > barber > slot > name)
    api/sms/incoming       C/X replies update appointment status
    api/cron/*             Reminders and retention
  lib/
    auth.ts                getSession / requireUser / requireManager
    env.ts, env.server.ts  Zod env validation (public vs server-only)
    validation.ts          Zod schemas, sanitisation, phone normalisation
    time.ts                Timezone math and open-slot search
    voice/                 Call flow, speech/keypad matching, Twilio helpers
supabase/migrations/       Schema, indexes, RLS, triggers, retention job
```

### Multi-tenancy

- Every tenant table has `salon_id`. RLS policies scope reads and writes to `current_salon_id()`.
- Composite foreign keys `(id, salon_id)` stop an appointment from referencing another salon's client, barber, or service, even through the service role.
- Column grants block users from editing `role`, `salon_id`, `email`, or `subscription_status`.
- The service-role client is used only in webhooks, cron, and manager-authorised invites. Every one of those queries filters by `salon_id` explicitly.
- Signup metadata can only *create* a salon. It can never join an existing one. Invited barbers are attached server-side from the manager's session.
- A GiST exclusion constraint prevents double-booking a barber at the database level.

## Production checklist status

**Legal, accessibility, UX**
- Privacy, Terms, Refund, and Cookie pages, with a cookie notice (only essential cookies are used).
- A required consent checkbox at signup. Data collected is limited to what booking needs, and call audio is never stored.
- Skip link, visible focus ring, labelled fields with `aria-describedby` errors, status shown with icon and text (never colour alone), `prefers-reduced-motion`.
- Palette contrast (WCAG AA): ink on canvas 16.9:1, muted text 4.6:1 on canvas and 4.8:1 on white, white on `#047857` 5.5:1.
- No testimonials, ratings, or usage numbers. Business details and LocalBusiness schema come only from real `BUSINESS_*` env values and are hidden when those are empty.

**Security**
- Zod validation on env, every form, and every action. Server actions re-check session and role.
- Supabase Auth handles password hashing (bcrypt). The password policy is at least 10 characters with mixed case and a digit.
- Twilio signature verification, timing-safe cron secret, POST-only sign-out with an origin check, no CORS headers on APIs.
- Rate limits on auth posts and all `/api/*`.
- Security headers: nonce CSP with `strict-dynamic`, HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy, and no `X-Powered-By`.
- CI runs gitleaks, `npm audit`, lint, typecheck, tests, and build. Dependabot runs weekly. `.env*` is git-ignored except `.env.example`.

**SEO and performance**
- Unique title, description, canonical, and `<h1>` on every public page. Breadcrumbs with BreadcrumbList JSON-LD.
- Organization, SoftwareApplication, and LocalBusiness structured data.
- `sitemap.xml`, `robots.txt` (dashboard, API, and auth disallowed), `/llms.txt`, an SVG favicon, and a generated Open Graph image.
- Custom 404 and error boundary. The error boundary never renders internal error messages.
- Production source maps are off. `lucide-react` imports are tree-shaken. Client JS is limited to the sidebar active state, forms, and the cookie banner.

## Known limitations / next steps

- **The rate limiter is in-memory, so it is per instance.** On multi-instance hosting, swap the store in `src/lib/rate-limit.ts` for Redis (for example Upstash).
- **Every page renders dynamically** because the CSP nonce is per request. If marketing pages must be static/CDN-cached, move them to a hash-based CSP.
- **The voice agent uses a deterministic menu** (keypad or speech plus keyword matching), not an LLM. It offers the next 3 open times instead of parsing free-form dates.
- **Prices are in Georgian lari (₾ GEL)** on screen and read out as "lari" by the voice agent. Phone inputs default to +995; bare 9-digit numbers are treated as Georgian. Add a `currency` column to `salons` if you need other currencies.
- **There is no billing integration.** `subscription_status` defaults to `trialing` and only the service role can change it.
- **Have a lawyer review the legal pages** for your jurisdiction before launch.
