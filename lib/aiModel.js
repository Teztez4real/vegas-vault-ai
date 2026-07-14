// ── SINGLE SOURCE OF TRUTH FOR THE AI MODEL ──────────────────────────────────
// Every AI route imports AI_MODEL from here so the model can be changed in
// ONE place instead of hunting across generate/topplay/props/ai-chat.
//
// Current: Claude Opus 4.8 — Anthropic's top-tier model, chosen deliberately
// for maximum analysis quality across all four stages of the pick engine.
// Cost note (as of change): Opus 4.8 is $5/$25 per million tokens (input/
// output) vs Sonnet 4.6's $3/$15 — ~1.67x more per token. This is an
// intentional quality-first tradeoff; the app's cost is largely fixed-per-day
// (each game is analyzed once and all subscribers view the same result), so
// subscriber revenue scales independently of this cost.
//
// To change the model everywhere at once, edit ONLY this line:
export const AI_MODEL = 'claude-opus-4-8';
