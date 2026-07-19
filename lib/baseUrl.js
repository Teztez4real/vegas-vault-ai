// Canonical base URL for server-side SELF-fetches (cron routes calling their
// own /api/* endpoints).
//
// WHY THIS EXISTS: Vercel invokes cron functions on the DEPLOYMENT-UNIQUE url
// (vegas-vault-ai-l6jk-<hash>-cortez-s-projects.vercel.app), which sits behind
// Vercel Deployment Protection. Deriving the self-fetch base from the incoming
// request origin (or from VERCEL_URL — same deployment-unique host) meant every
// cron's internal fetch to /api/today got a 302 → Vercel SSO login page →
// "Unexpected token '<', <!DOCTYPE ... is not valid JSON" → the whole cron 500'd.
// That is why auto-analysis/grading only ever appeared to run while a human was
// on the site (their requests came through the public domain instead).
//
// Resolution order — every option here is a STABLE, publicly reachable host:
//   1. NEXT_PUBLIC_APP_URL             — explicit config, always wins if set
//   2. VERCEL_PROJECT_PRODUCTION_URL   — Vercel system env: the stable
//      production domain (vegas-vault-ai-l6jk.vercel.app), NOT deployment-unique
//   3. hardcoded production fallback   — in case system env exposure is off
//   4. request origin                  — local dev / anything non-Vercel
export function canonicalBase(req) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL) return 'https://vegas-vault-ai-l6jk.vercel.app';
  if (req) { try { return new URL(req.url).origin; } catch {} }
  return 'http://localhost:3000';
}
