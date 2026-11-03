# QA fix pass — 2026-11-03

Branch `qa-fixes`, from `BARBERFLOW_FIX_PLAN.md`. Each phase ran typecheck, lint, tests and `next build`.
The tests went from 167 to 239, and all of them pass.

✅ done · ⚠️ partial (why) · ⏭️ skipped (why)

## Phase 1: critical bugs

- ⚠️ **1.1 Voice page crash.** Most likely cause: the voice page is the only dashboard page that read `serverEnv()` while rendering, through `azureConfig()`. One malformed variable anywhere on Vercel threw an error there, for example `CRON_SECRET` shorter than 32 characters or an Azure region written like "West Europe".
  - Twilio and Azure settings are now read separately (`lib/env-sections.ts`). A bad value turns off only its own feature and is logged by key name.
  - A new `dashboard/error.tsx` keeps the sidebar and top bar visible when a page fails.
  - Also fixed: the `call_logs.call_status` check did not allow `'web'`, so every web voice session failed to insert.
  - Partial because I had no Vercel logs and no test login to read the real stack trace for digest `140566769`.
- ✅ **1.2 Site URL.** `siteUrl()` now keeps only the origin. It falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`, then localhost. Every page has a canonical URL, robots no longer has a `Host` line, and `check-env` warns when the URL has a path.
- ✅ **1.3 Password reset.** Added `/forgot-password` (same reply whether or not the account exists, rate-limited by IP and by email) and `/reset-password` (signs out other sessions).
  - `/auth/confirm` handles recovery, invite and email-change links, and a safe `next=` parameter.
  - Invite emails now open the set-password form.
  - The login page links to the reset page.
- ✅ **1.4 Password change.** It now asks for the current password and checks it on the server with a separate client, rate-limited.
  - Password fields have `minLength=10`, show/hide toggles, and the same strength rules as signup.
  - Other sessions are signed out after the change.
- ✅ **1.5 Twilio number.**
  - On save, the number must exist in the Twilio account (only when Twilio is configured).
  - Settings shows the number's status and whether the voice, status and SMS webhooks are set correctly.
  - The webhook URLs are shown in full with copy buttons.
- ✅ **1.6 Past appointments.**
  - A nightly job (`complete_past_appointments`, pg_cron plus the Vercel fallback) marks past confirmed visits as completed. It can be switched off in Settings.
  - New `no_show` status.
  - Overview has a "needs review" card with "Completed" and "Didn't show" buttons.
- ✅ **1.7 Email change.** Managers can change their email; Supabase confirms it by email first. A trigger keeps `profiles.email` in sync. Only barbers see the "ask your manager" hint.

## Phase 2: public site

- ✅ **2.1 Scrolling.** GSAP ScrollSmoother and the `gsap` package are removed. Scrolling is native, with CSS smooth scrolling (off under reduced motion). Checked in Chrome: `/#features` lands below the header.
- ✅ **2.2 Hero.** The text is visible on first paint. Animations only move elements, never hide them.
- ✅ **2.3 Features.** Checked in Chrome: exactly one item is active and its scene shows at every step. I did not add static fallback images; the scenes are always rendered now.
- ✅ **2.4 Mobile header.** The header is sticky at every size. Phones get a `<dialog>` menu with a focus trap, Esc to close, and the links, language, theme, sign-in and CTA.
- ⚠️ **2.5 Contact form.** Fields: name, email, salon, message. It has a hidden spam trap, a rate limit, and sends through Resend. The new `BUSINESS_ID_CODE` is shown. Partial because company details stay empty until you fill in the env values.
- ⚠️ **2.6 Pricing.** Added `/pricing`, a home-page section, the nav link and sitemap entries, all driven by `lib/pricing.ts`. Partial because the prices are **placeholders** (49 / 99 / 179 ₾) and the site shows a "preliminary prices" note until you replace them.
- ⚠️ **2.7 Language URLs.** Georgian stays at `/`, English is under `/en/...` (the proxy rewrites it to the same pages).
  - Done: hreflang tags, a sitemap in both languages, `<html lang>` that follows the URL, and the language switcher moves between URLs.
  - Partial: pages can't be static or ISR, because the per-request CSP nonce forces dynamic rendering.
