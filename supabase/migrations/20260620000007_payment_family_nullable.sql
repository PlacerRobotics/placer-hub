-- ============================================================================
-- Placer Robotics Hub — Task 11 support
-- Migration: 20260620000007_payment_family_nullable
--
-- payment_transaction.family_id becomes nullable: payments (especially Zeffy
-- webhooks and manually recorded checks) often arrive before they can be tied
-- to a family. Unmatched payments display "Unknown" until an admin matches them.
-- ============================================================================
alter table payment_transaction alter column family_id drop not null;
