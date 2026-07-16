# Product Decisions & Standing Rules

The *why* behind the code. Read this before changing analysis behavior.

---

## 🎯 Propaganda vs Public Narrative — the core concept

**These are two different things and must never be conflated.** Injected into
every sport's Stage 2 via `NARRATIVE_VS_PROPAGANDA` in `lib/analysisEngine.js`.

### Public Narrative
What the crowd currently believes. **Context, not a signal.** Does not by
itself imply a direction.

### Propaganda
A specific storyline where **narrative has outrun reality**, carrying a
directional implication. Two polarities:

| Polarity | Pattern | Action |
|---|---|---|
| **A — Irrational hype** | Media/public overhyping a side beyond its real edge | **Fade** the hyped side |
| **B — Irrational pile-on** | Media piling on a strong team/player whose real edge is still intact | **Back the maligned side** |

**Canonical example (Polarity B):** Paul Skenes at 0-6 with a media pile-on —
his underlying edge was fully intact. The play was to **back the Pirates**, not
fade them.

> Standing rule (user's words): *"9 times outta 10 that team will most likely win."*

⚠️ Polarity B is the one that gets missed. Don't collapse propaganda into
"fade the hype" — that's only half the concept.

---

## Analysis Output

**Deep research stays at full depth; only the *presentation* is summarized.**

- Stage 2 still runs the complete scam-hunt, live web search, propaganda checks,
  alignment scoring, and track-record calibration. **Never trim the research to
  save cost or length.**
- Stage 4 output is the *distilled result, not the working notes*: **max 2
  sentences per field**, lead with the conclusion, no filler.
- **Exception:** `signalAlignment` keeps its structured flag list (it's the
  model's transparency surface) — but flags are short phrases (5–8 words), not
  sentences.

### 🔴 Anti-fabrication rule
Every number in the output must come from real provided data. If a field is
`N/A`, the model must **say so honestly** rather than inventing a
plausible-sounding figure. Fabricated stats are worse than an admitted gap —
Stage 2's web search exists to fill genuine gaps.

This rule exists because prompts were once asking for stats (`OffRtg`, `DefRtg`,
possession-based pace) that were **never actually fetched**, forcing the model
to guess.

---

## Basketball Stats — what's real vs deliberately absent

NBA/WNBA stats are **computed from actual season game scores** already fetched
(zero extra API calls):

✅ **Real:** season PPG (offense), opponent PPG (defense), point differential,
pace proxy (avg **combined** points per game), rest days, back-to-back.

❌ **Deliberately NOT included:** possession-based pace, `OffRtg`, `DefRtg` —
ESPN's free feed doesn't cleanly expose them and they'd require a paid provider.

The pace figure is labeled honestly as **combined PPG**, and the prompt tells
the model to describe it as such rather than dress it up as possession-based
pace. **Don't "upgrade" this label without a real data source behind it.**

---

## Model & Cost

- **Claude Opus 4.8 on all four stages.** Set once in `lib/aiModel.js`.
- Chosen deliberately for max quality — *"scary money don't make no money."*
- Cost is **fixed-per-day**, not per-subscriber: each game is analyzed **once**
  and every subscriber views the same result. So API cost scales with the
  *slate*, revenue scales with *subscribers*.
- Opus is ~1.67× Sonnet's token cost ($5/$25 vs $3/$15 per M) — comfortably
  covered at the target price point.
- **Fallback lever if ever needed:** Opus on Stages 2 & 4 (where reasoning
  changes the pick), cheaper model on Stage 3 (mechanical market selection).

## Pricing
| Plan | Price | Purpose |
|---|---|---|
| Weekly | **$19.99/wk** | Marketing / trial |
| Monthly | **$49.99/mo** | The real target — expected long-term plan |

Not yet publicly released.

---

## UI Decisions

### Best Picks tab
- Shows **every real play across all sports — Tier 1 AND Tier 2.** Excludes only
  PASS (not a real pick) and unanalyzed games.
- **Not** a Tier-1-only view — Tier 1 locks already have their own dashboard
  real estate. This is the "best of everything" view.
- Sorted strongest-first: Tier 1 above Tier 2, then by confidence descending.
- Uses `BestPickCard` — a stripped card showing **only pick, confidence, stars**
  (+ a small sport/matchup caption for identification, LOCK badge for Tier 1).
  Pulsing battery-green glow (`vvBestPickGlow`, 2.6s) so it reads as live.

### Landing page
- **Win rate removed entirely** (both the hero stat and the floating card).
  54.9% is too close to a coinflip to lead with; it undersold the product.
- The floating card now shows a **4-Stage AI Analysis** feature callout instead
  — leads with the rigor of the process, not a number.

### Empty states — wording matters
| Sport | Message | Why |
|---|---|---|
| MLB / WNBA | "No {sport} Games Today" | Season is **active** — it's just an off day |
| NBA / NFL | "{sport} — Coming Soon" | Season genuinely hasn't started |

Never show "Coming Soon" for an in-season sport — it's misleading.

### Standalone/PWA
All app-feel behavior is gated behind `@media (display-mode: standalone)` —
**zero effect on regular browser visitors.** Design itself unchanged.

---

## iOS App

- **Approach:** wrap the existing app via Capacitor (`server.url` → live site),
  keeping every feature. Required because the app has real server-side routes
  (Stripe, Supabase, Anthropic SDK, cron grading) that can't be statically
  bundled.
- Genuine native capability wired in (push registration, status bar, haptics,
  splash) — this matters for App Store review, which scrutinizes "website in a
  wrapper" submissions.
- ⚠️ **Guideline 5.3 (gambling)** is the main approval risk. Position as an
  **analysis/information tool, not a sportsbook** — it places no bets and holds
  no funds. See `ios-app-store-checklist.md` for full submission steps.
