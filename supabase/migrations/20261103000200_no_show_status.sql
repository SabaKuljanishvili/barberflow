-- "Didn't show up" for past visits. Own file: a new enum value cannot be
-- used in the transaction that adds it.
alter type public.appointment_status add value if not exists 'no_show';
