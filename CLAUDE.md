# BarberFlow - Project Memory & Architecture

@AGENTS.md

## Tech Stack
- Framework: Next.js 16 (App Router), TypeScript, Tailwind CSS 4.
- Database & Backend: Supabase (PostgreSQL, RLS). Server actions re-check the session and role; RLS is the second line of defence.
- i18n: Georgian (default) and English, cookie-based (`src/i18n`). Every user-facing string goes in both `en.ts` and `ka.ts`.
- Voice Agent: hybrid architecture in `src/lib/voice`.
  - A Twilio state machine (`flow.ts`) owns booking. The LLM never books, offers times or moves the call forward.
  - Keypad and keyword matches (`match.ts`) are handled first. Only unmatched speech goes to the LLM (`understand.ts`).
  - Claude is used when `ANTHROPIC_API_KEY` is set; Groq (`GROQ_API_KEY`) is used otherwise. Any failure counts as "unclear".
  - Azure TTS speaks the replies. Answers containing script other than Georgian or Latin are dropped as "unclear".

## Design System & Theme
- Light/dark theme on `<html data-theme>`, saved in `localStorage["bf-theme"]`, OS preference on first visit. `components/theme/theme-script.tsx` sets it before paint (needs the CSP nonce from `x-nonce`). `ThemeToggle` (`components/theme/theme-toggle.tsx`) is in every header: marketing, auth, dashboard top bar, 404, error.
- Colours come only from tokens in `src/app/tokens.css`. `globals.css` maps them to Tailwind (`bg-canvas`/`bg-bg`, `bg-surface`, `border-line`, `text-ink`, `text-muted`, `bg-brand`, `hover:bg-brand-hi`, `bg-brand-soft`, `text-accent` for green text, `text-on-brand`, `text-warn`/`bg-warn-soft`, `text-danger`/`bg-danger-soft`, `bg-busy`). Never hard-code hex, `white`, `gray-*` or `red-*`. Light is warm paper (#F2EEE5), dark is neutral charcoal (#121313).
- Marketing pages (landing, contact, legal) use `src/app/landing.css`, ported from `../reference.html` (the design source of truth, with `../BARBERFLOW_REDESIGN_PROMPT.md`). It is imported into the Tailwind `components` layer. Its class names are scoped under `.bf`; `card`/`btn`/`ring` became `bf-card`/`bf-btn`/`bf-ring` because they clash with Tailwind utilities. `.bf-cb` restores the reference's content-box sizing. The page gutter is `--gutter` (32px, 16px under 560px).
- Landing components live in `src/components/marketing/`: `call-card.tsx` (hero state machine), `features.tsx` + `scenes.tsx` (scroll-synced), `background-fx.tsx`. Copy is in `t.home` in both dictionaries.
- Features section (desktop): once the section is in the upper half of the screen, the heading shrinks (`data-compact`). `features.tsx` measures `--stick-top`, plus the list's top margin and bottom padding, so the pinned card's centre stays level with the active item (the one nearest the viewport centre). Keep the `.stick-head` wrapper `display: flow-root`, otherwise the h2 margin escapes the measurement.
- Smooth wheel scrolling is a small lerp in `components/smooth-scroll.tsx` (no Lenis). It skips inner scrollers and horizontal wheels. It is off under reduced motion.
- Local testing: `next start` cannot log in over http, because the production CSP sends `upgrade-insecure-requests`. Use `next dev` for authenticated flows.

## Status (2026-10-31)
- Done: landing redesign; site-wide theme and toggle; all hard-coded colours replaced with tokens (every token text pair is ≥ 4.5:1 in both themes); marketing footer stays at the bottom of short pages; header and footer checked at 390px and 1280px. Typecheck, lint, tests (124) and build all pass.
- Pending: the dashboard has not been checked visually in either theme. The test login failed with Supabase `invalid_credentials`. Once a working account exists, inspect `/dashboard/*` in light and dark mode. Lighthouse accessibility has not been run.

## Core Principles
- Clean, modular, minimalist code structure.
- Strict test coverage (Vitest). Before calling work done, run `npm run typecheck`, `npm test` and `npm run lint`.
- Fast page loads: keep `loading.tsx` for dynamic routes, run queries in parallel, and avoid extra auth round trips (`getClaims()`).
- Mobile-optimized responsive UI.
