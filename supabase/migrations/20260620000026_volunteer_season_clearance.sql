-- ============================================================================
-- 0026 — Per-season volunteer clearance + seed RC/YP quizzes
-- ----------------------------------------------------------------------------
-- Extends the EXISTING per-guardian volunteer model (volunteer_profile /
-- volunteer_step / youth_protection_cert / quiz / quiz_question / quiz_attempt)
-- with season scoping + annual renewal. We do NOT introduce a parallel
-- "volunteer" identity table — volunteers remain guardian-linked.
-- ============================================================================

-- 1. Per-season clearance summary --------------------------------------------
create table if not exists volunteer_clearance (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteer_profile(id) on delete cascade,
  season text not null,
  status volunteer_status not null default 'pending',
  application_submitted_at timestamptz,
  rc_quiz_passed boolean not null default false,
  rc_quiz_score integer,
  rc_quiz_passed_date date,
  yp_quiz_passed boolean not null default false,
  yp_quiz_score integer,
  yp_quiz_passed_date date,
  waiver_signed_date timestamptz,
  waiver_signature_text text,
  waiver_signed_by_ip text,
  key_access_requested text check (key_access_requested in ('none','card','phone')) default 'none',
  key_access_granted boolean not null default false,
  key_access_granted_date date,
  key_access_type text check (key_access_type in ('card','phone','none')),
  orientation_completed boolean not null default false,
  orientation_completed_date date,
  approved_by uuid references admin_profile(id),
  approved_at timestamptz,
  reminder_90_sent_at timestamptz,
  reminder_30_sent_at timestamptz,
  reminder_14_sent_at timestamptz,
  renewal_reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (volunteer_id, season)
);

create index if not exists idx_volunteer_clearance_season on volunteer_clearance (season);

-- 2. Season-scope quiz attempts (quizzes must be re-passed each season) -------
alter table quiz_attempt add column if not exists season text;

-- 3. RLS (mirrors the existing volunteer_step pattern) ------------------------
alter table volunteer_clearance enable row level security;

create policy "clearance_admin_all" on volunteer_clearance
  for all using (public.can_write_volunteer()) with check (public.can_write_volunteer());
create policy "clearance_own_select" on volunteer_clearance
  for select using (public.owns_volunteer(volunteer_id) or public.is_admin());
create policy "clearance_own_insert" on volunteer_clearance
  for insert with check (public.owns_volunteer(volunteer_id) or public.can_write_volunteer());
create policy "clearance_own_update" on volunteer_clearance
  for update using (public.owns_volunteer(volunteer_id) or public.can_write_volunteer())
  with check (public.owns_volunteer(volunteer_id) or public.can_write_volunteer());

-- 4. Grants (separate from RLS) ----------------------------------------------
grant select, insert, update, delete on volunteer_clearance to authenticated;
grant select, insert, update, delete on volunteer_clearance to service_role;

-- 5. Seed the two quizzes (RC = lab_use, YP = youth_protection) ---------------
insert into quiz (quiz_type, title, version, pass_threshold, active)
values ('lab_use', 'Robotics Center Use Safety Quiz', '2026-27', 0.90, true)
on conflict (quiz_type, version) do nothing;

insert into quiz (quiz_type, title, version, pass_threshold, active)
values ('youth_protection', 'Youth Protection Supplemental Quiz', '2026-27', 0.90, true)
on conflict (quiz_type, version) do nothing;

-- Reseed questions idempotently.
delete from quiz_question where quiz_id in (
  select id from quiz where version = '2026-27' and quiz_type in ('lab_use', 'youth_protection')
);

