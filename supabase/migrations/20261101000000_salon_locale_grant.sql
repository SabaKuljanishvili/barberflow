-- Fix: managers could not save Settings.
--
-- 20261028000000_locales.sql added salons.locale but did not grant it.
-- `authenticated` may only UPDATE salons columns granted by name (init.sql),
-- so every settings update (which writes locale) failed with 42501
-- "permission denied for table salons", shown as "forbidden" in the UI.
-- RLS ("managers update own salon") still limits updates to managers.

grant update (locale) on public.salons to authenticated;
