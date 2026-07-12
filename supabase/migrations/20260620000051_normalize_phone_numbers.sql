-- ============================================================================
-- Placer Robotics Hub — normalize phone numbers to E.164, default country US
-- Migration: 20260620000051_normalize_phone_numbers
--
-- Phone numbers have been stored exactly as typed since launch — no format,
-- no country code, no validation. The application-level fix (lib/phone-input.ts
-- cleanPhone(), applied at every phone-ingestion route) now normalizes new/
-- edited numbers to E.164 (e.g. "+16505551234"), defaulting to the US country
-- code for a bare number and trusting an explicit "+<country code>" prefix
-- otherwise. This migration normalizes what's already there.
--
-- SQL has no access to a real phone-parsing library (the app uses
-- libphonenumber-js — see lib/phone-input.ts), so this is intentionally a
-- narrower, regex-based best-effort covering the overwhelming common case for
-- this org (a US organization; virtually all existing numbers are 10-digit US
-- numbers typed with mixed punctuation — dashes, parens, dots, spaces —
-- sometimes with a leading "1"):
--
--   - already starts with '+'  → assumed already E.164; left alone (idempotent)
--   - normalizes (strips punctuation) to exactly 10 digits, or 11 digits
--     starting with '1'        → rewritten as "+1" + the 10-digit number
--   - anything else (too short/long, extra text, already-international
--     numbers without a '+', extensions)
--                               → left alone; flagged by the review SELECT at
--                                 the bottom for manual admin follow-up
--
-- No uniqueness constraint on any of these columns, so no collision risk —
-- unlike the mailto: email cleanup (20260620000050), every safely-normalizable
-- row here is rewritten unconditionally.
--
-- Idempotent: the '+' guard means re-running this after it already ran (or
-- after the app has since written clean E.164 values) touches nothing further.
-- ============================================================================

update guardian
set phone = '+1' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
where phone is not null
  and phone <> ''
  and phone not like '+%'
  and length(regexp_replace(phone, '[^0-9]', '', 'g')) in (10, 11)
  and (
    length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
    or left(regexp_replace(phone, '[^0-9]', '', 'g'), 1) = '1'
  );

update student
set phone = '+1' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
where phone is not null
  and phone <> ''
  and phone not like '+%'
  and length(regexp_replace(phone, '[^0-9]', '', 'g')) in (10, 11)
  and (
    length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
    or left(regexp_replace(phone, '[^0-9]', '', 'g'), 1) = '1'
  );

update emergency_contact
set phone = '+1' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
where phone is not null
  and phone <> ''
  and phone not like '+%'
  and length(regexp_replace(phone, '[^0-9]', '', 'g')) in (10, 11)
  and (
    length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
    or left(regexp_replace(phone, '[^0-9]', '', 'g'), 1) = '1'
  );

update sponsor
set contact_phone = '+1' || right(regexp_replace(contact_phone, '[^0-9]', '', 'g'), 10)
where contact_phone is not null
  and contact_phone <> ''
  and contact_phone not like '+%'
  and length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) in (10, 11)
  and (
    length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) = 10
    or left(regexp_replace(contact_phone, '[^0-9]', '', 'g'), 1) = '1'
  );

-- ---------------------------------------------------------------------------
-- Review queue: anything still not in E.164 form after the updates above
-- didn't match the safe 10/11-digit US pattern — too short, too long, extra
-- text, an extension, or a genuine international number typed without a '+'.
-- Needs a human to look at it and either fix by hand or leave as-is.
-- ---------------------------------------------------------------------------
select 'guardian.phone' as source, id, phone as dirty_value from guardian where phone is not null and phone <> '' and phone not like '+%'
union all
select 'student.phone', id, phone from student where phone is not null and phone <> '' and phone not like '+%'
union all
select 'emergency_contact.phone', id, phone from emergency_contact where phone is not null and phone <> '' and phone not like '+%'
union all
select 'sponsor.contact_phone', id, contact_phone from sponsor where contact_phone is not null and contact_phone <> '' and contact_phone not like '+%';
