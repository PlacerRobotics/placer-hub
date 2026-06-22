-- ============================================================================
-- Placer Robotics Hub — Center Use summary acknowledgment
-- Migration: 20260620000022_seed_center_use_waiver
--
-- Seeds the active 2026-27 Center Use summary into waiver_template. The register
-- wizard renders every active waiver as its own section with an acknowledgment
-- checkbox, so this appears alongside the liability waiver (0020). body_hash =
-- md5(body_markdown). Idempotent via unique (waiver_type, version).
-- ============================================================================

insert into waiver_template (waiver_type, version, title, body_markdown, body_hash, effective_date, active)
select
  'center_use_summary'::waiver_type,
  '2026-27',
  'Placer Robotics Center Use — Summary of Key Policies',
  body,
  md5(body),
  date '2026-08-01',
  true
from (
  select $w$Participation at the Placer Robotics Center requires all students and families to follow key safety, supervision, and facility-use policies. These expectations ensure a safe and respectful learning environment for everyone. The following highlights do not replace the full Placer Robotics Center Use Policy, which contains detailed guidance. All participants are expected to review and comply with the complete policy as part of registration.

SAFETY & CONDUCT

- Supervision: Registered Volunteers are required to supervise the lab. Adults must stay until all students are picked up.
- Behavior: Students must act responsibly and follow safety rules. Horseplay or unsafe conduct may lead to removal.
- Eye Protection: Safety glasses are required when using tools, handling batteries, soldering, or as required during matches.
- Closed-Toe Shoes: Required at all times in the robotics center.
- Tool/Battery Use: Machine room, Combat tools, and LiPo batteries follow strict safety protocols.

HEALTH, SECURITY & EMERGENCIES

- Health: Help keep your teammates healthy! Do not attend while sick and contagious. Follow all health-related updates or protocols.
- Security: 24/7 audio/video recording is active. Keycards are individual and access may be revoked.
- Emergencies: All users must understand basic evacuation and safety procedures.

FACILITY EXPECTATIONS

- Clean-up: Teams must clean up and store tools after use.
- Drop-off: Parents of younger students must escort children inside and confirm a coach is present.
- Scheduling: All meetings must be on the Google Calendar. Unscheduled use is not allowed.$w$::text as body
) t
on conflict (waiver_type, version) do nothing;
