-- ============================================================================
-- Placer Robotics Hub — Cavitt V5 fundraising target
-- Migration: 20260620000049_cavitt_fundraising_target
--
-- Refines 0048: Cavitt Jr. High V5 students pay the STANDARD $40 registration
-- fee; what differs is the fundraising commitment ($500 vs the standard $550),
-- both paid through the Cavitt Zeffy campaign. Null = fall back to
-- one_program_fundraising_target.
-- ============================================================================

alter table season_config add column if not exists cavitt_v5_fundraising_target numeric;
