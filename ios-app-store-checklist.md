# Vegas Vault AI — iOS App Store Checklist

Everything code-side is done and pushed to `main`. Everything below requires
a Mac with Xcode — Apple does not allow building or signing iOS apps on any
other platform, so this part has to happen on your end.

## ⚠️ Read this section first — gambling/sports-betting review risk

This is the single biggest risk to approval, more than any technical step.
Apple's App Store Review Guideline **5.3 (Gambling, Gaming, and Contests)**
applies real-money gambling apps a much stricter bar — special licensing
agreements with Apple, geo-restriction enforcement, per-country availability.

**Vegas Vault AI is an analysis/information tool, not a sportsbook** — it
doesn't place bets, hold funds, or process wagers. That puts it in a
meaningfully different category than a betting app, and apps like this
(picks, analysis, odds tracking) do get approved. But the marketing language
matters to reviewers: things like "Beat the Line" and "Start Winning" read
fine in context, but make sure your App Store description and screenshots
clearly frame this as **sports analysis / pick tracking**, not as a place to
place a bet. Concretely, before submitting:

- App Store description should explicitly state it's for informational/
  entertainment purposes and does not facilitate wagering
- Consider adding a brief in-app disclaimer (footer or settings) to the same
  effect, and a responsible-gambling resource link (e.g., ncpgambling.org) —
  reviewers look favorably on this
- Category should be **Sports** or **Reference**, not anything gambling-adjacent
- If Apple's review team flags it, they'll usually respond with specific
  required changes rather than an outright reject — respond promptly, most
  apps in this space get through with wording adjustments

## 1. Prerequisites

- [ ] A Mac with **Xcode** installed (free, Mac App Store) — Xcode 15+ recommended
- [ ] An **Apple Developer Program** membership — $99/year, enroll at
      https://developer.apple.com/programs/ (can take 24-48h to activate)
- [ ] A physical iPhone is strongly recommended for testing push notifications
      and camera/share behavior — the simulator can't receive real push

## 2. Get the project onto your Mac

```bash
git clone https://github.com/Teztez4real/vegas-vault-ai.git
cd vegas-vault-ai
npm install
```

The `ios/` folder is already fully scaffolded and committed — app icon,
splash screen, Info.plist, and Capacitor config are all in place. This
project uses **Swift Package Manager**, not CocoaPods — no `pod install`
step needed. Just open it:

```bash
npx cap open ios
```

This opens `ios/App/App.xcodeproj` in Xcode. On first open, Xcode will
resolve the Swift packages automatically (takes a minute or two, needs
internet).

## 3. Configure signing (Xcode)

1. Select the **App** target → **Signing & Capabilities** tab
2. Check "Automatically manage signing"
3. Select your Team (your Apple Developer account)
4. The bundle ID is currently `com.vegasvaultai.app` — Xcode will tell you
   if that's taken; if so, change it here AND in `capacitor.config.ts`
   (keep them in sync, then run `npx cap sync ios` again)

## 4. Push notifications capability

The client-side registration code is already wired in (requests permission,
gets the device token, sends it to `/api/push/register-native`, stores it in
a new `native_push_tokens` Supabase table — run
`supabase/migrations/native_push_tokens.sql` if you haven't).

In Xcode:
1. **Signing & Capabilities** → **+ Capability** → add **Push Notifications**
2. Also add **Background Modes** → check **Remote notifications** (this is
   already declared in Info.plist, but Xcode's capability toggle keeps the
   entitlements file in sync)

**Important — sending is not wired up yet.** Storing the device token is
done; actually delivering a push via Apple's servers (APNs) needs an **APNs
Auth Key**, which only exists inside your Apple Developer account:

1. https://developer.apple.com/account → Certificates, IDs & Profiles → Keys
2. Create a new key with the **Apple Push Notifications service (APNs)** capability
3. Download the `.p8` file (⚠️ only downloadable once — save it securely)
4. Note the **Key ID** and your **Team ID** (top right of the developer portal)

Once you have those three values (the `.p8` file content, Key ID, Team ID),
send them my way (or paste them somewhere I can read but you can revoke
after) and I'll wire up the actual server-side APNs sending — it's a
contained addition to the existing push-sending logic, not a rebuild.

## 5. Test locally first

- Run on the simulator (Cmd+R) — the app should load vegasvaultai.com inside
  the native shell, with the splash screen and status bar styled correctly
- Run on a real device (needs your Apple ID added in Xcode → Settings →
  Accounts) to test push permission prompts and the share-card save flow

## 6. App Store Connect setup

At https://appstoreconnect.apple.com:

1. **My Apps → +** → New App
   - Platform: iOS
   - Name: Vegas Vault AI (or your preferred store listing name — must be
     unique across the whole App Store, check availability first)
   - Bundle ID: select the one matching what you set in Xcode
   - SKU: any unique string (e.g. `vegasvaultai001`)

2. **App Privacy** section — required, and matters here since this app
   collects email, payment info (Stripe), and usage data:
   - Disclose data types collected: Email Address, User ID, Payment Info,
     Usage Data (picks/watchlist)
   - Link a **Privacy Policy URL** (required — must be a live, real page)

3. **Pricing and Availability** — set territories; given the gambling-adjacent
   subject matter, consider limiting to US-only initially rather than
   worldwide, since gambling-content rules vary a lot by country

4. **App Store screenshots** — required sizes (get these from the simulator,
   Cmd+S to save a screenshot in the right resolution):
   - 6.7" display (iPhone 15 Pro Max or similar): 1290×2796
   - 6.5" display (iPhone 11 Pro Max or similar): 1284×2778
   At least one set is required; more device sizes = better store presence

5. **App Review Information** — provide a demo account (username/password)
   so Apple's reviewer can actually log in and see real functionality, not
   just a paywall. This matters a lot for approval speed.

## 7. Build and submit

Back in Xcode:
1. Select **Any iOS Device** as the build target (not a simulator)
2. **Product → Archive**
3. When the Organizer window opens, **Distribute App → App Store Connect → Upload**
4. Back in App Store Connect, once the build finishes processing (~15-30 min),
   attach it to your app version and submit for review

## 8. Consider TestFlight first

Before the full public review, you can distribute the same build via
**TestFlight** (Xcode Organizer → Distribute App → TestFlight) to a handful
of real users/friends first — much faster review (usually same-day for
internal testers), and a good way to catch anything the simulator didn't
surface.

---

## What's already done (code side)

- Capacitor core + iOS platform scaffolded (`ios/` — fully committed)
- App loads the **live production site** (`https://vegasvaultai.com`) inside
  the native shell — required since this app has real server-side API
  routes (Stripe, Supabase, Anthropic SDK, cron grading) that can't be
  statically bundled into the app
- App icon generated (flattened onto the brand background — Apple rejects
  any transparency in the App Store icon) and splash screen (badge centered
  on the true app background, matches the in-app theme so there's no flash)
- Info.plist configured: proper display name, push notification background
  mode, photo-library usage string (for share-card saves), locked to
  portrait (nothing in the UI was built for landscape)
- Status bar styling initialized natively (dark background, light content)
- Native push **registration** wired client-side (permission request, device
  token capture, storage in a new `native_push_tokens` table) — **sending**
  needs the APNs key from step 4 above
- A light haptic tap on alt-pick selection as a first native-feel touch —
  happy to add more once you've felt it on a real device and have a sense of
  which moments deserve one
