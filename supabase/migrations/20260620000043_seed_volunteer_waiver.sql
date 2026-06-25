-- ============================================================================
-- Placer Robotics Hub — Registered Volunteer Agreement (real, versioned waiver)
-- Migration: 20260620000043_seed_volunteer_waiver
--
-- Seeds the active 2026-27 volunteer waiver into waiver_template so the
-- /volunteer/waiver flow shows the REAL agreement text (versioned, snapshot via
-- body_hash) and records a waiver_signature on accept — matching the registration
-- waivers. body_hash = md5(body_markdown). Idempotent via unique (waiver_type, version).
--
-- Record-keeping: a new revision must be a NEW row (new version) — never edit this
-- body in place, so each signature's (waiver_version, body_hash) points at the exact
-- text that was signed.
-- ============================================================================

insert into waiver_template (waiver_type, version, title, body_markdown, body_hash, effective_date, active)
select
  'volunteer'::waiver_type,
  '2026-27',
  'Registered Volunteer Agreement — Youth Protection & Abuse Prevention',
  body,
  md5(body),
  date '2026-08-01',
  true
from (
  select $w$By signing below, I acknowledge that I have read, understand, and agree to follow and enforce the Placer Robotics Youth Protection and Abuse Prevention Policy, the Robotics Center Use Policy, and all associated training requirements for the 2026-27 program season.

I understand that:

- I am required to complete California AB 506 mandated reporter training and maintain a valid certificate through May 31, 2027.
- I must pass the annual Robotics Center Use Safety Quiz and the Youth Protection Supplemental Quiz with a score of 90% or higher.
- I must follow the Two-Adult Rule at all times when interacting with youth in any Placer Robotics program or facility.
- One-on-one communication with minors must be limited, transparent, and monitored.
- Grooming, abuse, or inappropriate conduct of any kind is strictly prohibited.
- I must report any suspicion of child abuse or neglect directly to Child Protective Services or law enforcement, consistent with my mandated reporter obligations.
- Violations of these policies may result in suspension or revocation of my Registered Volunteer status.

I understand that my electronic signature below constitutes a legally binding acknowledgment of these policies for the 2026-27 season.$w$::text as body
) t
on conflict (waiver_type, version) do nothing;
