// Next.js instrumentation. onRequestError receives the FULL server-side error
// (including SSR/render errors that the client-facing error boundary redacts in
// production). We persist it to error_log so it can be inspected directly.
// TEMPORARY diagnostic — remove once the /iq/team render error is resolved.
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
) {
  try {
    const e = error as { message?: string; stack?: string; digest?: string }
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const db = createAdminClient()
    await db.from('error_log').insert({
      message: String(e?.message ?? error),
      stack: String(e?.stack ?? '').slice(0, 8000),
      digest: String(e?.digest ?? ''),
      url: String(request?.path ?? ''),
    })
  } catch {
    // Never let logging break a request.
  }
}
