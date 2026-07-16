# Vegas Vault AI — Project Docs

Context for working on this codebase. Also suitable as **project knowledge** if
attached to a Claude Project.

| Doc | What's in it | Read when |
|---|---|---|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | The 4-stage flow, sport registry, key file map, slot system, self-healing passes, dev workflow | Starting any work — orient here first |
| **[DECISIONS.md](./DECISIONS.md)** | The *why*: propaganda vs narrative, anti-fabrication rule, model/cost reasoning, pricing, UI decisions | **Before changing analysis behavior** |
| **[PENDING.md](./PENDING.md)** | Open action items, verifications, iOS steps, backlog | Picking up where things left off |
| **[../ios-app-store-checklist.md](../ios-app-store-checklist.md)** | Full App Store submission walkthrough (Mac-only steps) | Shipping the iOS app |

---

## The three rules worth knowing up front

1. **Never default an unknown sport to MLB.** Return `null` and skip cleanly.
   An honest "no data" beats confidently showing another sport's numbers.
   (→ `lib/sports.js`)

2. **Never fabricate a stat.** If data is `N/A`, say so. Stage 2's web search
   exists to fill real gaps. (→ `DECISIONS.md`)

3. **Never trim the research.** Stage 2 runs at full depth. Only Stage 4's
   *presentation* is summarized. (→ `DECISIONS.md`)

---

## Orientation

- **Adding a sport?** One entry in `lib/sports.js` — it inherits everything.
- **Changing the model?** One line in `lib/aiModel.js`.
- **Editing the dashboard?** `components/VegasVaultApp.jsx` is ~5450 lines and
  fragile. Read the surrounding code before editing.
- **Build check:** `npx next build 2>&1 | grep -E "✓ Compiled|Error:"` —
  the `supabaseUrl is required` and `/api/push/notify` errors are
  **pre-existing and harmless**.
