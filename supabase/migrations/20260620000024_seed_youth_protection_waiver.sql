-- ============================================================================
-- Placer Robotics Hub — Youth Protection & Abuse Prevention summary
-- Migration: 20260620000024_seed_youth_protection_waiver
--
-- Seeds the active 2026-27 Youth Protection summary into waiver_template.
-- Renders as its own acknowledgment section in the register wizard. Typos in
-- the source ("notiifcation", "certiicate") are corrected here. body_hash =
-- md5(body_markdown). Idempotent via unique (waiver_type, version).
-- ============================================================================

insert into waiver_template (waiver_type, version, title, body_markdown, body_hash, effective_date, active)
select
  'youth_protection_summary'::waiver_type,
  '2026-27',
  'Youth Protection & Abuse Prevention Summary',
  body,
  md5(body),
  date '2026-08-01',
  true
from (
  select $w$Placer Robotics is committed to creating a safe, inclusive, and trusted environment where youth can learn, build, and thrive. We follow California AB 506 compliance standards and implement clear safeguards to protect minors and uphold community trust across all our programs.

KEY POLICY HIGHLIGHTS
- All Registered Adult Volunteers and Employees are background checked and trained in mandated reporter and youth protection practices. This includes all coaches, mentors, or any adult with keycard access to the lab.
- A "two-adult" rule is followed to the greatest extent possible during official meetings to ensure visibility and accountability.
- One-on-one communication with minors is limited, transparent, and monitored to the greatest extent possible.
- Grooming, abuse, or inappropriate conduct are strictly prohibited and must be reported.
- Parents are notified of any home-based meetings or off-site activities not directly hosted by Placer Robotics.

VOLUNTEER ROLES & HOW TO GET STARTED

There are two types of volunteers at Placer Robotics:

- Registered Volunteer: Supervises students, leads meetings, or helps regularly. May receive a keycard. Includes all coaches, mentors, and regular volunteers. Clearance required: Yes (Background Check + Youth Protection Training).
- Event Volunteer: Assists at tournaments, workshops, or outreach events. Always under the supervision of other registered volunteers. Clearance required: No formal clearance required.

New Volunteers: Visit the "Steps to Become a Registered Volunteer" document to learn more and begin the process to become a Registered Volunteer.

Returning Volunteers: You will receive notification in early August of the 2025-26 policies via email, along with a form to acknowledge you have read and agreed to the new policies. If your current youth protection course certificate expires before May 31, 2026, you will be required to take the APS course (every two years).$w$::text as body
) t
on conflict (waiver_type, version) do nothing;
