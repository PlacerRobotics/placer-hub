-- ============================================================================
-- Placer Robotics Hub — Bulk import support
-- Migration: 20260620000011_import_support
--
-- The import tracks whether a season invite (magic link) has been sent to a
-- family, and tags imported applications with their source.
-- ============================================================================
alter table family_season add column if not exists magic_link_sent boolean not null default false;
alter type application_source add value if not exists 'admin_import';
