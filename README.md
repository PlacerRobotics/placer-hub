# placer-hub

Registration, family portal, volunteer clearance, and admin operations platform for [Placer Advanced Robotics and Technology](https://placerrobotics.org).

**Production:** [hub.placerrobotics.org](https://hub.placerrobotics.org)  
**Stack:** Next.js 15 · TypeScript · Tailwind CSS · Supabase · Vercel  
**Repo:** [github.com/PlacerRobotics/placer-hub](https://github.com/PlacerRobotics/placer-hub)

---

## Quick start

```bash
npm install
cp .env.example .env.local
# Fill in .env.local — see docs/environment.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
placer-hub/
├── app/                        # Next.js App Router
│   ├── apply/                  # Public application form (no auth)
│   ├── login/                  # Magic link login
│   ├── dashboard/              # Family dashboard (auth required)
│   ├── register/               # Registration wizard (auth required)
│   ├── volunteer/              # Volunteer clearance (auth required)
│   ├── admin/                  # Admin dashboard + queues (auth + role required)
│   ├── api/auth/callback/      # Magic link auth callback
│   └── layout.tsx              # Root layout with design tokens
├── components/
│   ├── ui/                     # Design system components (Task 1.5)
│   ├── family/                 # Family-facing components
│   └── admin/                  # Admin-facing components
├── lib/
│   ├── env.ts                  # Environment variable validation
│   ├── supabase/
│   │   ├── client.ts           # Browser client (anon key, RLS)
│   │   ├── server.ts           # Server client (cookie auth)
│   │   └── admin.ts            # Admin client (service role, bypasses RLS)
│   └── utils/
├── supabase/migrations/        # SQL schema migrations (Task 2)
├── scripts/                    # Python ETL + sync scripts
│   ├── etl_25_26_migration.py  # 25-26 historical data migration
│   ├── sync_applications.py    # Phase 1 Google Form sync job
│   └── seed_schools.py         # School table seed
├── docs/                       # All product documentation
│   ├── product_requirements_v1_13.md
│   ├── ux_requirements_v1_0.md
│   ├── functional_flow_v1_6.md
│   ├── workflow_diagrams_v1_3.html
│   ├── etl_migration_spec_v1_0.md
│   ├── environment.md
│   └── deployment.md
├── middleware.ts                # Auth route protection
├── .env.example                # Environment variable template
└── .gitignore
```

---

## Environment setup

Copy `.env.example` to `.env.local` and fill in the required values. See `docs/environment.md` for full reference.

**Minimum for local dev (Release 1):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BOOTSTRAP_ADMIN_EMAIL=kevin.miller@placerrobotics.org
```

---

## Development rules

1. One Codex task at a time. Run `npm run typecheck` after each.
2. No hardcoded season values, fees, or dates — all come from `season_config`.
3. No secrets in code or Git — environment variables only.
4. Family-facing UI never exposes: `family_season`, `enrollment`, `team_member`, `payment_transaction`, `waiver_template`, or any raw enum values.
5. Admin home is always a "Needs Attention" queue — never a raw table.
6. Financial aid details are RLS-restricted — never visible to Registration Admin.
7. No student login of any kind.
8. No product screen wired to live data until its static wireframe (Task 1.6) exists.
9. Full guardrail list (84 items): `docs/product_requirements_v1_13.md` Section 17.

---

## Build

```bash
npm run dev          # Development server
npm run build        # Production build
npm run typecheck    # TypeScript check only
npm run lint         # ESLint
```

Build requires env vars. Use `SKIP_ENV_VALIDATION=true npm run build` for CI without secrets.

---

## Release plan

| Release | Scope | Status |
|---|---|---|
| **1** | Schema · Phase 1 sync · Application review · Registration form · Manual payment · Roster export | 🔨 Active |
| 2 | Zeffy webhook · IQ team creation and fee | Planned |
| 3 | Volunteer clearance · APS · Quizzes · UniFi | Planned |
| 4 | Google Group / Slack sync | Planned |
| 5 | Dashboards · Broadcasts · Student director | Planned |
| 6 | Annual renewal automation | Planned |

---

## Docs

Full product documentation in `/docs`. Start here:
- **What to build:** `product_requirements_v1_13.md`
- **How it should look/feel:** `ux_requirements_v1_0.md`
- **How flows work:** `functional_flow_v1_6.md`
- **Visual diagrams:** open `workflow_diagrams_v1_3.html` in a browser
- **ETL migration (Kevin):** `etl_migration_spec_v1_0.md`
