-- ============================================================================
-- Placer Robotics Hub — Participation waiver (BUG-08)
-- Migration: 20260620000020_seed_participation_waiver
--
-- Seeds the active 2026-27 liability/media-consent waiver into waiver_template.
-- The /register wizard renders every active waiver as its own section with an
-- acknowledgment checkbox, and /api/register records a waiver_signature per
-- active waiver — so making this row active is all that's needed to surface it.
--
-- body_hash is md5(body_markdown) (built-in) — it's the integrity stamp stored
-- on each signature. Idempotent via unique (waiver_type, version).
-- ============================================================================

insert into waiver_template (waiver_type, version, title, body_markdown, body_hash, effective_date, active)
select
  'student_participation'::waiver_type,
  '2026-27',
  'Release of Liability, Waiver of Right to Sue, Assumption of Risk & Media Consent',
  body,
  md5(body),
  date '2026-08-01',
  true
from (
  select $w$Release of Liability, Waiver of Right to Sue, Assumption of Risk, Agreement to Pay Claims, and Media Consent

This is a Release of Liability, Waiver of Right to Sue, Assumption of Risk, Agreement to Pay Claims, and Media Consent Agreement ("Agreement") between Placer Advanced Robotics and Technology, and its officers, directors, volunteers, advisors, mentors, employees and Designees (collectively, "PART"), and Participant (collectively referred to herein as "I", "me", "my" and "Participant"). "Designees" includes those persons or entities (including third parties not affiliated with PART) managing, contracting, sponsoring, hosting, conducting, evaluating or publicizing the Program (including individuals and third-party entities working with PART). "Program" is any PART competitive robotics and technology activity or event, including, but not limited to, the VEX Robotics Competition (VRC) program, BotsIQ program, National Robotics League (NRL) program, the combat bots program, new technology program, summer camps and classes. As used in this Agreement, Participant shall mean any individual, Parent or Guardian of a Participant under 18 years of age, student, mentor, advisor, volunteer, or other person or entity involved in a PART Program.

ASSUMPTION OF RISK

I am voluntarily participating in a Program. I recognize that there may be risks associated with attending and/or participating in the Program, including, without limitation, risks inherent in the building, lifting and/or using of electrical/mechanical robots; using/operating hand and power tools; working with electrical connections; working with mechanical systems or sharp objects; working with hazardous materials and batteries; traveling to and from events; and participating in public competitions. These risks include the risk of injury (including, without limitation, serious bodily harm, loss of sight, and even death) and property damage. I understand that these injuries or outcomes may arise from my own or others' actions, inaction, or negligence; conditions related to travel; or the condition of the Program location(s).

COVID-19

I acknowledge the contagious nature of COVID-19 and voluntarily assume the risk that I may be exposed to or infected by COVID-19 from participating in a PART Program, and that such exposure or infection may result in personal injury, illness, permanent disability, or death. I understand that the risk of becoming exposed to or infected by COVID-19 from participating in PART Program activities may result from the actions, omissions, or negligence of myself and others, including, but not limited to, PART, program participants and their families.

WAIVER AND RELEASE

In consideration for being allowed to participate in the Program activity, on behalf of myself and my next of kin, heirs, personal representatives, successors, or assigns, I hereby agree not to make a claim against, or sue, PART for and from any injury, illness, death, or property damage I may suffer arising out of participation in the Program, including, without limitation, travel to or from Program activities or PART's negligent failure to adequately investigate or screen coaches, mentors, volunteers, etc.

In addition, I, my next of kin, heirs, personal representatives, successors, or assigns release and discharge PART from all actions, claims, or demands, costs, attorneys' fees, expenses, losses, or liabilities, in law or in equity, of every kind and nature whatsoever, that I have or may later have for injury, illness, death, or property damage resulting from my participation in the above-listed activities.

INDEMNIFICATION

I also agree to indemnify and hold harmless PART against any and all claims against any such entity or person resulting from any and all claims, actions, suits, procedures, costs, expenses, damages and liabilities, including attorneys' fees, brought as a result of my involvement in the Program, and to reimburse PART for any such expenses incurred.

MEDICAL TREATMENT

In the event I should sustain any injuries or illness while attending and/or participating in a Program, I hereby authorize PART to administer, or cause to be administered, such first aid or other treatment and such medications as I may possess, as reasonably necessary under the circumstances, including, without limitation, treatment by a physician or hospital of PART's choice. If I need medical treatment, I agree to be financially responsible for any costs incurred as a result of such treatment.

MEDIA CONSENT

I also hereby assign and grant to PART the right and permission to use and publish the photographs/film/videotapes/electronic representations and/or sound recordings made of me or my child at all Programs, and I hereby release PART or other organizations associated with the Programs from any and all liability from such use and publication. I further authorize the reproduction, sale, copyright, exhibit, broadcast, electronic storage, and/or distribution of said photographs/film/videotapes/electronic representations and/or sound recordings without limitation at the discretion of PART, and I specifically waive any right to any compensation I may have for any of the foregoing.

GENERAL PROVISIONS

I understand the legal consequences of signing this document, including (a) releasing PART from all liability, (b) promising not to sue PART, and (c) assuming all risks of participating in the Programs, including travel to, from and during the Program. I understand that this document is written to be as broad and inclusive as legally permitted by the State of California. I agree that if any portion is held invalid or unenforceable, I will continue to be bound by the remaining terms.

CALIFORNIA CIVIL CODE SECTION 1542

I acknowledge and agree that this release applies to all claims for death, injury, damage, or loss to my person and property, whether known or unknown, foreseen or unforeseen, or patent or latent, and I hereby waive application of California Civil Code Section 1542. I understand and acknowledge that the significance and consequence of this waiver is that even if I should eventually suffer additional damages arising out of my participation in the Program or activity, I will not be able to make any claim for those damages. I acknowledge that I intend these consequences even as to claims for damages that may exist as of the date of this release but which I do not know existed, and which, if known, would materially affect my decision to execute this release. I certify that I have read the following provisions of California Civil Code Section 1542: "A general release does not extend to claims which the creditor does not know or suspect to exist in his or her favor at the time of executing the release, which if known by him or her must have materially affected his or her settlement with the debtor."

By checking the box below and typing my full legal name, I specifically acknowledge and waive the protections of California Civil Code Section 1542 as described above. (This electronic acknowledgment takes the place of initialing this section.)

ACKNOWLEDGMENT

I have read this Agreement in its entirety, fully understand its terms, and understand that I am giving up substantial rights, including my right to sue. I acknowledge that I am signing the Agreement freely and voluntarily, and intend by my signature to give a complete and unconditional release of all liability to the greatest extent allowed by law. No other representations concerning the legal effect of this document have been made to me.

IF PARTICIPANT IS UNDER 18 YEARS OF AGE

I am the parent or legal guardian of the Participant. I understand the legal consequences of signing this document, including (a) releasing PART from all liability on my and the Participant's behalf, (b) promising not to sue on my and the Participant's behalf, and (c) assuming all risks of the Participant's participation in this Program, including travel to, from and during the Program. I allow Participant to participate in this Program. I understand that I am responsible for the obligations and acts of Participant as described in this document. I agree to be bound by the terms of this document.$w$::text as body
) t
on conflict (waiver_type, version) do nothing;
