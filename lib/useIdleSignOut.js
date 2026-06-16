import { useEffect } from 'react';

// Auto-signs the user out after a period of inactivity.
// Calls onSignOut FIRST (which flushes all data to Supabase), then signs
// out the Supabase session — this order matters so the flush has an active
// session to write with.
export function useIdleSignOut(supabase, isActive, onSignOut, idleMinutes = 30) {
  useEffect(() => {
    if (!isActive || !supabase) return;
    const IDLE_LIMIT_MS = idleMinutes * 60 * 1000;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        // onSignOut (doSignOut) flushes data AND signs out Supabase — don't
        // call supabase.auth.signOut() here separately or data flush loses
        // its session before it can write.
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
