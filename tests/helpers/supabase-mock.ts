// Minimal in-memory Supabase-js stand-in for horizontal-escalation tests.
//
// It backs a PostgREST-style fluent query builder with plain JS arrays so the REAL
// route handlers can run end-to-end without a database. The point is to prove that
// the app-level ownership checks (guardian → family_id, volunteer → profileId) fire:
// the mock does NOT enforce RLS, exactly like the service-role client the routes use,
// so any row a route asks for by id is returned — the 403 has to come from the route.
//
// Supports only the operations the audited routes actually use: select / insert /
// update / upsert / delete, the eq/neq/ilike/is/in/gt(e)/lt(e) filters, and
// order/limit/single/maybeSingle terminals.

type Row = Record<string, any>
export type Tables = Record<string, Row[]>

type FilterKind = 'eq' | 'neq' | 'ilike' | 'is' | 'in' | 'gte' | 'lte' | 'gt' | 'lt'
type Filter = { kind: FilterKind; col: string; val: any }

let idCounter = 0

class Query implements PromiseLike<{ data: any; error: any }> {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private filters: Filter[] = []
  private payload: any = null
  private conflict: string[] | null = null
  private returning = false
  private terminal: 'array' | 'maybe' | 'single' = 'array'
  private limitN: number | null = null
  private wantCount = false

  constructor(private tables: Tables, private table: string) {}

  private rows(): Row[] {
    return (this.tables[this.table] ??= [])
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    // On a write chain, `.select()` requests the affected rows back.
    if (this.op !== 'select') this.returning = true
    if (opts?.count) this.wantCount = true
    return this
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = rows; return this }
  update(obj: Row) { this.op = 'update'; this.payload = obj; return this }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert'; this.payload = rows
    this.conflict = opts?.onConflict ? opts.onConflict.split(',').map((s) => s.trim()) : null
    return this
  }
  delete() { this.op = 'delete'; return this }

  eq(col: string, val: any) { this.filters.push({ kind: 'eq', col, val }); return this }
  neq(col: string, val: any) { this.filters.push({ kind: 'neq', col, val }); return this }
  ilike(col: string, val: any) { this.filters.push({ kind: 'ilike', col, val }); return this }
  is(col: string, val: any) { this.filters.push({ kind: 'is', col, val }); return this }
  in(col: string, vals: any[]) { this.filters.push({ kind: 'in', col, val: vals }); return this }
  gte(col: string, val: any) { this.filters.push({ kind: 'gte', col, val }); return this }
  lte(col: string, val: any) { this.filters.push({ kind: 'lte', col, val }); return this }
  gt(col: string, val: any) { this.filters.push({ kind: 'gt', col, val }); return this }
  lt(col: string, val: any) { this.filters.push({ kind: 'lt', col, val }); return this }
  order(_col?: string, _opts?: any) { return this }
  limit(n: number) { this.limitN = n; return this }

  maybeSingle() { this.terminal = 'maybe'; return this.exec() }
  single() { this.terminal = 'single'; return this.exec() }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected)
  }

  private test(r: Row, f: Filter): boolean {
    const v = r[f.col]
    switch (f.kind) {
      case 'eq': return v === f.val || String(v) === String(f.val)
      case 'neq': return !(v === f.val || String(v) === String(f.val))
      // No wildcards are used by the audited routes; treat ilike as case-insensitive equality.
      case 'ilike': return typeof v === 'string' && typeof f.val === 'string' && v.toLowerCase() === f.val.toLowerCase()
      case 'is': return v === f.val
      case 'in': return Array.isArray(f.val) && f.val.map(String).includes(String(v))
      case 'gte': return v >= f.val
      case 'lte': return v <= f.val
      case 'gt': return v > f.val
      case 'lt': return v < f.val
    }
  }

  private match(): Row[] {
    return this.rows().filter((r) => this.filters.every((f) => this.test(r, f)))
  }

  private async exec(): Promise<{ data: any; error: any }> {
    try {
      const t = this.rows()
      if (this.op === 'select') {
        let rows = this.match()
        const count = this.wantCount ? rows.length : undefined
        if (this.limitN != null) rows = rows.slice(0, this.limitN)
        if (this.terminal === 'maybe') return { data: rows[0] ?? null, error: null, count } as any
        if (this.terminal === 'single') return rows[0] ? ({ data: rows[0], error: null, count } as any) : { data: null, error: { message: 'no rows' } }
        return { data: rows, error: null, count } as any
      }
      if (this.op === 'insert' || this.op === 'upsert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
        const affected: Row[] = []
        for (const row of rows) {
          if (this.op === 'upsert' && this.conflict) {
            const existing = t.find((r) => this.conflict!.every((c) => String(r[c]) === String(row[c])))
            if (existing) { Object.assign(existing, row); affected.push(existing); continue }
          }
          const withId = { id: row.id ?? `gen-${this.table}-${++idCounter}`, ...row }
          t.push(withId); affected.push(withId)
        }
        const data = this.returning
          ? (this.terminal === 'single' ? affected[0] : this.terminal === 'maybe' ? (affected[0] ?? null) : affected)
          : null
        return { data, error: null }
      }
      if (this.op === 'update') {
        const rows = this.match()
        for (const r of rows) Object.assign(r, this.payload)
        const data = this.returning ? (this.terminal === 'single' ? (rows[0] ?? null) : rows) : null
        return { data, error: null }
      }
      // delete
      const doomed = this.match()
      this.tables[this.table] = t.filter((r) => !doomed.includes(r))
      return { data: null, error: null }
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? 'mock error' } }
    }
  }
}

export type MockDb = { from: (table: string) => Query }

/** A service-role-style client (bypasses RLS) backed by the given tables. */
export function makeAdminClient(tables: Tables): MockDb {
  return { from: (table: string) => new Query(tables, table) }
}

/** A session client whose only used surface is auth.getUser(). */
export function makeSessionClient(user: { id?: string; email?: string } | null, tables?: Tables) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    // Some server components read via the session client; the audited POST routes
    // only use it for getUser, but expose from() for completeness.
    from: (table: string) => new Query(tables ?? {}, table),
  }
}

/** Build a request object accepted by the route handlers (they use .json() + .headers.get()). */
export function jsonRequest(body: unknown, headers: Record<string, string> = {}): any {
  return {
    json: async () => body,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null },
  }
}

/** Wrap a param object as the Promise the App-Router passes as ctx.params. */
export function ctx<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) }
}
