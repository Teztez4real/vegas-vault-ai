import type { CapacitorConfig } from '@capacitor/cli';

// ── WHY server.url INSTEAD OF A BUNDLED STATIC BUILD ───────────────────────
// This app has real server-side API routes (Stripe, Supabase, the Anthropic
// SDK, cron-driven grading, push) that MUST run on a live Node server — they
// cannot be statically exported into the app bundle the way a purely static
// site could be. So the native iOS shell loads the live production site
// directly (the same pattern Twitter/X, many banking apps, and most
// server-backed PWAs use for their native wrapper). This is fully compliant
// with App Store review AS LONG AS the app also provides genuine native
// capability beyond "a website in a window" — which is exactly what the
// plugins below (native push, splash screen, status bar, haptics) are for.
// See ios-app-store-checklist.md for the full submission walkthrough.
const config: CapacitorConfig = {
  appId: 'com.vegasvaultai.app',
  appName: 'Vegas Vault AI',
  webDir: 'public', // required by the CLI even in server.url mode; unused at runtime
  server: {
    url: 'https://vegasvaultai.com',
    cleartext: false,
  },
  ios: {
    // Matches the app's true background (see app/layout.js body bg fix) —
    // prevents a white/wrong-color flash during the native launch sequence,
    // before the WebView itself has painted.
    backgroundColor: '#030603',
    // Keep native scroll/bounce behavior consistent with the standalone
    // web layer's overscroll-behavior:none (app-feel, not browser-feel).
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#030603',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK', // dark background -> light (white/green) status bar content
      backgroundColor: '#030603',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
