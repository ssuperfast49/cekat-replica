import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Config ────────────────────────────────────────────────────────────────
const WINDOW_MS       = 5_000;          // sliding window to detect spam
const TRIGGER_COUNT   = 5;             // messages in window to trigger ban
const RESET_WINDOW_MS = 60 * 60_000;   // 1 hour — if gap > this, reset level

// Escalation ladder: level → suspension duration in ms
const SUSPENSION_DURATIONS_MS = [
    30_000,    // Level 0: 30 seconds
    60_000,    // Level 1: 1 minute
    300_000,   // Level 2: 5 minutes
    600_000,   // Level 3: 10 minutes (max — stays here until 1 h gap)
];

const STORAGE_KEY = 'cekat_escalating_ban';

interface PersistedState {
    level: number;
    lastSuspensionAt: number;  // epoch ms when last suspension was APPLIED
    expiry: number;            // epoch ms when current suspension ends
}

function formatCountdown(ms: number): string {
    if (ms <= 0) return '';
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min > 0) return `${min} menit ${String(sec).padStart(2, '0')} detik`;
    return `${sec} detik`;
}

function loadState(): PersistedState {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return { level: 0, lastSuspensionAt: 0, expiry: 0 };
        return JSON.parse(raw) as PersistedState;
    } catch {
        return { level: 0, lastSuspensionAt: 0, expiry: 0 };
    }
}

function saveState(s: PersistedState) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { }
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useEscalatingBan() {
    const tsLogRef = useRef<number[]>([]);
    const stateRef = useRef<PersistedState>(loadState());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initialise from persisted data so a page-reload keeps the ban active
    const initExpiry = stateRef.current.expiry;
    const [bannedUntil, setBannedUntil] = useState<number | null>(
        initExpiry > Date.now() ? initExpiry : null,
    );
    const [banCountdown, setBanCountdown] = useState<string>(
        initExpiry > Date.now() ? formatCountdown(initExpiry - Date.now()) : '',
    );

    // ── countdown ticker ──
    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (!bannedUntil || bannedUntil <= Date.now()) {
            setBanCountdown('');
            return;
        }

        const tick = () => {
            const remaining = bannedUntil - Date.now();
            if (remaining <= 0) {
                setBannedUntil(null);
                setBanCountdown('');
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            } else {
                setBanCountdown(formatCountdown(remaining));
            }
        };

        tick();
        timerRef.current = setInterval(tick, 1000);
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [bannedUntil]);

    /**
     * Call on every user send attempt.
     * Returns { blocked, isNewBan, level, expiresAt }
     * - blocked   : true → caller must abort the send
     * - isNewBan  : true → ban was just triggered NOW (not pre-existing)
     * - level     : escalation level 0-3
     * - expiresAt : epoch ms when suspension ends
     */
    const recordSend = useCallback((): { blocked: boolean; isNewBan: boolean; level: number; expiresAt: number } => {
        const now = Date.now();
        const s = stateRef.current;

        // Already suspended?
        if (s.expiry > now) {
            return { blocked: true, isNewBan: false, level: s.level, expiresAt: s.expiry };
        }

        // Prune timestamps outside the detection window
        tsLogRef.current = tsLogRef.current.filter(t => now - t < WINDOW_MS);
        tsLogRef.current.push(now);

        if (tsLogRef.current.length >= TRIGGER_COUNT) {
            tsLogRef.current = []; // reset after trigger

            // Decide escalation level
            const withinResetWindow = s.lastSuspensionAt > 0 && (now - s.lastSuspensionAt) < RESET_WINDOW_MS;
            const nextLevel = withinResetWindow
                ? Math.min(s.level + 1, SUSPENSION_DURATIONS_MS.length - 1)
                : 0;

            const duration = SUSPENSION_DURATIONS_MS[nextLevel];
            const expiry   = now + duration;

            const next: PersistedState = { level: nextLevel, lastSuspensionAt: now, expiry };
            stateRef.current = next;
            saveState(next);

            setBannedUntil(expiry);
            return { blocked: true, isNewBan: true, level: nextLevel, expiresAt: expiry };
        }

        return { blocked: false, isNewBan: false, level: s.level, expiresAt: 0 };
    }, []);

    const isBanned = bannedUntil !== null && bannedUntil > Date.now();

    /** Current escalation level (0-based). Useful for showing "warning level". */
    const suspensionLevel = stateRef.current.level;

    return {
        isBanned,
        banCountdown,
        suspensionLevel,
        recordSend,
    };
}
