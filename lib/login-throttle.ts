/**
 * Basit istemci taraflı sürtünme: art arda başarısız girişten sonra kısa süreli
 * kilit. Gerçek bir güvenlik katmanı değildir (bkz. docs/plan-platform.md
 * bölüm 3.8) — Supabase'in kendi auth koruması asıl savunmadır.
 */

const STORAGE_KEY = "dviz-signin-throttle";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;

interface ThrottleState {
  attempts: number;
  lockedUntil: number | null;
}

function read(): ThrottleState {
  if (typeof window === "undefined") return { attempts: 0, lockedUntil: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw) as ThrottleState;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function write(state: ThrottleState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Kilitliyse kalan saniyeyi, değilse 0 döner */
export function remainingLockSeconds(): number {
  const { lockedUntil } = read();
  if (!lockedUntil) return 0;
  const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function recordFailedAttempt(): void {
  const state = read();
  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    write({ attempts: 0, lockedUntil: Date.now() + LOCK_MS });
  } else {
    write({ attempts, lockedUntil: null });
  }
}

export function clearThrottle(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
