# DevskStudio - Project Memory & Architecture

@AGENTS.md

## Tech Stack
- Framework: Next.js 16 (App Router), TypeScript, Tailwind CSS 4.
- Database & Backend: Supabase (PostgreSQL, RLS). Server actions re-check the session and role; RLS is the second line of defence.
  - Role checks: manager pages call `requireManager()`, manager actions use `withSession(true)`, RLS uses `is_manager()`. All three read `profiles.role`.
  - `salons` and `profiles` UPDATEs are column-granted to `authenticated`. A new writable column needs its own `grant update (col)` migration. Without it Postgres returns `42501` and `dbError` shows "forbidden" even to managers. `src/lib/salon-grants.test.ts` checks that every key of `salonSettingsUpdate()` is granted.
  - Voice/SMS webhooks find the salon by exact match of Twilio's `To` (E.164) on `salons.phone_number`. Settings stores numbers as E.164 (`normalizePhone`). Saving settings calls `revalidatePath("/dashboard", "layout")`, so the sidebar AI card shows the new number on the next render.
- i18n: Georgian (default) and English. Marketing pages carry the language in the URL: `/` is Georgian, `/en/...` English (`src/i18n/routing.ts`; `proxy.ts` rewrites `/en/*` onto the same pages and sets `x-bf-locale`, which `getLocale()` reads first). Links on marketing pages use `components/locale-link.tsx`. Dashboard and auth pages stay cookie-based. Every user-facing string goes in both `en.ts` and `ka.ts`.
- Voice Agent: hybrid architecture in `src/lib/voice`.
  - A Twilio state machine (`flow.ts`) owns booking. The LLM never books, offers times or moves the call forward.
  - Keypad and keyword matches (`match.ts`) are handled first. Only unmatched speech goes to the LLM (`understand.ts`).
  - Claude is used when `ANTHROPIC_API_KEY` is set; Groq (`GROQ_API_KEY`) is used otherwise. Any failure counts as "unclear".
  - Azure TTS speaks the replies. Answers containing script other than Georgian or Latin are dropped as "unclear".
  - Shared salon data and booking steps (`listServices`, `nextSlots`, `bookAppointment`, `logCallOutcome`, ...) live in `salon.ts`; both agents use them.
- Web voice agent (no Twilio needed): `/dashboard/voice` page, `components/dashboard/web-voice-agent.tsx`, `POST /api/voice/web`, `lib/voice/web-flow.ts`.
  - Same rules as the phone flow: `web-flow.ts` is a state machine, keyword match first, LLM fallback only, and only the state machine books. It also reads a day/time said up front ("ხვალ ორ საათზე") with `when.ts`, which is deterministic and never uses the LLM. The slot search starts at that time. If that exact slot is free, "კი"/"yes" books it.
  - State is an HMAC-signed, 30-minute token (`web-state.ts`, key derived from `SUPABASE_SERVICE_ROLE_KEY`) that the browser sends back each turn. The salon comes from the dashboard session, never from the request. The route requires the `x-bf-voice: 1` header (`WEB_VOICE_HEADER`); a cross-site form can't send it.
  - The browser records with a `ScriptProcessorNode`. AudioWorklet is blocked by the CSP: `'strict-dynamic'` ignores `'self'`. `Endpointer` (`web-audio.ts`) detects end of speech, and the page uploads 16 kHz WAV. The server transcribes it with Azure STT short-audio REST (`stt.ts`, same key as TTS) and returns the text, options, a new token and the reply as base64 MP3 (`WEB_AUDIO_FORMAT`). The page plays it through the AudioContext opened by the Start click, so there is no `<audio>` element and no CSP `media-src` change.
  - Without Azure: the browser's `SpeechRecognition` (Chrome/Edge) or typing, and text replies. Option buttons and typed replies always work. `Permissions-Policy` allows `microphone=(self)`.
  - The caller is identified by the phone number typed on the page (`findOrCreateClient`). Each session is a `call_logs` row with `call_sid` `web-<uuid>` and `call_status` `web`, so the dashboard stats count it.
- Twilio is optional (`env.server.ts`, `check-env.mjs`). `twilioConfig()` returns null when it is not configured. Phone webhooks then answer 403 and `sendSms` returns false (web bookings say so without the SMS line).

