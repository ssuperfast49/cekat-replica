import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type UserStatus = 'online' | 'idle' | 'offline';

export interface PresenceUser {
    user_id: string;
    status: UserStatus;
    online_at: string; // ISO timestamp when they came online
    last_seen_at?: string; // For syncing with DB
}

interface PresenceContextType {
    onlineUsers: Record<string, PresenceUser>;
    currentUserStatus: UserStatus;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
    const { user, isSigningOut, isSigningOutRef } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceUser>>({});
    const [currentUserStatus, setCurrentUserStatus] = useState<UserStatus>('online');
    const channelRef = useRef<RealtimeChannel | null>(null);
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(Date.now());

    // Configuration
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const DB_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    // 1. Setup Realtime Presence
    useEffect(() => {
        if (!user || isSigningOut || isSigningOutRef.current) {
            setOnlineUsers({});
            return;
        }

        const channel = supabase.channel('room:presence', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channelRef.current = channel;

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState<PresenceUser>();
                const users: Record<string, PresenceUser> = {};

                Object.values(newState).forEach(presences => {
                    // Supabase returns an array of presences for each key (multi-tab support)
                    // We take the most recent/active one
                    const presence = presences[0];
                    if (presence) {
                        users[presence.user_id] = presence;
                    }
                });

                setOnlineUsers(users);
            })
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                setOnlineUsers(prev => {
                    const next = { ...prev };
                    newPresences.forEach((p: any) => {
                        next[p.user_id] = p as PresenceUser;
                    });
                    return next;
                });
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                setOnlineUsers(prev => {
                    const next = { ...prev };
                    leftPresences.forEach((p: any) => {
                        delete next[p.user_id];
                    });
                    return next;
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await trackStatus('online');
                }
            });

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, [user, isSigningOut]);

    // 2. Track & Broadcast Status
    const trackStatus = async (status: UserStatus) => {
        if (!channelRef.current || !user || isSigningOut || isSigningOutRef.current) return;

        const payload: PresenceUser = {
            user_id: user.id,
            status,
            online_at: new Date().toISOString(),
        };

        await channelRef.current.track(payload);
        setCurrentUserStatus(status);

        // Sync to DB if coming online or idle, or periodically
        if (status !== 'offline') {
            updateDbLastSeen();
        }
    };

    const updateDbLastSeen = async () => {
        if (!user || isSigningOut || isSigningOutRef.current) return;
        try {
            await supabase.from('users_profile').update({
                last_seen_at: new Date().toISOString()
            }).eq('user_id', user.id);
        } catch (err) {
            console.error('Failed to update last_seen_at', err);
        }
    }

    // 3. Idle Detection
    useEffect(() => {
        if (!user) return;

        const onActivity = () => {
            lastActivityRef.current = Date.now();
            if (currentUserStatus === 'idle') {
                trackStatus('online'); // Switch back to online
            }
        };

        const checkIdle = () => {
            const now = Date.now();
            if (now - lastActivityRef.current > IDLE_TIMEOUT_MS && currentUserStatus === 'online') {
                trackStatus('idle'); // Switch to idle
            }
        };

        // Listeners
        window.addEventListener('mousemove', onActivity);
        window.addEventListener('keydown', onActivity);
        window.addEventListener('click', onActivity);
        window.addEventListener('scroll', onActivity);

        // Timer
        idleTimerRef.current = setInterval(checkIdle, 10000); // Check every 10s

        // DB Sync Timer
        const dbSyncInterval = setInterval(updateDbLastSeen, DB_UPDATE_INTERVAL_MS);

        return () => {
            window.removeEventListener('mousemove', onActivity);
            window.removeEventListener('keydown', onActivity);
            window.removeEventListener('click', onActivity);
            window.removeEventListener('scroll', onActivity);
            if (idleTimerRef.current) clearInterval(idleTimerRef.current);
            clearInterval(dbSyncInterval);
        };
    }, [user, currentUserStatus]);

    return (
        <PresenceContext.Provider value={{ onlineUsers, currentUserStatus }}>
            {children}
        </PresenceContext.Provider>
    );
}

export function usePresence() {
    const context = useContext(PresenceContext);
    if (context === undefined) {
        throw new Error('usePresence must be used within a PresenceProvider');
    }
    return context;
}
