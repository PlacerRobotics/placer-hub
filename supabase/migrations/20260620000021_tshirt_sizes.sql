-- ============================================================================
-- Placer Robotics Hub — t-shirt size options (BUG-04)
-- Migration: 20260620000021_tshirt_sizes
--
-- The registration form now offers: Youth Medium, Youth Large, Adult Large,
-- Adult XL, Adult 2XL, Adult 3XL. These map onto the tshirt_size enum as:
--   Youth Medium -> ym   (new)
--   Youth Large  -> yl   (new)
--   Adult Large  -> l    (existing)
--   Adult XL     -> xl   (existing)
--   Adult 2XL    -> xxl  (existing)
--   Adult 3XL    -> xxxl (new)
-- The legacy xs/s/m values stay in the enum (existing/imported rows may use
-- them); the form just no longer offers them.
--
-- Note: ALTER TYPE ... ADD VALUE can't be referenced in the same transaction it
-- is added in (nothing here does). If the SQL editor wraps the file in one
-- transaction and errors, run each ADD VALUE line on its own.
-- ============================================================================

alter type tshirt_size add value if not exists 'ym';
alter type tshirt_size add value if not exists 'yl';
alter type tshirt_size add value if not exists 'xxxl';
