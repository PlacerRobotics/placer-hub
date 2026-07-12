# Design analysis — email identity, duplicates, and family merges (proposed)

**Status:** ANALYSIS ONLY — no code written, decisions pending Kevin.
**Date:** 2026-07-12
**Trigger:** dedupe cleanup after the mailto: incident surfaced three recurring patterns
(mismatched legacy emails / intentional admin logins / genuinely split families), plus the
constraint that **APS (MinistrySafe) emails of record cannot change**.

---

## 0. Facts first — what is and isn't keyed to email (verified against code)

These matter because most of the fear ("her whole cert flow breaks if her email changes")
turns out not to apply. Verified 2026-07-12:

1. **No primary key anywhere is an email.** Every table keys on UUID. Email appears in
   exactly two UNIQUE columns: `guardian.login_email` (the magic-link sign-in match) and
   `family.primary_email` (a legacy denormalization — used only as a display fallback and
   in two import lookups; it is NOT identity).
2. **APS is keyed by `aps_user_id`, never email.** The daily MinistrySafe sync
   (`lib/aps.ts`) fetches trainings by user id; cert expiry tracking, renewal reminders,
   and the volunteer dashboard all flow from that id. We also store
   `aps_training_url` — MinistrySafe's **direct login link** — so the volunteer never
   even types their (yahoo) APS email to get in.
3. **Moving a volunteer record between guardians does not touch APS.** All volunteer
   history (clearances, steps, youth-protection certs) keys off `volunteer_id`; the
   move-guardian action repoints two fields on one row. The Sheth/Sousseff cert-expiry
   flow continues untouched — same `aps_user_id`, same certs, same expiry dates, same
   sync.
4. **The only thing still living on the legacy email is MinistrySafe's own side**:
   their login page and their notification emails. We never need to *change* an APS
   email of record — but (flaw Kevin caught in the first draft of this doc) the
   volunteer still needs to **know** what it is, and they will forget a yahoo address
   from years ago. The stored direct-login URL covers the through-the-Hub path only;
   a MinistrySafe password reset, support call, or notification email all require
   knowing which address the account lives under. See §1.5 — the fix is to store and
   display the "APS login email of record," and it's fully backfillable from the
   MinistrySafe API (no one has to remember anything).
5. **Nothing reads waiver signatures by `family_id`** — every read resolves by
   `student_id` or `guardian_id`. (Matters for merges: append-only signature rows can be
   safely left behind on an archived husk.)
6. **Future APS accounts are Hub-created** (`enrollApsTraining` uses `login_email`), so
   this mismatch class stops growing on its own.

---

## 1. Case 1 — mismatched emails (Slack / original import "primary 1" / APS legacy)

**Root cause:** every ingestion path — `/apply`, IQ roster-add, all four imports,
volunteer apply, **and Zeffy payment matching** — looks a guardian up by exactly ONE
string: `guardian.login_email`. Any known-alternate address (the yahoo they used for
APS years ago, the outlook they abandoned for Drive/Calendar interop, the email a coach
happens to have for them) fails the lookup and **mints a duplicate family**. The
multi-email columns we have (`communication_email`, `slack_email`) are *outbound*
purpose columns — nothing uses them for *inbound* matching, and neither is semantically
right for "old yahoo from the APS era."

### Options

**A. Guardian email aliases (recommended).** One new table:

```
guardian_email_alias (
  id uuid pk,
  guardian_id uuid not null references guardian(id) on delete cascade,
  email text not null unique,          -- globally unique across aliases
  source text,                          -- 'aps_legacy' | 'former_login' | 'import' | 'manual'
  created_at timestamptz
)
```

One shared lookup helper (`findGuardianByAnyEmail`) replaces the single-email `ilike`
at every ingestion point: match `login_email` first, then aliases (then
`communication_email`/`slack_email` as a courtesy). Aliases get recorded:

- **automatically** when an admin changes a login email (old address → alias, so it can
  never spawn a duplicate again);
- **automatically** during any merge/cleanup (the absorbed guardian's emails → aliases
  of the survivor);
- **manually** via an "Add known email" control on the family detail page — this is
  where the APS-legacy yahoo goes. So yes: we "bring over the APS legacy email," but as
  a *lookup alias*, not a new dedicated column, and not by touching APS.

Side benefit: **Zeffy reconciliation** starts matching payments made under an old email
instead of dumping them in the unmatched queue.

Cost: 1 small migration + touching ~8 lookup sites + tests. No behavior change for
anyone with one email.

**B. Match against existing columns only** (communication/slack, no schema change).
Cheaper, but there's no honest place to store an APS-legacy yahoo
(`communication_email` means "Google Workspace" by PRD §16), so the biggest source of
mismatch stays unfixed.

**C. Status quo + cleanup tools.** Reactive whack-a-mole; every future import/roster-add
with an alternate email creates a new dupe to clean.

**Recommendation: A.** It's the "merge in the alternate email somehow" instinct, made
concrete, and it kills the root cause at ingestion rather than cleaning up after it.

### 1.5 The APS login email of record (companion piece to Option A)

An alias makes the old address *matchable*; the volunteer-facing problem is different:
"what email do I log into MinistrySafe with?" — answerable nowhere today, and the
person will have forgotten. Proposal:

- **New column `volunteer_profile.aps_email`** — the APS account's login email of
  record, an attribute of the APS account alongside `aps_user_id` /
  `aps_training_url` (a dedicated column, not just an alias row, so it's directly
  displayable and unambiguous).
