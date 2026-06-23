// Pure registration-compliance helpers (COPPA / under-13 gate + school-domain
// warning) shared by the register wizard, the register route, and unit tests.

export function ageFromDob(dob: string, now: Date = new Date()): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a
}

export function isUnder13(age: number | null): boolean {
  return age != null && age < 13
}

// Parental (COPPA) consent is required for grade 6/7 students or anyone under 13.
export function needsCoppa(grade: number, age: number | null): boolean {
  return grade === 6 || grade === 7 || isUnder13(age)
}

// School/monitored email domains we warn about (non-blocking).
export function isSchoolDomain(email: string): boolean {
  const e = email.trim().toLowerCase()
  const at = e.indexOf('@')
  if (at < 0) return false
  const domain = e.slice(at + 1)
  return domain.includes('k12.ca.us') || domain.includes('edu') || e.includes('@school') || e.includes('@student') || /k12|unified|usd|cusd|nusd|pusd/.test(domain)
}
