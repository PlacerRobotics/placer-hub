-- ============================================================================
-- Placer Robotics Hub — Student & Family Expectations Agreement (BUG-09)
-- Migration: 20260620000023_seed_expectations_waiver
--
-- Seeds the active 2026-27 Expectations Agreement into waiver_template. Renders
-- as its own acknowledgment section in the register wizard. body_hash =
-- md5(body_markdown). Idempotent via unique (waiver_type, version).
-- ============================================================================

insert into waiver_template (waiver_type, version, title, body_markdown, body_hash, effective_date, active)
select
  'expectations_agreement'::waiver_type,
  '2026-27',
  'Student & Family Expectations Agreement (Grades 7-12)',
  body,
  md5(body),
  date '2026-08-01',
  true
from (
  select $w$Commitment, Conduct, and Culture for Placer Robotics Teams
Student-Led - Team-Based - Positively Engaged

This agreement outlines the expectations for all students and families joining a team. It ensures a shared understanding of what it means to be a committed, contributing member of our student-led, team-based environment. These expectations reflect the core values that define our culture and support the positive, high-performing atmosphere that makes our program successful.

By joining a Placer Robotics team, you're not just signing up for an activity - you're becoming part of a student-led, high-trust, team-based program. This agreement explains what we expect from you and what you can expect from us, helping ensure a successful season for everyone involved.

1. ENGAGEMENT & TEAM COMMITMENT
- I will attend at least 75% of team meetings unless excused in advance.
- I will actively contribute during meetings - not just be present.
- I will use phones/devices responsibly to stay focused on teamwork.
- I will take on a meaningful role (build, programming, CAD, documentation, scouting, or leadership) and contribute consistently.
- I will prioritize team goals and support my teammates, even under pressure.

2. COMMUNICATION
- I will be an active participant on Slack, the team's communication platform.
- I will check messages, RSVP to meetings, and respond to surveys promptly.

3. ACADEMICS FIRST
- Academics come first. If school becomes challenging, I will inform advisors early to find a solution.
- While Placer Robotics recommends maintaining a 3.25 GPA or higher, all engaged students will be supported if they communicate proactively and stay involved.

4. SAFETY & TOOL USE
- I will complete all safety training before using tools or machines.
- I will wear closed-toe shoes in lab areas and secure clothing/jewelry.
- I will tie back long hair and follow PPE rules everywhere we work.
- I will keep workspaces clean and return tools and parts after use.
- I understand safety rules apply at the Robotics Center, in homes, and at partner/off-site facilities.

5. BEHAVIOR & CONDUCT
- I will follow school district behavior policies, including those covering drugs, alcohol, and respectful language.
- I will act with maturity, honesty, and integrity - especially under stress.
- I will avoid roughhousing, unsafe behavior, or improper tool use.
- I will dress appropriately and wear team gear when required.
- I understand I represent Placer Robotics, my school, and Placer County.

6. EVENTS & COMPETITIONS
- I will read and follow event rules, safety protocols, and RECF conduct policies.
- I will treat teammates, volunteers, and competitors with respect.
- I will stay on task and remain until the end of each event, unless excused.
- I understand most local events are "meet-you-there." Families handle transportation, meals, and lodging.
- Carpools must be driven by a licensed adult (21+).
- A parent/guardian must be onsite and available during competitions.

7. TRAVEL TEAM ELIGIBILITY
- Travel-team spots are earned through active engagement and good standing.
- I must uphold this agreement to stay eligible for travel.
- Families cover all travel costs (lodging, transport, meals).

8. RESPECT FOR STUDENT-LED STRUCTURE
- Placer Robotics teams are student-led. Roles, leadership, and daily decisions are made by students, with coach/mentor guidance.
- Students and parents must respect this structure. Pressuring for specific roles (e.g., driver, programmer) undermines collaboration.
- I will support student-led decisions and work within a framework that values equity, contribution, and teamwork over entitlement or personal ambition.

By agreeing, I understand that not following these expectations may lead to removal from meetings, events, or participation in Placer Robotics programs.$w$::text as body
) t
on conflict (waiver_type, version) do nothing;
