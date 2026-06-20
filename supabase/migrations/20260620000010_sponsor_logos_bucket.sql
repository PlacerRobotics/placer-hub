-- ============================================================================
-- Placer Robotics Hub — Sponsor logos storage bucket
-- Migration: 20260620000010_sponsor_logos_bucket
--
-- Public bucket for sponsor logos. Uploads happen via the service-role API
-- route (bypasses storage RLS); public=true makes the stored logo_url readable.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do nothing;
