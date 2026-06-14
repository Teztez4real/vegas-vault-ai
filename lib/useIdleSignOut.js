import { useEffect } from 'react';

// Auto-signs the user out after a period of inactivity (no mouse, keyboard,
// touch, or scroll events). All user data is continuously synced to Supabase
// as it changes, so signing out never loses anything — everything is already
// saved server-side before this fires.
export function useIdleSignOut(supabase, isActive, onSignOut, idleMinutes = 30) {
  useEffect(() => {
    if (!isActive || !supabase) return;
    const IDLE_LIMIT_MS = idleMinutes * 60 * 1000;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try { await supabase.auth.signOut(); } catch (e) {}
        onSignOut?.();
      }, IDLE_LIMIT_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(ev => window.removeEventListener(ev, reset));
    };
  }, [isActive, supabase, idleMinutes]);
}