## Design System & Theme
- Light/dark theme on `<html data-theme>`, saved in `localStorage["bf-theme"]`, OS preference on first visit. `components/theme/theme-script.tsx` sets it before paint (needs the CSP nonce from `x-nonce`). `ThemeToggle` (`components/theme/theme-toggle.tsx`) is in every header: marketing, auth, dashboard top bar, 404, error.
- Colours come only from tokens in `src/app/tokens.css`. `globals.css` maps them to Tailwind (`bg-canvas`/`bg-bg`, `bg-surface`, `border-line`, `text-ink`, `text-muted`, `bg-brand`, `hover:bg-brand-hi`, `bg-brand-soft`, `text-accent` for green text, `text-on-brand`, `text-warn`/`bg-warn-soft`, `text-danger`/`bg-danger-soft`, `bg-busy`). Never hard-code hex, `white`, `gray-*` or `red-*`. Light is warm paper (#F2EEE5), dark is neutral charcoal (#121313).
- Marketing pages (landing, contact, legal) use `src/app/landing.css`, ported from `../reference.html` (the design source of truth, with `../BARBERFLOW_REDESIGN_PROMPT.md`). It is imported into the Tailwind `components` layer. Its class names are scoped under `.bf`; `card`/`btn`/`ring` became `bf-card`/`bf-btn`/`bf-ring` because they clash with Tailwind utilities. `.bf-cb` restores the reference's content-box sizing. The page gutter is `--gutter` (32px, 16px under 560px).
- Hero headline: `hero-headline.tsx` (server component) + `hero-headline-data.ts` (`splitHeadline`), ported from `../hero-headline-reference.html` per `../HERO_HEADLINE_PROMPT.md`. Each letter is a span (`--i`, green phrase also `--j`); CSS in `landing.css` (`.headline`) cascades them in from blur, then the `--glint` token sweeps the green phrase every 3.6 s. `--end` (last letter landed) and `--after` (lede + buttons rise) are set inline. No client JS, no underline. Font is FiraGO 800 (whole headline is bold), self-hosted via `next/font/local` from `src/fonts/firago/` (keep `OFL.txt` there), exposed as `--font-display`; used only for this headline. Copy: `t.home.titleBefore/titleGreen/titleAfter`. Hero eyebrow has a dot (`<i>`); other eyebrows keep the line. The whole headline has the brand star's glossy "inflated plastic" look: an inline SVG filter (`#bf-gloss`, `GlossFilter` in `hero-headline.tsx`) on `.headline .gloss` uses the blurred letter alpha as a height map for diffuse shading, a specular highlight and a drop shadow. The green phrase uses the `--gloss` token (star green; dark theme `#22805d`, 3.8:1 on `--bg`, large text), set via `--green-ink` on `.headline` so `hl-glint` uses it too. Original logo art: `public/brand/logo.png`; the cropped mark used by the UI is `public/brand/star.png`.
- Landing components live in `src/components/marketing/`: `call-stream.tsx` (hero "Call Stream" card: calls ring in every 1.78 s, the AI mark answers, each becomes a booking dated today + n days; ported from `../call-stream-ai-reference.html` per `../CALL_STREAM_AI_PROMPT.md`. Bookings, hand-written month names and the date maths are in `call-stream-data.ts`; the server passes "today" in Asia/Tbilisi and the client switches to its local date via `useSyncExternalStore`, so there is no hydration mismatch. `ai-mark.tsx` is the reusable AI voice mark (orb/bars/wave; site default `AI_MARK_VARIANT`). Synthesized Web Audio in `sfx.ts`, off by default. `timeline.ts` is a pausable, cancellable runner (`SPEED` scales every wait): one loop per Timeline means exactly one stream, and it freezes off-screen and in hidden tabs. Reduced motion shows the prefilled static list), `features.tsx` + `scenes.tsx` (scroll-synced), `background-fx.tsx`. Copy is in `t.home` in both dictionaries.
- Features section (desktop): once the section is in the upper half of the screen, the heading shrinks (`data-compact`). `features.tsx` measures `--stick-top`, plus the list's top margin and bottom padding, so the pinned card's centre stays level with the active item (the one nearest the viewport centre). Keep the `.stick-head` wrapper `display: flow-root`, otherwise the h2 margin escapes the measurement.
- Scrolling is native everywhere (GSAP ScrollSmoother was removed on 2026-11-03: it desynced scrollY from the screen and broke keyboard, anchors and find-in-page). `landing.css` sets `scroll-behavior: smooth` and `scroll-padding-top` on marketing pages; the header bar is sticky. Load-time entrances (`.r`, hero letters, lede, CTAs) only animate `transform`, so content is visible on first paint.
- `ActionForm` renders its `FormMessage` as the form's first child. Never give the form itself a multi-column grid class; put the grid on an inner wrapper (see `dashboard/settings/page.tsx`). Otherwise the message becomes a stretched grid cell and pushes the cards out of place.
- Local testing: `next start` cannot log in over http, because the production CSP sends `upgrade-insecure-requests`. Use `next dev` for authenticated flows.

## Status (2026-10-31)
- Done: landing redesign; site-wide theme and toggle; all hard-coded colours replaced with tokens (every token text pair is ≥ 4.5:1 in both themes); marketing footer stays at the bottom of short pages; header and footer checked at 390px and 1280px. Typecheck, lint, tests (124) and build all pass.
- Pending: the dashboard has not been checked visually in either theme. The test login failed with Supabase `invalid_credentials`. Once a working account exists, inspect `/dashboard/*` in light and dark mode. Lighthouse accessibility has not been run.

## Fix (2026-11-01): managers could not save Settings
- Cause: `20261028000000_locales.sql` added `salons.locale` without an UPDATE grant. Every Settings save writes `locale`, so it failed with `42501`, shown as "ამის გაკეთების უფლება არ გაქვთ". The phone number never saved, so the sidebar card kept the old number.
- Fix: migration `20261101000000_salon_locale_grant.sql` (`grant update (locale) on public.salons to authenticated`). The update row moved into `salonSettingsUpdate()` (`src/lib/validation.ts`), and a regression test was added. Typecheck, lint and tests (143) pass.
- Pending: apply the migration to the hosted Supabase project (`supabase db push` or the SQL editor). Until then, the live site keeps failing.

## Web voice agent (2026-11-01)
- Added the browser voice agent described under Tech Stack. Twilio is now optional. Typecheck, lint, tests (167) and `next build` pass. Route guards were checked against `next start`: no header gives 403, no session gives 401, a foreign Origin gives 403.
- Not yet tested end to end: there is no working dashboard login, and `.env.local` has no Azure key. To test, set `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION`, log in with `next dev`, turn on the voice agent in Settings, then open `/dashboard/voice`.

## Core Principles
- Clean, modular, minimalist code structure.
- Strict test coverage (Vitest). Before calling work done, run `npm run typecheck`, `npm test` and `npm run lint`.
- Fast page loads: keep `loading.tsx` for dynamic routes, run queries in parallel, and avoid extra auth round trips (`getClaims()`).
- Mobile-optimized responsive UI.

## QA fix pass (2026-11-03)
- Branch `qa-fixes`; see `CHANGELOG_QA.md` for every item and the manual steps (env vars, migrations 20261103*, Supabase templates, pricing placeholders).
- Optional integrations parse their own env (`lib/env-sections.ts`): `azureConfig()`/`twilioConfig()` never throw. `siteUrl()` is always a bare origin.
- One availability engine: `findOpenSlots` (`lib/time.ts`, honours `closedDates`) feeds the voice agents (`nextSlots`), the dashboard slot chips (`lib/availability.ts` dayAvailability via the `availableSlots` action) and the calendar. Use `salonHours(salon)` to build its hours.
- Bookable staff = `profiles.active && profiles.takes_clients`. Services are offered in `sort_order` and only when `active`.

## Fix (2026-11-06): manager login bounced to "access ended"
- Cause: the qa-fixes code was deployed, but migrations `20261103*` were not applied to the hosted project. `getSession()` reads `profiles.active` (added in `000700`); the column did not exist, so `row.active` was undefined and every member was treated as deactivated. `/auth/ended` then signed them out to `/login?error=access`.
- Fix: apply migrations `20261103000000`–`000900` (in order). `000700` adds `active boolean not null default true`, which backfills existing members. No new migration needed. `getSession()` now logs a clear error when the column is missing or the profile query fails; access is still denied (`active !== true`). Regression test: `src/lib/auth.test.ts`.
- QA logins: `npm run seed:test` (`scripts/seed-test-accounts.ts`) creates "Test Salon (QA)" with `qa-manager@` / `qa-barber@devskstudio.test`. Passwords go only to `.env.test-accounts.local` (git-ignored). `--reset` recreates them. It refuses to run before the `20261103*` migrations are applied.