-- RC (lab_use) — 42 questions. options=JSON array of strings; correct_answers=[0-based index].
insert into quiz_question (quiz_id, question_text, question_type, options, correct_answers, order_index)
select q.id, v.qtext, 'single_correct', v.opts::jsonb, v.correct::jsonb, v.ord
from quiz q
join (values
  ('What is required when you enter the Robotics Center regarding video and audio monitoring?', '["A signed paper waiver at the front desk","Consent to audio and video recording","Permission from a parent or guardian","Nothing, monitoring is optional"]', '[1]', 1),
  ('Who has the authority to grant or revoke access to the Robotics Center at any time?', '["Any Registered Volunteer on site","The team captain","The Executive Director and/or the Board of Directors","The building landlord"]', '[2]', 2),
  ('What must be done before any meeting or event is held at the Robotics Center?', '["Email the entire volunteer list","Add it to the Google Calendar with the name of the supervising Registered Volunteer","Post a notice on the front door","Get verbal approval from a coach"]', '[1]', 3),
  ('Unscheduled facility use is allowed if no other teams are present.', '["True","False"]', '[1]', 4),
  ('What are the official regular hours for using the Robotics Center without a special request?', '["6:00 AM – 11:00 PM","9:00 AM – 5:00 PM","8:00 AM – 9:00 PM","24 hours a day"]', '[2]', 5),
  ('How many Registered Volunteers should be present, to the greatest extent possible, when students are working in the Robotics Center?', '["At least two Registered Volunteers","One Registered Volunteer","At least four Registered Volunteers","No volunteers are required"]', '[0]', 6),
  ('What is the policy regarding student presence in the Robotics Center without a supervising adult?', '["Allowed for high school students only","Allowed during regular hours","Not allowed under any circumstances","Allowed with written parent permission"]', '[2]', 7),
  ('What should parents of elementary and middle school students do at drop-off and pickup?', '["Drop their child at the curb","Accompany their child into the center and confirm their coach is present","Text the coach when they arrive","Wait in the parking lot until dismissal"]', '[1]', 8),
  ('What must happen when a key card is lost or stolen?', '["Wait to see if it turns up before reporting","Report it immediately and pay a $20 replacement fee","Borrow another member''s key card","Report it at the next team meeting"]', '[1]', 9),
  ('What is the first step to take when opening the Robotics Center for a meeting or event?', '["Turn on all the equipment","Unlock the machine room","Add your meeting/event to the team calendar","Sign the paper logbook"]', '[2]', 10),
  ('What should the last Registered Volunteer do before closing the Robotics Center?', '["Turn off equipment and check that batteries are stored properly","Make sure all doors are locked","Confirm no students remain in the building","All of the above"]', '[3]', 11),
  ('Lights in the Robotics Center must be manually turned off after use.', '["True","False"]', '[1]', 12),
  ('What type of projects are allowed for 3D printing during downtimes?', '["Any personal project","Only projects related to STEM education and Placer Robotics'' mission","Projects approved by any volunteer","Commercial projects for resale"]', '[1]', 13),
  ('Where should IQ/V5 batteries be stored?', '["In a backpack or personal bag","On the workbench overnight","In the charging station or team kit","In the machine room cabinet"]', '[2]', 14),
  ('Any damage to the facility or equipment should be reported to the Executive Director or Board member immediately via the #facilities channel.', '["True","False"]', '[0]', 15),
  ('What type of tools are restricted to the machine room?', '["Battery chargers","Tools that create debris (files, handsaws, drills)","Screwdrivers and Allen wrenches","Soldering irons"]', '[1]', 16),
  ('What must you do if you are using V5 robots in the machine room?', '["Cover the robot with a cloth","Tape off all ports and vacuum the robot immediately after working","Work only near an open window","Disconnect the brain before starting"]', '[1]', 17),
  ('Closed-toed shoes are required at all times in the Robotics Center.', '["True","False"]', '[0]', 18),
  ('What should you do if you notice suspicious activity outside the Robotics Center?', '["Go outside to investigate","Lock all doors and notify supervisors or staff","Wait and see what happens","Take a photo for evidence first"]', '[1]', 19),
  ('Who should you contact for non-emergency issues such as loitering or trespassing?', '["911","The Executive Director","Allied Security","The local fire department"]', '[2]', 20),
  ('What is the first step to take in the event of a lockdown in the Robotics Center?', '["Evacuate the building","Call parents","Lock all doors","Turn off the lights"]', '[2]', 21),
  ('When is it required to wear safety glasses in the Robotics Center?', '["Only when using power tools","Always when working in the machine room","Only during competitions","Whenever you feel it is necessary"]', '[1]', 22),
  ('Which group is allowed full access to the machine room and corded power tools after training?', '["All registered students","Middle School Team Members after safety training","High School Team Members after safety training","Any volunteer with a key card"]', '[2]', 23),
  ('What Personal Protective Equipment (PPE) is required for all participants in the machine room?', '["Safety glasses only","Gloves and a face shield","Safety glasses, hearing protection, and closed-toed shoes","A lab coat and goggles"]', '[2]', 24),
  ('What PPE must be worn when operating noisy equipment such as the CNC router or drill press?', '["Ear protection","A dust mask","Cut-resistant gloves","A face shield"]', '[0]', 25),
  ('All tool use must stop immediately if someone enters the room without proper PPE.', '["True","False"]', '[0]', 26),
  ('IQ Team Members are allowed to use hand tools in the machine room.', '["True","False"]', '[1]', 27),
  ('What should you do if shared safety glasses are used?', '["Use them as-is to save time","Clean and sanitize them before use","Only wear your own glasses","Rinse them with water after use"]', '[1]', 28),
  ('What is the first step before using any tool in the machine room?', '["Plug the tool in","Inspect the tool for damage or defects","Put on gloves","Ask a peer to watch you"]', '[1]', 29),
  ('What should you do with broken drill bits or damaged tools?', '["Throw them in the trash","Keep using them carefully","Tag them as \"out of order\" and report them immediately","Set them aside for later use"]', '[2]', 30),
  ('How should workpieces be secured before using a tool or machine?', '["Hold them firmly by hand","Use clamps or a vise to secure them","Rest them against the wall","Have a partner hold them"]', '[1]', 31),
  ('What must you do immediately after using a tool?', '["Leave it on the bench for the next person","Clean the tool and return it to its proper storage location","Report your usage to a supervisor","Unplug everything in the room"]', '[1]', 32),
  ('Tools may be left plugged in as long as no one is using them.', '["True","False"]', '[1]', 33),
  ('What should you do before striking with a hammer or punch?', '["Clear the area of bystanders","Check that your grip is secure","Wear safety glasses","All of the above"]', '[3]', 34),
  ('When using a hand saw, what is the most important factor to remember?', '["Saw as quickly as possible","Secure the material and keep hands away from the cutting path","Use both hands on the handle","Keep the blade loose for flexibility"]', '[1]', 35),
  ('Only individuals who have completed training and passed the safety quiz may use the power tools.', '["True","False"]', '[0]', 36),
  ('What should be done if a power tool malfunctions during use?', '["Try to fix it yourself","Keep using it carefully until finished","Stop immediately, unplug the tool, and tag it as \"out of order\"","Set it aside and grab another tool"]', '[2]', 37),
  ('Which of the following is required before using a cordless drill?', '["Charge the battery to 100%","Make sure the bit is securely fastened, and the material is clamped","Wear cut-resistant gloves","Remove the safety guard"]', '[1]', 38),
  ('What should you do if you see an accident in the machine room?', '["Clean up the area first","Report the accident to a supervising adult immediately","Wait until the meeting ends","Handle it yourself if minor"]', '[1]', 39),
  ('Where should you go in the event of a minor injury?', '["Go home immediately","Use the first aid kit or eye wash station and notify a supervisor","Wait for a parent to arrive","Call 911 for any injury"]', '[1]', 40),
  ('What is the Buddy System, and when should it be used in the machine room?', '["Always using tools in pairs, especially for larger machines like the CNC router","Having a friend wait outside the room","Sharing one set of PPE between two people","Only working when a coach is watching"]', '[0]', 41),
  ('It''s safe to use your phone or listen to music while working in the machine room as long as you are careful.', '["True","False"]', '[1]', 42)
) as v(qtext, opts, correct, ord) on true
where q.quiz_type = 'lab_use' and q.version = '2026-27';

