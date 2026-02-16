
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { supabase } from '@/integrations/supabase/client';

export function GlobalAudioListener() {
    const { user } = useAuth();
    const { hasRole } = useRBAC();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Sound file URL - using the one from LiveChat for consistency
    const ALERT_SOUND_URL = '/tones/mixkit-message-pop-alert-2354.mp3';

    useEffect(() => {
        if (!user) return;

        // Create audio element if not exists
        if (!audioRef.current) {
            audioRef.current = new Audio(ALERT_SOUND_URL);
            audioRef.current.volume = 0.5;
        }

        const channel = supabase
            .channel('global-messages-listener')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: 'direction=eq.in', // Only incoming messages
                },
                async (payload) => {
                    const newMessage = payload.new as any;

                    // Verify it's a user message (double check)
                    if (newMessage.role !== 'user') return;

                    try {
                        // Check authorization
                        const isSuperAdmin = hasRole('superadmin');

                        if (isSuperAdmin) {
                            // Always play for superadmin
                            audioRef.current?.play().catch(e => console.error('Audio play failed:', e));
                            return;
                        }

                        // Check assignment for regular agents
                        const { data: thread, error } = await supabase
                            .from('threads')
                            .select('assignee_user_id')
                            .eq('id', newMessage.thread_id)
                            .single();

                        if (!error && thread && thread.assignee_user_id === user.id) {
                            audioRef.current?.play().catch(e => console.error('Audio play failed:', e));
                        }

                    } catch (error) {
                        console.error('[GlobalAudioListener] Error processing message:', error);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, hasRole]); // Depend on user and hasRole

    return null;
}
