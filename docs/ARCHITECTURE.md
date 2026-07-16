# Vegas Vault AI — Architecture

Subscription sports betting intelligence platform. Next.js/React + Supabase +
Vercel + Stripe + Anthropic Claude API. Live at vegasvaultai.com; `main`
auto-deploys via Vercel.

---

## The 4-Stage Analysis Flow

The core engine. Every game runs all four stages.

| Stage | What it does | AI? |
|---|---|---|
| **1 — Data Assembly** | Builds the sport-appropriate data package (records, form, H2H, odds, line movement, injuries + sport-specific extras). | No AI — pure code |
| **2 — Edge Filter** | First AI call. Live web search, scam-hunt, propaganda/narrative checks, alignment scoring. Returns a real edge **or a PASS**. | Yes (3000 tok + web search) |
| **3 — Market Selection** | Which market best expresses the edge found in Stage 2. | Yes (700 tok) |
| **4 — Final Verdict** | Pick, tier, and confidence — derived *mechanically* from flag counts. | Yes (4000 tok, retries once if truncated) |

**Tier mechanics (Stage 4):**
- 0–1 red flags + 3+ green flags → **Tier 1 (LOCK)**, 80–95% confidence
- 2 red flags → **Tier 2**, 55–75% confidence
- 3+ red flags → **PASS** (Tier 3 — not a real pick)

Stage 1 is sport-branched. Stages 2–4 route to per-sport prompt builders via
`getStages(sport)` in `app/api/generate/route.js`.

---

## Sport Registry — the single source of truth

**`lib/sports.js`** is the most important file for multi-sport correctness.

The app was originally MLB-only; every sport after that was added by patching
individual code paths. That left ~46 scattered sport branches and a dangerous
pattern of **MLB-defaulting fall-throughs** (`sportMap[sport] || 'baseball_mlb'`)
that silently served *baseball data* to non-MLB sports instead of failing
honestly. Real bugs it caused: WNBA storyline research fetching MLB news;
WNBA line movement fetching baseball lines.

Each sport is declared **once**, with:
- **External identifiers:** `espnPath`, `espnLogoSport`, `oddsApiKey`, `slotPatternKey`
- **Characteristics:** `isTeamSport`, `isOutdoor`, `hasStartingPitchers`, `hasMultiGameSeries`, `hasUmpire`
- **Product behavior:** `hasSlotSystem`, `slotWeekdaysOnly`, `enabled`

### 🔴 THE RULE
> **Never default an unknown sport to MLB.** Return `null` and skip the feature
> cleanly. An honest "no data" always beats confidently showing another sport's
> numbers as if they were real.

### Adding a future sport
Add **one entry** to `lib/sports.js`. It inherits tabs, Top Plays, slot
handling, analysis routing, track record, live scores, and grading
automatically. (This is the opposite of how WNBA was added — a dozen separate
patches, which is exactly why it stayed half-wired for so long.)

Current: **MLB, NBA, WNBA, NFL** enabled. **Tennis** built but `enabled: false`.

---

## Key File Map

### Analysis engine
| File | Role |
|---|---|
| `lib/analysisEngine.js` | All per-sport prompt builders (Stage 1–4). Holds `NARRATIVE_VS_PROPAGANDA` + `ALIGNMENT_CHECK` constants injected into every sport's Stage 2. |
| `app/api/generate/route.js` | The 4-stage runner. Sport-branched Stage 1; `getStages(sport)` routes 2–4. |
| `lib/aiModel.js` | **Single source of truth for the model string.** Change the model here, once. |
| `lib/sports.js` | Sport registry (see above). |

### Data layer
| File | Role |
|---|---|
| `app/api/today/route.js` | ~2350 lines. Fetches every sport's slate, records, form, H2H, odds, opening lines. Includes `extractScore()` and `assignSlotFromPattern()`. |
| `app/api/livescores/route.js` | Unified live scores for **all** sports. MLB via statsapi (inning/outs); NBA/WNBA/NFL via ESPN (period/clock). |
| `app/api/lines/route.js` | Line movement. Registry-driven sport keys. |
| `lib/grading.js` | `gradePick`, `gradeCompletedGames`, alt-pick grading, historical regrades, `invalidateWrongSportAnalyses`. |

### Crons
| Route | Cadence | Does |
|---|---|---|
| `app/api/auto-analyze/route.js` | 30 min | Analyzes slate, grades, runs self-heal passes |
| `app/api/live-score-push/route.js` | 2 min | Grading + regrade + invalidate + watchlist live push |

### Frontend
| File | Role |
|---|---|
| `components/VegasVaultApp.jsx` | ~5450 lines. Main dashboard. **Fragile, heavily inline-styled — edit carefully.** Contains `GameCard`, `BestPickCard`, `TeamLogo`, analysis modal. |
| `components/LandingPage.jsx` | Public landing. Win rate removed entirely. |
| `components/NewLookShell.jsx` | Shell/nav. `hideTopbar` prop for modals. |
| `app/settings/page.js` | Admin: Slot Pattern Manager (MLB/NBA/WNBA/NFL). |

---

## The Slot System

Admin-set **PUBLIC/VEGAS** patterns gate whether games auto-analyze.

- **MLB / NBA / NFL** — need an admin pattern for the date. No pattern → card
  shows `AWAITING SLOT PATTERN`.
- **WNBA** — needs its **own** pattern (`hasWNBAPattern`, tracked separately —
  never reuse the generic OR'd `hasSlotPattern`, which is true if *any* of
  MLB/NBA/NFL has one and says nothing about WNBA). **Mon–Fri only.**
  Sat/Sun → never auto-queues; card shows a manual **ANALYZE GAME** button.
- **Tennis** — the only genuine no-slot sport (`hasSlotSystem: false`).

Patterns **cycle** (`pattern[i % pattern.length]`) so every game always gets a
real slot even if the saved pattern is shorter than the day's game count.

---

## Self-Healing Passes

Both crons run these; they fix already-stored bad data that a code fix alone
can't reach:

- `regradeHistoricalPicks` / `regradeHistoricalAltPicks` — re-grade past picks
  after a grading-logic fix.
- `invalidateWrongSportAnalyses` — deletes **ungraded, not-yet-started**
  non-MLB analyses containing baseball-leak phrases (`Away starter:`,
  `bullpen`, `batter splits vs pitcher`) so they re-analyze fresh. **Never
  touches a graded/completed game's historical record.**

---

## Dev Workflow

```bash
# Build check — these two errors are PRE-EXISTING and HARMLESS:
#   "supabaseUrl is required" / "Failed to collect page data for /api/push/notify"
npx next build 2>&1 | grep -E "✓ Compiled|Error:"

# Push (main auto-deploys via Vercel)
git push https://<user>:<TOKEN>@github.com/Teztez4real/vegas-vault-ai.git main
```

Repo: `Teztez4real/vegas-vault-ai` · Admin: `battlecortez@gmail.com`
