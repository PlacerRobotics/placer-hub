// One-off: re-head + clean the JotForm registration export into the /admin/import format.
//   node scripts/transform-reg-preload.mjs <in.csv> <out.csv>
// - remaps verbose headers → importer keys
// - program vex-v5 → vex_v5; import_action NO → skip; grade Fall 2025 → +1 (Fall 2026)
// - clears guardian2 when it equals guardian1 (avoids upsert conflict)
// - merges a student's V5 + Combat rows into one program=both row
// - drops empty/junk rows; reports anything still missing required fields
import { readFileSync, writeFileSync } from 'node:fs'

const [inPath, outPath] = process.argv.slice(2)
if (!inPath || !outPath) { console.error('usage: node transform-reg-preload.mjs <in.csv> <out.csv>'); process.exit(1) }

// --- minimal RFC4180 CSV parser (handles quotes + embedded commas/newlines) ---
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch === '\r') { /* skip */ }
    else field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

const grid = parseCsv(readFileSync(inPath, 'utf8')).filter((r) => r.some((c) => String(c).trim()))
const header = grid.shift().map((h) => h.trim())
const idx = (pred) => header.findIndex(pred)
const M = {
  student_first_name: idx((h) => h === 'First Name'),
  student_last_name: idx((h) => h === 'Last Name'),
  student_email: idx((h) => h === 'Participant Email Address'),
  student_phone: idx((h) => h === 'Participant Cell Phone'),
  guardian1_first: idx((h) => h === 'Parent/Legal Guardian Completing Registration (First Name)'),
  guardian1_last: idx((h) => h === 'Parent/Legal Guardian Completing Registration (Last Name)'),
  guardian1_email: idx((h) => h === 'Parent/Legal Guardian Email'),
  guardian1_phone: idx((h) => h === 'Parent Phone Number'),
  guardian2_first: idx((h) => h.startsWith('2nd Parent') && h.endsWith('(First Name)')),
  guardian2_last: idx((h) => h.startsWith('2nd Parent') && h.endsWith('(Last Name)')),
  guardian2_email: idx((h) => h === '2nd Parent Email'),
  guardian2_phone: idx((h) => h === '2nd Parent Phone Number'),
  street_address: idx((h) => h === 'Street Address'),
  street_address_2: idx((h) => h === 'Street Address Line 2'),
  city: idx((h) => h === 'City'),
  state: idx((h) => h === 'State / Province'),
  zip: idx((h) => h === 'Postal / Zip Code'),
  grade: idx((h) => h === 'Grade Fall 2025'),
  school: idx((h) => h === 'School Attending Fall 2025'),
  tshirt_size: idx((h) => h.startsWith('T-Shirt Size')),
  employer_match: idx((h) => h.startsWith('Matching Gift')),
  employer_match_company: idx((h) => h.startsWith('Company Name')),
  employer_match_pct: idx((h) => h.startsWith('Matching Percentage')),
  program_26_27: idx((h) => h === 'program_26_27'),
  team_26_27: idx((h) => h === 'team_26_27'),
  import_action: idx((h) => h === 'import_action'),
}
const miss = Object.entries(M).filter(([, v]) => v < 0).map(([k]) => k)
if (miss.length) { console.error('Could not find source columns for:', miss.join(', ')); process.exit(1) }

const get = (r, k) => String(r[M[k]] ?? '').trim()
const normState = (s) => (/^cal/i.test(s) ? 'CA' : /^ca$/i.test(s) ? 'CA' : s)
const fixEmail = (e) => e.trim().replace(/\.\.+/g, '.').toLowerCase()
const normProgram = (p) => { const v = p.trim().toLowerCase().replace(/-/g, '_'); return ['vex_v5', 'combat', 'vex_iq', 'both'].includes(v) ? v : (v ? `not_sure(${p.trim()})` : '') }
const normAction = (a) => { const v = a.trim().toLowerCase(); if (v === 'no' || v === 'skip') return 'skip'; if (v === 'hold') return 'hold'; return '' }
const bumpGrade = (g) => { const d = String(g).replace(/[^\d]/g, ''); return d ? String(parseInt(d, 10) + 1) : '' }

const OUT_COLS = ['student_first_name', 'student_last_name', 'student_email', 'student_phone', 'guardian1_first', 'guardian1_last', 'guardian1_email', 'guardian1_phone', 'guardian2_first', 'guardian2_last', 'guardian2_email', 'guardian2_phone', 'street_address', 'street_address_2', 'city', 'state', 'zip', 'grade_fall_2026', 'school', 'tshirt_size', 'employer_match', 'employer_match_company', 'employer_match_pct', 'program_26_27', 'team_26_27', 'import_action', 'notes']