- ⚠️ **2.8 Content.** Partial: the audio file doesn't exist yet, and I left out testimonials rather than invent them. Done:
  - Believable demo numbers (124 calls / 97 booked).
  - Archive dates are relative to today.
  - Natural Georgian tagline, no jargon on marketing pages.
  - Privacy policy says passwords are "hashed" and shows the company identity.
  - FAQ with structured data.
  - The agent sample shows its transcript.
- ✅ **2.9 Accessibility and UX.**
  - The terms checkbox's accessible name now reads the whole sentence.
  - Show/hide password on login, signup, reset and account.
  - The cookie banner is now a small notice you can close.
  - `?next=` is strict, with unit tests.

## Phase 3: dashboard

- ⚠️ **3.1 Mobile.** Done: bottom tab bar with a "More" sheet, search on its own full-width row, appointments shown as cards below `md`. Partial: other tables were not converted to cards.
- ✅ **3.2 Calendar.** Day view (one column per barber, a current-time line, click an empty slot to book) and Week view. Clicking an appointment opens a details panel to change status, reschedule or open the client. I did not build drag-to-reschedule (planned for Phase 4).
- ✅ **3.3 Booking times.** The form shows free times as chips, from the same engine the voice agent uses (`lib/availability.ts`). Past times and times that run past closing are excluded. The server re-checks, and the database overlap constraint stays. Phone is required, name is optional. ⚠️ Phone is checked with the existing E.164 rules, not libphonenumber.
- ✅ **3.4 Clients.**
  - New `/dashboard/clients/[id]`: edit details, language, notes, totals (visits, spend, no-shows), history, upcoming visits, "Book again", and delete with confirmation (archive rows are removed too).
  - The list shows "უსახელო კლიენტი" for clients without a name, and has sorting and pagination.
- ⚠️ **3.5 Services.**
  - Done: inline edit, a "hidden" toggle, up/down order buttons (the voice agent reads services in this order), confirmation before delete, lighter placeholders.
  - Partial: no drag reordering, no separate ka/en names, no per-barber assignment or price.
- ⚠️ **3.6 Team.**
  - Done: change role, deactivate, "takes clients" toggle (inactive staff disappear from booking and the voice agent), pending-invite badge with resend.
  - Deactivated or removed members lose all access: they are blocked in the app and in the database rules.
  - Partial: no per-barber working hours or vacations.
- ⚠️ **3.7 Settings.** Done: closed dates (holidays) respected everywhere booking happens, and a searchable timezone field with Tbilisi first. Partial: no per-weekday hours, breaks, booking rules, reminder timing or SMS templates.
- ✅ **3.8 Data and billing.**
  - CSV export of clients and appointments, protected against spreadsheet formulas.
  - Delete salon after typing its name and ticking a box. The deletion runs on the server and removes everything that belongs to the salon.
  - Billing placeholder page.
- ⚠️ **3.9 Speed.** Partial because I didn't measure server timing (no deployed access). Done:
  - Vercel region set to `fra1`.
  - Two new indexes.
  - Independent queries run in parallel.
  - The loading skeleton already existed.
- ⚠️ **3.10 Other dashboard items.**
  - Done: removed the flag emoji, stat cards link to filtered lists, filters apply on change, added a missed-calls card with call-back links.
  - Partial: the notification bell is unchanged and still lists pending confirmations.

## Phase 4: product improvements

- ⏭️ Skipped. The plan says to confirm the scope with you first.

## What you need to do by hand

