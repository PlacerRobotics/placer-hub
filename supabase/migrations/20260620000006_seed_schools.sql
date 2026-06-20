-- ============================================================================
-- Placer Robotics Hub — School seed
-- Migration: 20260620000006_seed_schools
--
-- The school table (PRD 10.2) has no `type` column, so this migration adds it
-- (text + check constraint for the six categories) and then seeds the canonical
-- school list. Idempotent: column add uses IF NOT EXISTS, inserts use
-- ON CONFLICT (name) DO NOTHING. id/created_at/updated_at/active use defaults.
--
-- Note: numbered 0006, not 0005 — 0005 is the API-role grants migration.
-- ============================================================================

alter table school
  add column if not exists type text
  check (type in ('high_school', 'middle_school', 'charter', 'elementary', 'private', 'other'));

insert into school (name, type, city) values
  -- High schools
  ('Granite Bay High School', 'high_school', 'Granite Bay'),
  ('Rocklin High School', 'high_school', 'Rocklin'),
  ('Whitney High School', 'high_school', 'Rocklin'),
  ('Del Oro High School', 'high_school', 'Loomis'),
  ('West Park High School', 'high_school', 'Roseville'),
  ('Mira Loma High School', 'high_school', 'Sacramento'),
  ('Roseville High School', 'high_school', 'Roseville'),
  ('Yuba City High School', 'high_school', 'Yuba City'),
  -- Middle schools
  ('Cavitt Jr. High', 'middle_school', 'Granite Bay'),
  ('Granite Oaks Middle School', 'middle_school', 'Rocklin'),
  ('Chilton Middle School', 'middle_school', 'Granite Bay'),
  ('Springview Middle School', 'middle_school', 'Rocklin'),
  ('Cooley Middle School', 'middle_school', 'Roseville'),
  ('Glen Edwards Middle School', 'middle_school', 'Lincoln'),
  ('Eich Middle School', 'middle_school', 'Roseville'),
  ('Arden Middle School', 'middle_school', 'Sacramento'),
  ('Winston Churchill Middle School', 'middle_school', 'Carmichael'),
  ('Olympus Junior High School', 'middle_school', 'Roseville'),
  ('Katharine Albiani Middle School', 'middle_school', 'Sacramento'),
  -- Charter
  ('Western Sierra Collegiate Academy', 'charter', 'Rocklin'),
  ('Sutter Peak Charter School', 'charter', 'Rocklin'),
  ('Rocklin Academy Gateway', 'charter', 'Rocklin'),
  ('Rocklin Academy (Turnstone)', 'charter', 'Rocklin'),
  ('John Adams Academy', 'charter', 'Roseville'),
  ('Loomis Basin Charter School', 'charter', 'Loomis'),
  ('Cottonwood School', 'charter', 'Reno'),
  ('Harvest Ridge Cooperative Charter School', 'charter', 'Roseville'),
  ('South Sutter Charter', 'charter', 'Yuba City'),
  ('Feather River Charter School', 'charter', 'Oroville'),
  ('California Montessori Project', 'charter', 'Carmichael'),
  ('Maria Montessori Charter Academy', 'charter', 'Sacramento'),
  ('NP3 Charter', 'charter', 'Sacramento'),
  ('Orangevale Open', 'charter', 'Orangevale'),
  -- Elementary
  ('Ridgeview Elementary', 'elementary', 'Roseville'),
  ('Fiddyment Farm Elementary', 'elementary', 'Roseville'),
  ('Blue Oaks Elementary', 'elementary', 'Rocklin'),
  ('Heritage Oak Elementary', 'elementary', 'Rocklin'),
  ('Excelsior Elementary', 'elementary', 'Folsom'),
  ('Valley View Elementary', 'elementary', 'Rocklin'),
  ('Junction Elementary', 'elementary', 'Rocklin'),
  ('Theodore Judah Elementary', 'elementary', 'Folsom'),
  ('Northside Elementary', 'elementary', 'Rocklin'),
  ('Del Paso Manor Elementary', 'elementary', 'Sacramento'),
  ('Cambridge Heights Elementary', 'elementary', 'Roseville'),
  ('Rocklin Elementary', 'elementary', 'Rocklin'),
  ('Pershing Elementary', 'elementary', 'Sacramento'),
  ('Deterding Elementary', 'elementary', 'Sacramento'),
  -- Private
  ('St. Albans Country Day School', 'private', 'Roseville'),
  ('Sacramento Country Day School', 'private', 'Sacramento'),
  ('Bradshaw Christian School', 'private', 'Sacramento'),
  ('Our Lady of the Assumption', 'private', 'Carmichael'),
  ('St. Francis of Assisi Elementary', 'private', 'Sacramento'),
  -- Other
  ('Homeschool', 'other', null),
  ('Golden Hills School', 'other', 'Roseville'),
  ('Rescue Elementary', 'other', 'Rescue'),
  ('Other', 'other', null)
on conflict (name) do nothing;
