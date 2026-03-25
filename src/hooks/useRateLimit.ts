import { useState, useRef, useCallback, useEffect } from 'react';

const RATE_LIMIT_WINDOW_MS = 5_000;   // 5 seconds
const RATE_LIMIT_MAX_MESSAGES = 5;     // max messages in window
const BAN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_STORAGE_KEY = 'cekat_rate_limit_ban';

function formatCountdown(ms: number): string {
    if (ms <= 0) return '';
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min > 0) {
        return `${min} menit ${String(sec).padStart(2, '0')} detik`;
    }
    return `${sec} detik`;
}

export function useRateLimit(customKey: string = DEFAULT_STORAGE_KEY) {
    const STORAGE_KEY = customKey;

    const tsLogRef = useRef<number[]>([]);
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Restore persisted ban from sessionStorage
    const [bannedUntil, setBannedUntil] = useState<number | null>(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const expiry = Number(stored);
                if (expiry > Date.now()) return expiry;
                sessionStorage.removeItem(STORAGE_KEY);
            }
        } catch { }
        return null;
    });

    const [banCountdown, setBanCountdown] = useState<string>(() => {
        if (bannedUntil && bannedUntil > Date.now()) {
            return formatCountdown(bannedUntil - Date.now());
        }
        return '';
    });

    const isBanned = bannedUntil !== null && bannedUntil > Date.now();

    // Start/stop countdown timer when bannedUntil changes
    useEffect(() => {
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }

        if (!bannedUntil || bannedUntil <= Date.now()) {
            setBanCountdown('');
            return;
        }

        // Persist to sessionStorage
        try { sessionStorage.setItem(STORAGE_KEY, String(bannedUntil)); } catch { }

        const tick = () => {
            const remaining = bannedUntil - Date.now();
            if (remaining <= 0) {
                setBannedUntil(null);
                setBanCountdown('');
                try { sessionStorage.removeItem(STORAGE_KEY); } catch { }
                if (countdownTimerRef.current) {
                    clearInterval(countdownTimerRef.current);
                    countdownTimerRef.current = null;
                }
            } else {
                setBanCountdown(formatCountdown(remaining));
            }
        };

        tick(); // immediate update
        countdownTimerRef.current = setInterval(tick, 1000);

        return () => {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
            }
        };
    }, [bannedUntil]);

    /**
     * Record a send action and return true if the user is now banned.
     * Call this at the top of every send handler.
     */
    const recordSend = useCallback((): boolean => {
        const now = Date.now();

        // Already banned?
        if (bannedUntil && bannedUntil > now) return true;

        // Prune old entries
        tsLogRef.current = tsLogRef.current.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        tsLogRef.current.push(now);

        // Check limit
        if (tsLogRef.current.length >= RATE_LIMIT_MAX_MESSAGES) {
            const expiry = now + BAN_DURATION_MS;
            setBannedUntil(expiry);
            tsLogRef.current = []; // reset log
            return true;
        }

        return false;
    }, [bannedUntil]);

    /** Get the formatted ban message string */
    const getBanMessage = useCallback((): string => {
        if (!bannedUntil || bannedUntil <= Date.now()) return '';
        return `Terlalu banyak aksi, mohon tunggu ${formatCountdown(bannedUntil - Date.now())}`;
    }, [bannedUntil]);

    /** Manually lift the ban */
    const clearBan = useCallback(() => {
        setBannedUntil(null);
        setBanCountdown('');
        try { sessionStorage.removeItem(STORAGE_KEY); } catch { }
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
    }, []);

    return {
        isBanned,
        banCountdown,
        recordSend,
        getBanMessage,
        clearBan,
    };
}