1. **Vercel → Environment Variables.**
   - Set `NEXT_PUBLIC_SITE_URL=https://barberflow-six-nu.vercel.app`, with no `/login`.
   - Check that `CRON_SECRET` is at least 32 characters and the `AZURE_*` and `TWILIO_*` values are valid. The logs now name any bad key.
   - Add `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (a sender on a domain verified in Resend).
   - Add `BUSINESS_LEGAL_NAME`, `BUSINESS_ID_CODE`, `BUSINESS_EMAIL`, `BUSINESS_PHONE` and the `BUSINESS_*` address fields.
2. **Supabase.**
   - Apply the migrations `20261103000000` … `20261103000900` with `supabase db push` or the SQL editor.
   - Auth → URL Configuration: set Site URL to the origin above, and add `<origin>/auth/confirm` and `<origin>/reset-password` to the redirect allow list.
   - For preview deployments, also allow `https://*-<your-team>.vercel.app/**`. Auth emails sent from a preview now link back to that preview, and Supabase rejects redirects it doesn't allow.
   - **Email templates (required):** invite and recovery links must point to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (or `type=recovery`).
   - Why: with the default templates, a reset link only works in the same browser that asked for it (PKCE). Invite links from the admin API can't be read by the server at all.
3. **Vercel region.** Confirm that the Supabase project is in the EU, so `fra1` is the right region.
4. **Twilio console.** Paste the three webhook URLs from Settings → Voice agent.
5. **Pricing.** Replace the placeholder prices and the Twilio estimate in `src/lib/pricing.ts`, then set `PRICING_IS_PLACEHOLDER = false`.
6. **Audio sample.** Record one, save it as `public/audio/agent-sample-ka.mp3`, and set `AGENT_SAMPLE_AUDIO_SRC` in `src/lib/site.ts`.
7. **Test with a real account.** Sign in to a manager account on `next dev` and walk through: voice page, booking, reschedule, client profile, settings save with a Twilio number, password reset email.

## Final review (fresh reviewer) and fix pass

The final review found no Critical issues and 7 Important ones. All 7 are fixed:

1. `/reset-password` now needs a 15-minute marker cookie that only a recovery or invite link sets. A session alone can no longer change the password there.
2. An inactive profile gets no access. `getSession` returns nothing, and the database helpers `current_salon_id()` and `is_manager()` require `active` (migration `000900`).
3. A login whose profile is missing or inactive goes to `/auth/ended`, which signs it out. This ends the redirect loop.
4. The proxy now also runs for `/en` prefetch requests. Checked: an RSC request for `/en/contact` returns English content.
5. Supabase email templates are now marked required in the manual steps (cross-device reset links).
6. After a booking, the free-time picker reloads and clears the chosen time.
7. CSV export pages through all rows instead of stopping at Supabase's 1000-row cap.

Deferred minor issues:
- `createAppointment` can create a client before the barber check fails.
- `deleteSalon` deletes the archive before the salon row.
- After a PKCE email change, `changeEmail` lands on `/dashboard`, not on the "email changed" message.
- `azureConfig()` re-parses the environment on every call.
- Rate limits are kept in memory, per server instance.

## Follow-up (2026-11-04): deferred items fixed

Each fix has a test:
- **Hidden services can't be booked.** `createAppointment` refuses them on the server, and `availableSlots` returns no times for them. Test: `isBookableService`.
- **Inactive barbers get no times,** even when chosen explicitly. `availableSlots` checks the chosen barber like everyone else. Test: `isBookableBarber`.
- **Only pending or confirmed visits can be rescheduled.** The rule is checked before the update and again inside it, in case the status changes meanwhile. Test: `canReschedule`.
- **Closed dates must be real dates.** `2026-13-45` and `2026-02-30` are rejected. Tests: `isIsoDate` and the settings schema.
- **Preview deployments link to themselves.** Sign-up, invite, password-reset and email-change links use `appUrl()`: on a Vercel preview that is the branch URL, otherwise the site URL. SEO URLs (canonical, sitemap) still point to production. Test: `resolveAppUrl`.
