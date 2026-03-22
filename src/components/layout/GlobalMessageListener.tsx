
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { supabase } from '@/integrations/supabase/client';
import { getCachedThread, setCachedThread } from '@/lib/threadCache';
import { toast } from 'sonner';

export function GlobalMessageListener() {
    const { user } = useAuth();
    const { hasRole } = useRBAC();

    const location = useLocation();
    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastNotificationTime = useRef<number>(0);
    const NOTIFICATION_DEBOUNCE_MS = 1000;

    // Sound file URL
    const ALERT_SOUND_URL = '/tones/mixkit-message-pop-alert-2354.mp3';

    useEffect(() => {
        if (!user) return;

        // Create audio element if not exists
        if (!audioRef.current) {
            audioRef.current = new Audio(ALERT_SOUND_URL);
            audioRef.current.volume = 0.5;
        }

        const playSound = () => {
            // Assume audio is enabled since we check it before calling playSound()
            const now = Date.now();
            if (now - lastNotificationTime.current < NOTIFICATION_DEBOUNCE_MS) {
                return;
            }
            lastNotificationTime.current = now;
            audioRef.current?.play().catch(e => console.error('Audio play failed:', e));
        };

        const channel = supabase
            .channel('notifications:messages', { config: { private: true } })
            .on(
                'broadcast',
                { event: 'INSERT' },
                async (payload) => {
                    const newMessage = (payload.payload?.record || payload.payload?.new) as any;
                    if (!newMessage) return;

                    // Only incoming user messages (filter client-side)
                    if (newMessage.direction !== 'in') return;

                    // Verify it's a user message 
                    if (newMessage.role !== 'user') return;

                    try {
                        // Check authorization
                        const isSuperAdmin = hasRole('superadmin');

                        const cacheKey = newMessage.thread_id;
                        let thread = getCachedThread(cacheKey);

                        if (!thread) {
                            // Fetch thread details including contact name, assignment, and status
                            const { data, error } = await supabase
                                .from('threads')
                                .select(`
                                    status,
                                    assignee_user_id,
                                    collaborator_user_id,
                                    contacts (
                                        name
                                    )
                                `)
                                .eq('id', newMessage.thread_id)
                                .single();

                            if (error || !data) return;
                            thread = data;
                            // Cache for 10 seconds to avoid burst lookups across all components
                            setCachedThread(cacheKey, thread, 10000);
                        }

                        if (!thread) return;

                        const isAssigned = thread.assignee_user_id === user.id;
                        const isCollaborator = thread.collaborator_user_id === user.id;
                        const contactName = (thread.contacts as any)?.name || 'Unknown User';



                        // Get global notification setting (defaults to true)
                        const notificationsEnabled = user?.user_metadata?.notifications_enabled !== false;

                        // Notify audio if enabled AND (SuperAdmin, Assigned, or Collaborator)
                        if (notificationsEnabled && (isSuperAdmin || isAssigned || isCollaborator)) {
                            playSound();
                        }

                        // Determine if we should show a toast
                        // Skip if the user is currently viewing this thread in the chat
                        const searchParams = new URLSearchParams(location.search);
                        const activeThreadId = searchParams.get('thread');
                        const activeMenu = searchParams.get('menu');
                        const isChatActive = !activeMenu || activeMenu === 'chat';
                        const isOnChatPage = (location.pathname.startsWith('/chat') || location.pathname === '/') && isChatActive;
                        const isViewingThisThread = isOnChatPage && (activeThreadId === newMessage.thread_id || location.pathname.includes(newMessage.thread_id));

                        if (isViewingThisThread) {
                            return; // Don't toast if looking at it
                        }

                        // Show Toast if enabled AND (Assigned or Collaborator)
                        if (notificationsEnabled && (isAssigned || isCollaborator)) {
                            toast.info(`New message from ${contactName}`, {
                                description: newMessage.body
                                    ? (newMessage.body.length > 50 ? newMessage.body.substring(0, 50) + '...' : newMessage.body)
                                    : 'Sent an attachment',
                                duration: 4000,
                                action: {
                                    label: 'View',
                                    onClick: () => {
                                        // Navigate to thread. Simple reload-safe navigation logic
                                        // If already on chat page, simpler. If elsewhere, navigate.
                                        // Since this is global, direct window location change or just let user click sidebar?
                                        // Ideally we use a router navigate, but we are inside a component.
                                        // We can use window.location for deep link or use a hook if we wrap it.
                                        navigate(`/?menu=chat&thread=${newMessage.thread_id}`);
                                    }
                                }
                            });
                        }

                    } catch (error) {
                        console.error('[GlobalMessageListener] Error processing message:', error);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, hasRole, location]); // Depend on location to check active thread

    return null;
}