-- YP (youth_protection) — 16 questions.
insert into quiz_question (quiz_id, question_text, question_type, options, correct_answers, order_index)
select q.id, v.qtext, 'single_correct', v.opts::jsonb, v.correct::jsonb, v.ord
from quiz q
join (values
  ('What is required to become a Registered Volunteer at Placer Robotics?', '["Submitting a Registered Volunteer Application, completing CA-mandated training, fingerprinting, and passing internal training","Signing up on the team website","A verbal agreement with the Executive Director","Attending one team meeting"]', '[0]', 1),
  ('All parents attending events must complete AB506 compliance, including fingerprinting and background checks.', '["True","False"]', '[1]', 2),
  ('Which of the following is NOT a condition for becoming a Regular Volunteer?', '["Completing CA-mandated training","Passing a background check","Attending a public fundraiser without volunteering","Being fingerprinted"]', '[2]', 3),
  ('Under AB506, what defines a "Regular Volunteer"?', '["A person who supervises or interacts with children for over 32 hours per year or 16 hours per month","Anyone who attends a single event","A person who donates to the organization","A parent who drops off their child"]', '[0]', 4),
  ('Who does not need to become a Registered Volunteer at Placer Robotics?', '["A coach who leads weekly practices","A volunteer who mentors students all season","Parents that work a limited number of hours at robotics event in roles such as Clean up and field reset","A chaperone on official team travel"]', '[2]', 5),
  ('The two-adult rule is only necessary during official team competitions.', '["True","False"]', '[1]', 6),
  ('What is the first step you should take if you suspect child abuse or neglect at a Placer Robotics event?', '["Investigate the situation yourself","Report the suspicion directly to Child Protective Services (CPS) or law enforcement","Wait to gather more evidence","Notify the team captain"]', '[1]', 7),
  ('What is the "Two-Adult Rule" in Placer Robotics?', '["One adult may supervise as long as a parent is nearby","Two adults must always be present to the greatest extent possible when interacting with minors to prevent abuse or misconduct","Two students must always work together","Two adults must sign in at every event"]', '[1]', 8),
  ('Registered Volunteers are only required to complete their child protection training once, and they do not need to renew it.', '["True","False"]', '[1]', 9),
  ('Which of the following is NOT allowed during Official Team Travel transportation to a Placer Robotics event?', '["Following the planned route","Having two adults present","Making unauthorized stops during transportation","Keeping students together as a group"]', '[2]', 10),
  ('Which behavior would NOT align with Placer Robotics'' Youth Protection Policy?', '["Praising the whole team for their effort","Giving a special gift to one child to acknowledge their effort","Communicating with parents included","Maintaining the two-adult rule"]', '[1]', 11),
  ('Which of the following would be considered inappropriate according to the Placer Robotics Youth Protection Policy?', '["Posting an announcement to the whole team","Emailing a student with a parent copied","Sending a private text to a student","Speaking with a student in an open area"]', '[2]', 12),
  ('What is a key reason for the "Two-Adult Rule" in Placer Robotics'' Youth Protection Policy?', '["To split up the workload between volunteers","To prevent situations where an adult could be alone with a child, reducing the risk of abuse and misconduct","To make events run more smoothly","To ensure there is always a backup driver"]', '[1]', 13),
  ('A Registered Volunteer must report child abuse or neglect directly to Placer Robotics before notifying authorities.', '["True","False"]', '[1]', 14),
  ('You are supervising a robotics meeting, and you notice that a student has been left without a parent to pick them up. What should you do?', '["Drive the student home yourself","Leave the student to wait alone","Call the student''s emergency contact and notify them of the situation","Lock up and leave at the scheduled time"]', '[2]', 15),
  ('You are a Registered Volunteer and receive a private message from a student. What should you do?', '["Reply privately to be helpful","Ignore the message entirely","Delete the message and say nothing","Include another adult or the student''s parent in the response"]', '[3]', 16)
) as v(qtext, opts, correct, ord) on true
where q.quiz_type = 'youth_protection' and q.version = '2026-27';