- **Backfilled automatically**: MinistrySafe's `GET /users/:id` (already wrapped as
  `getApsUser` in `lib/aps.ts`) returns the account `email`. One admin-triggered
  backfill pass populates it for every volunteer with an `aps_user_id`; the daily APS
  sync keeps it fresh thereafter. Nobody has to remember anything.
- **Displayed** on the volunteer portal's APS section ("Your training account:
  x@yahoo.com — use the button below to sign in without a password") and on the admin
  volunteer detail page.
- **Fed into the alias table** (source `aps_legacy`) so the same address also prevents
  duplicate-minting at ingestion — the two mechanisms compose.
- Going forward, Hub-created APS accounts (`enrollApsTraining`) set `aps_email =
  login_email` at creation, so the value is always present.

---

## 2. Case 2 — intentional separate admin logins (Amity Chavez @placerrobotics.org)

**How the two identities actually work:** admin-ness is a role on an auth account
(`admin_profile` + role assignments); family-ness is a `guardian` row matched by login
email. They are independent — one email can hold both (the family dashboard already
shows an "Admin dashboard →" link to any admin), and two emails hold them separately.

**Should we collapse?** Recommendation: **no — keep staff logins on
@placerrobotics.org.** Reasons: offboarding is domain-controlled (disable the org
account, admin access dies with it, family account survives); org accounts can carry
org security policy; and audit trails distinguish "Amity the registrar" from "Amity the
parent." Collapsing saves one password at the cost of coupling her family identity to
her staff tenure. If she personally prefers one login, it's supported today (grant the
role to her personal email at `/admin/admins`, revoke the org grant) — but as policy,
separate is better.

**The actual annoyance to fix:** the duplicates report flags her name pair forever.
Proposal (code-only, no schema): the same-name grouping **ignores
@placerrobotics.org logins** — staff logins are never "duplicate families." If we later
find non-staff false positives, add a small "dismiss this pair" persistence then, not
now.

---

## 3. Case 3 — one real family split across two records (Chunlee & Chunyee Shu)

Two genuine families each holding one parent (both volunteers) and one kid — parent 1
is guardian on student A's record, parent 2 on student B's. Per Kevin (2026-07-12):
**all the emails on both records are correct** — no alias/email work involved; this is
purely a structural merge. The current tools deliberately stop short: move-student
refuses registered students (enrollments carry payment references), and there's no way
to move a *guardian*. This needs the real **Merge Families** operation:

**Semantics** (survivor A absorbs B):
- Repoint to A: `guardian.family_id` (B's parents become A's guardian 2..n),
  `volunteer_profile.family_id` (their volunteer records ride along — APS untouched, per
  §0), `student` + `student_application` + `emergency_contact` + `enrollment` +
  `payment_transaction` + `financial_aid` (**all verified mutable** — none append-only).
- `family_season`: unique per family+season — keep the further-along status of the two
  (order: registered > cleared_to_register > accepted > applied > prospect), delete B's
  row, note both prior values in the audit log.
- `waiver_signature`: append-only, stays pointing at B — harmless (per §0.5 nothing
  reads them by family), and it means B cannot be deleted → **archive B** (tool exists),
  and archived families are already excluded from the dupes report.
- Record B's guardian emails as aliases of their (moved) guardian rows if Option 1A
  lands — otherwise nothing else changes.
- UI: on B's family page, "Merge into another family…" with a **preview** (everything
  that will move, by name and count) and an explicit confirm. Registrar/super only.

**Watch-outs** (why this is a considered operation, not a button-mash):
- `guardian.login_email` stays unique per guardian, so both parents keep their own
  logins — good; both will now land on the same family dashboard.
- Two volunteer records in one family is fine (`volunteer_profile.guardian_id` unique,
  not family).
- Payment reference codes ride on enrollments — repointing enrollment + payment rows
  together keeps Zeffy reconciliation coherent (match key includes guardian sign-in
  email, which doesn't change).

Effort: Fable/high, same test harness as the family-cleanup suite. This one action also
retires "move registered students" as a separate need — a merge is the safe superset.

---

## 4. Also on the list

- **Change-login-email function**: exists (`/admin/families/[id]` → change email;
  updates `guardian.login_email` + the auth account) but is flagged in AGENTS.md as
  never exercised against live. Needs one supervised live test. With Option 1A, it
  should also auto-record the old address as an alias.
- **`family.primary_email` uniqueness** is a second collision surface with no identity
  value (it blocked part of the mailto cleanup). Candidate for a later migration:
  drop the UNIQUE constraint or backfill it to mirror guardian 1 and treat as display
  only. Not urgent; noting it so it doesn't surprise us again.

## 5. Decisions needed from Kevin

1. **Approve Option 1A + §1.5** (alias table + match-any-known-email at ingestion +
   manual "Add known email", plus `aps_email` column backfilled from the MinistrySafe
   API and shown to volunteers/admins), or prefer B/C?
2. **Case 2 policy**: keep separate staff logins + exclude @placerrobotics.org from the
   dupes report? (Recommended.) Or collapse Amity to one login?
3. **Approve the Merge Families spec** (§3) for the Shu family — build it, or handle
   Shu as a one-off by hand first (registered kids make by-hand risky; I'd build it)?
4. Sequence: my suggestion is 1A first (stops new dupes), then Merge Families (fixes
   Shu and any future real splits), then the dupes-report staff exclusion (one-liner
   rider on either PR).
