-- ============================================================================
-- Placer Robotics Hub — add NRL to combat_series
-- Migration: 20260620000059_combat_series_nrl
--
-- The enum shipped with NHRL (National Havoc Robot League) but not NRL
-- (National Robotics League) — a different organization, and the league
-- PART's entire 15lb history actually ran under (NRL/BotsIQ brackets at
-- SBB, NRL Sacramento, NRL Nationals). Kevin's combat-history import
-- labels those events NRL.
-- ============================================================================

alter type combat_series add value if not exists 'NRL';
