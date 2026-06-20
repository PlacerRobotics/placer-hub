# Deployment Guide

## Platform

Vercel. Production domain: `hub.placerrobotics.org`.

## First deploy

1. Push repo to `github.com/PlacerRobotics/placer-hub`
2. Import project in Vercel dashboard → connect to GitHub repo
3. Set environment variables (see `docs/environment.md`)
4. Set custom domain: `hub.placerrobotics.org` → add CNAME in DNS
5. Deploy

## Database setup (first time)

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Link to production project
supabase link --project-ref your-project-ref

# 3. Run migrations
supabase db push

# 4. Verify RLS is enabled on all tables
# Check in Supabase dashboard → Database → Tables → each table should show RLS: enabled

# 5. Run bootstrap (sets BOOTSTRAP_ADMIN_EMAIL as Super Admin)
# This runs automatically on first migration via SQL seed
```

## Go-live checklist

- [ ] All environment variables set in Vercel (production environment)
- [ ] Supabase RLS enabled on all tables
- [ ] Custom domain `hub.placerrobotics.org` configured and SSL active
- [ ] Transactional email domain configured (SPF, DKIM, DMARC)
- [ ] Magic link email tested end-to-end
- [ ] Bootstrap admin login verified
- [ ] ETL migration script run (dry-run, then live) — see `docs/etl_migration_spec_v1_0.md`
- [ ] Phase 1 sync job deployed and running
- [ ] Zeffy webhook endpoint tested
- [ ] School table seeded

## Preview deploys

Every push to a branch creates a Vercel preview deploy automatically. Preview deploys use the development Supabase project. Share preview URLs with stakeholders for review before merging to main.

## Production deploys

Push to `main` → Vercel auto-deploys to production. Review in preview first.

## Rollback

In Vercel dashboard → Deployments → select a prior deployment → Promote to Production.
