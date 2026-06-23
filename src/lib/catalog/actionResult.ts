export type ActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID'; message?: string }

export function fail(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : 'INVALID'
  if (msg === 'UNAUTHENTICATED' || msg === 'FORBIDDEN') return { ok: false, error: msg }
  return { ok: false, error: 'INVALID', message: msg }
}
