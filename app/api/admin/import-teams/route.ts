import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

function g(r: any, k: string) {
  return String(r?.[k] ?? '').trim()
}
function normProgram(v: string): string | null {
  const u = v.toUpperCase()
  if (u.includes('V5')) return 'vex_v5'
  if (u.includes('IQ')) return 'vex_iq'
  if (u.includes('COMBAT')) return 'combat'
  return null
}
function normDivision(v: string): string | null {
  const u = v.trim().toLowerCase()
  if (['es', 'elementary', 'elementary school'].includes(u)) return 'ES'
  if (['ms', 'middle', 'm', 'middle school'].includes(u)) return 'MS'
  if (['hs', 'high', 'h', 'high school'].includes(u)) return 'HS'
  return null
}
function numOrNull(v: string): number | null {
  const s = v.replace(/[^0-9.]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Team-records import. Creates/updates rows in `team` from an admin CSV.
 * Required per row: program (V5/IQ/Combat), division (MS/HS), school_org, and a
 * team_number or team_name. Dedups on (season, program, team_number). Does NOT
 * assign students — team_member assignment requires an enrollment (registration).
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const rows: any[] = Array.isArray(body.rows) ? body.rows : []
  const db = createAdminClient()

  let created = 0, updated = 0
  const errors: { row: number; message: string }[] = []
  const results: { row: number; team: string; action: string; status: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNo = i + 1
    const teamNumber = g(r, 'team_number')
    const teamName = g(r, 'team_name')
    const label = teamNumber || teamName || 'Unknown'

    try {
      const program = normProgram(g(r, 'program'))
      const division = normDivision(g(r, 'division'))
      const schoolOrg = g(r, 'school_org')
      if (!teamNumber && !teamName) throw new Error('missing team_number/team_name')
      if (!program) throw new Error('missing/invalid program (V5/IQ/Combat)')
      if (!division) throw new Error('missing/invalid division (MS/HS)')
      if (!schoolOrg) throw new Error('missing school_org')

      const fields: Record<string, unknown> = {
        season: SEASON, program, division, school_org: schoolOrg,
        team_number: teamNumber || null, team_name: teamName || null,
      }
      const fee = numOrNull(g(r, 'team_fee_amount'))
      if (fee != null) fields.team_fee_amount = fee

      let existing: any = null
      if (teamNumber) {
        existing = (await db.from('team').select('id').eq('season', SEASON).eq('program', program).eq('team_number', teamNumber).maybeSingle()).data
      }
      if (existing) {
        const { error } = await db.from('team').update(fields).eq('id', existing.id)
        if (error) throw new Error(error.message)
        updated++
        results.push({ row: rowNo, team: label, action: 'update', status: 'updated' })
      } else {
        // Imported teams are existing/returning teams — create them live.
        const { error } = await db.from('team').insert({ ...fields, status: 'active' })
        if (error) throw new Error(error.message)
        created++
        results.push({ row: rowNo, team: label, action: 'create', status: 'created' })
      }
    } catch (exc: any) {
      errors.push({ row: rowNo, message: exc?.message ?? 'unknown' })
      results.push({ row: rowNo, team: label, action: 'error', status: `error: ${exc?.message ?? 'unknown'}` })
    }
  }

  return NextResponse.json({ ok: true, summary: { created, updated, errors: errors.length }, errors, results })
}
