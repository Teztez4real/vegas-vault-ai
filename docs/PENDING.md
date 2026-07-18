# Open Items

Live checklist. Update as things close out.

---

## 🔴 Security — do first

- [ ] **Revoke the GitHub PAT** used for pushes during development
      (`ghp_A9ee…`, exposed in chat). Revoke at
      GitHub → Settings → Developer settings → Personal access tokens.
      Generate a fresh one for future pushes.
      → **Never commit a token to this repo, including into these docs.**

---

## ⚙️ Verify — Supabase migrations

Confirm each table exists (run its migration if not):

- [x] `ai_track_record` — confirmed, 34 rows
- [ ] `live_push_state`
- [ ] `slate_complete_notifications`
- [ ] `opening_lines`
- [ ] `native_push_tokens` — **new**, for iOS APNs tokens
      (`supabase/migrations/native_push_tokens.sql`)

## ⚙️ Verify — Vercel env vars

- [ ] `CRON_SECRET` — generated: `47154f48…5857c6`
- [ ] `NEXT_PUBLIC_APP_URL` = `https://vegasvaultai.com`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — confirm it matches Supabase
- [ ] `CFBD_API_KEY` — CollegeFootballData SP+ ratings for CFB analysis.
      Free key: collegefootballdata.com/key ($10/mo tier lifts the call cap).
      Optional — with it unset, CFB cleanly falls back to ESPN rank/record/form.
- [ ] `BALLDONTLIE_API_KEY` — BALLDONTLIE standings for NBA/WNBA analysis.
      Standings/props are the GOAT tier (~$39.99/mo PER SPORT). Optional — with
      it unset (or a lower tier), basketball falls back to ESPN records/form.
      NOTE: standings mostly overlap ESPN; the real prize on this key is player
      props + team advanced averages (not yet wired — a good next step).

---

## 📱 iOS — Mac-only steps

Everything code-side is done and committed (`ios/` is a full Xcode project,
Capacitor 8 + Swift Package Manager — **no CocoaPods, no `pod install`**).

Remaining steps all require a Mac + Xcode + Apple Developer account ($99/yr).
Full walkthrough: **`ios-app-store-checklist.md`**.

- [ ] Clone repo on Mac → `npm install` → `npx cap open ios`
- [ ] Signing & Capabilities → select Team
- [ ] Add **Push Notifications** + **Background Modes → Remote notifications**
- [ ] **Generate APNs Auth Key** (developer.apple.com → Keys → APNs)
      → download `.p8` (**one-time download — save it securely**), note
      **Key ID** + **Team ID**
      → ⚠️ *Server-side APNs **sending** is not wired up yet.* Token capture
        and storage are done (`/api/push/register-native` → `native_push_tokens`);
        delivery needs these three values.
- [ ] App Store Connect: listing, privacy disclosures, screenshots
      (6.7" 1290×2796 / 6.5" 1284×2778), **demo account for reviewers**
- [ ] Consider **TestFlight** first (much faster review)
- [ ] ⚠️ Frame the listing as **analysis/information, not gambling** — see
      Guideline 5.3 notes in `DECISIONS.md`

---

## 👀 Watch / verify on-screen

- [ ] **`extractScore` fix** — the all-losses bug (every team showing 0-10 /
      0-25) is fixed in code, but **not yet visually confirmed**. Needs a fresh
      re-analysis to verify on screen.
- [ ] **Wrong-sport self-heal** — `invalidateWrongSportAnalyses` should
      auto-correct the Golden State/Indiana WNBA game (and any other showing
      baseball fields) within ~1 cron cycle. Confirm it actually cleared.

---

## 💤 Backlog / not started

- **"UX/UI PRO MAX" skill** — user wants to add it; the file was never
  provided. Blocked pending that.
- **Registry cleanup (low priority)** — a few hardcoded sport lists remain
  that could be registry-driven: `LandingPage.jsx` line ~16 chips
  (`'MLB · NBA · NFL'`) and line ~410 FAQ copy; `lib/seasonUtils.js` sport
  branches; `today/route.js` `hasSlotPattern` OR'd flag.
- **NBA advanced stats (deliberate gap)** — possession-based pace / OffRtg /
  DefRtg would need a **paid** stats provider. Current computed stats are real
  and honestly labeled; see `DECISIONS.md`. Only revisit with a real source.