const recs = []
const warnings = []
for (let i = 0; i < grid.length; i++) {
  const r = grid[i]
  const sFirst = get(r, 'student_first_name'), sLast = get(r, 'student_last_name')
  const program = normProgram(get(r, 'program_26_27'))
  if (!sFirst && !sLast && !program) continue // junk/empty row
  const g1email = fixEmail(get(r, 'guardian1_email'))
  let g2email = fixEmail(get(r, 'guardian2_email'))
  let g2 = { first: get(r, 'guardian2_first'), last: get(r, 'guardian2_last'), email: g2email, phone: get(r, 'guardian2_phone') }
  if (g2email && g2email === g1email) g2 = { first: '', last: '', email: '', phone: '' } // single guardian repeated
  const emp = get(r, 'employer_match')
  const rec = {
    student_first_name: sFirst, student_last_name: sLast, student_email: fixEmail(get(r, 'student_email')) || '', student_phone: get(r, 'student_phone'),
    guardian1_first: get(r, 'guardian1_first'), guardian1_last: get(r, 'guardian1_last'), guardian1_email: g1email, guardian1_phone: get(r, 'guardian1_phone'),
    guardian2_first: g2.first, guardian2_last: g2.last, guardian2_email: g2.email, guardian2_phone: g2.phone,
    street_address: get(r, 'street_address'), street_address_2: get(r, 'street_address_2'), city: get(r, 'city'), state: normState(get(r, 'state')), zip: get(r, 'zip'),
    grade_fall_2026: bumpGrade(get(r, 'grade')), school: get(r, 'school'), tshirt_size: get(r, 'tshirt_size'),
    employer_match: /^yes/i.test(emp) ? 'yes' : (emp ? 'no' : ''), employer_match_company: get(r, 'employer_match_company'), employer_match_pct: get(r, 'employer_match_pct'),
    program_26_27: program, team_26_27: get(r, 'team_26_27'), import_action: normAction(get(r, 'import_action')), notes: '',
    _row: i + 2,
  }
  recs.push(rec)
}

// Merge a student's V5 + Combat rows into one program=both row (V5 team kept; combat team noted).
const byKey = new Map()
for (const rec of recs) {
  if (rec.import_action === 'skip') continue
  const key = `${rec.student_first_name}|${rec.student_last_name}|${rec.guardian1_email}`.toLowerCase()
  ;(byKey.get(key) ?? byKey.set(key, []).get(key)).push(rec)
}
const dropped = new Set()
for (const [key, list] of byKey) {
  if (list.length < 2) continue
  const progs = new Set(list.map((x) => x.program_26_27))
  const v5 = list.find((x) => x.program_26_27 === 'vex_v5')
  const combat = list.find((x) => x.program_26_27 === 'combat')
  if (v5 && combat) {
    v5.program_26_27 = 'both'
    v5.notes = [v5.notes, `Combat team: ${combat.team_26_27 || 'tbd'} (assign manually)`].filter(Boolean).join(' ')
    dropped.add(combat)
    warnings.push(`MERGED to 'both': ${v5.student_first_name} ${v5.student_last_name} — V5 ${v5.team_26_27 || '-'} + Combat ${combat.team_26_27 || '-'} (rows ${v5._row}/${combat._row})`)
  } else {
    warnings.push(`DUPLICATE student (kept first): ${list[0].student_first_name} ${list[0].student_last_name} — rows ${list.map((x) => x._row).join(',')} [${[...progs].join(', ')}]`)
    list.slice(1).forEach((x) => dropped.add(x))
  }
}

const final = recs.filter((r) => !dropped.has(r))
// Validate required fields on rows that will actually load (not skip).
for (const r of final) {
  if (r.import_action === 'skip') continue
  const need = []
  if (!r.guardian1_email) need.push('guardian1_email')
  if (!r.city) need.push('city'); if (!r.zip) need.push('zip'); if (!r.grade_fall_2026) need.push('grade')
  if (r.program_26_27.startsWith('not_sure(')) warnings.push(`UNKNOWN program "${r.program_26_27}" row ${r._row} (${r.student_first_name} ${r.student_last_name}) → will load as not_sure`)
  if (need.length) warnings.push(`MISSING ${need.join('+')} row ${r._row} (${r.student_first_name} ${r.student_last_name})`)
}

const lines = [OUT_COLS.join(',')]
for (const r of final) lines.push(OUT_COLS.map((c) => csvCell(r[c] ?? '')).join(','))
writeFileSync(outPath, lines.join('\n') + '\n')

const loadable = final.filter((r) => r.import_action !== 'skip')
console.log(`Wrote ${final.length} rows → ${outPath}`)
console.log(`  to load: ${loadable.length}  ·  skip: ${final.filter((r) => r.import_action === 'skip').length}  ·  merged/dropped: ${dropped.size}`)
console.log(`  program: ${['vex_v5', 'combat', 'both', 'vex_iq'].map((p) => `${p}=${loadable.filter((r) => r.program_26_27 === p).length}`).join('  ')}`)
console.log('\nWarnings / things to check:')
for (const w of warnings) console.log('  • ' + w)
