
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import WEBHOOK_CONFIG from "@/config/webhook";
import { callWebhook } from "@/lib/webhookClient";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/config/supabase";
import type { Database } from "@/integrations/supabase/types";
import { uploadFileToStorage, type UploadedFile, type StagedFile } from "@/components/chat/FileUploadButton";
import { ChatMessage } from "@/types/liveChat";
import { toast } from "sonner";

// Use provided ringtones from public/tones (can be overridden via window.chatConfig)
const LOW_TONE_URL = '/tones/mixkit-message-pop-alert-2354.mp3';
const HIGH_TONE_URL = '/tones/mixkit-long-pop-2358.wav';
const sendMessageRetryDelay = 10000;
const sendMessageMaxAttempts = 3;

// Edge function helper — calls livechat-orchestrator with service-role privileges
async function callOrchestrator(action: string, params: Record<string, any>): Promise<any> {
    const url = `${SUPABASE_URL}/functions/v1/livechat-orchestrator`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action, ...params }),
    });
    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Orchestrator ${action} failed (${resp.status}): ${body}`);
    }
    return resp.json();
}

export function useLiveChat() {
    const { platform_id, platformId } = useParams();
    const pid = useMemo(() => platform_id || platformId || "unknown", [platform_id, platformId]);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(false);
    const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [booting, setBooting] = useState(true);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [userScrolledUp, setUserScrolledUp] = useState(false);
    const [username, setUsername] = useState<string>("");
    const [aiProfileId, setAiProfileId] = useState<string | null>(null);

    // Refs
    const viewportRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const messageOrderRef = useRef(0);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const audioLowRef = useRef<HTMLAudioElement | null>(null);
    const audioHighRef = useRef<HTMLAudioElement | null>(null);
    const threadIdRef = useRef<string | null>(null);
    const threadStatusRef = useRef<string | null>(null);
    const streamingDraftIdRef = useRef<string | null>(null);
    const lastOptimisticIdRef = useRef<string | null>(null);
    const contactIdRef = useRef<string | null>(null);
    const isNewThreadRef = useRef(false);
    const attachToThreadRef = useRef<((tid: string) => Promise<void>) | null>(null);
    const pendingThreadAttachRef = useRef(false);
    const pendingThreadInfoRef = useRef<{ alias: string; startedAt: string } | null>(null);
    const threadAttachTimersRef = useRef<number[]>([]);
    const catchUpTimersRef = useRef<number[]>([]);
    const pendingCatchUpRef = useRef(false);
    const notificationsReadyRef = useRef(false);
    const systemNotificationIdsRef = useRef<Set<string>>(new Set());
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

    // Session & Account
    const [accountId, setAccountId] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        // 1. Check URL query param (from embed script: 'account_id' or 'username')
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const fromUrl = urlParams.get('account_id') || urlParams.get('username');
            if (fromUrl) {
                // Persist to localStorage so subsequent navigations keep it
                try { window.localStorage.setItem('account_id', fromUrl); } catch { }
                return fromUrl;
            }
        } catch { }
        // 2. Check localStorage
        const storage = window.localStorage;
        const channelKey = `livechat_account_${window.location.pathname}`;
        const candidateKeys = ['user_id', 'userId', 'account_id', 'accountId'];
        for (const k of candidateKeys) {
            const val = storage.getItem(k);
            if (val) return val;
        }
        const existingAnon = storage.getItem(channelKey);
        if (existingAnon) return existingAnon;
        const generated = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        try { storage.setItem(channelKey, generated); } catch { }
        return generated;
    });

    // Web identifier (from embed script query param)
    const [webId] = useState<string | undefined>(() => {
        if (typeof window === 'undefined') return undefined;
        try {
            return new URLSearchParams(window.location.search).get('web') || undefined;
        } catch { return undefined; }
    });

    const [sessionId, setSessionId] = useState(() => {
        if (typeof window === 'undefined') return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const key = `livechat_session_${pid}`;
        const existing = window.sessionStorage.getItem(key);
        if (existing) return existing;
        const generated = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        window.sessionStorage.setItem(key, generated);
        return generated;
    });

    const supabase = useMemo(() => {
        return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
                headers: accountId ? { 'x-account-id': accountId } : undefined,
            },
        });
    }, [accountId]);

    // Audio Logic
    const ensureCtx = () => {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = audioCtxRef.current ?? new Ctx();
        return audioCtxRef.current!;
    };

    const scheduleTone = (
        ctx: AudioContext,
        startSec: number,
        frequency: number,
        durationMs: number,
        volume = 0.05,
        type: OscillatorType = 'sine'
    ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const endSec = startSec + durationMs / 1000;
        gain.gain.setValueAtTime(0.0001, startSec);
        gain.gain.exponentialRampToValueAtTime(volume, startSec + 0.02);
        gain.gain.setValueAtTime(volume, Math.max(startSec + 0.02, endSec - 0.05));
        gain.gain.exponentialRampToValueAtTime(0.0001, endSec);
        osc.start(startSec);
        osc.stop(endSec);
    };

    const playSequence = (steps: Array<number | number[]>, stepMs = 110, volume = 0.06) => {
        try {
            const ctx = ensureCtx();
            const now = ctx.currentTime + 0.01;
            steps.forEach((step, idx) => {
                const start = now + (idx * stepMs) / 1000;
                const dur = stepMs * 0.9;
                if (Array.isArray(step)) {
                    step.forEach((f) => scheduleTone(ctx, start, f, dur, volume, 'sine'));
                } else {
                    scheduleTone(ctx, start, step, dur, volume, 'triangle');
                }
            });
        } catch { }
    };

    const playAudio = async (which: 'low' | 'high') => {
        try {
            const customUrl = which === 'low' ? window.chatConfig?.sendToneUrl : window.chatConfig?.replyToneUrl;
            const url = customUrl || (which === 'low' ? LOW_TONE_URL : HIGH_TONE_URL);
            const el = which === 'low' ? (audioLowRef.current ?? (audioLowRef.current = new Audio(url)))
                : (audioHighRef.current ?? (audioHighRef.current = new Audio(url)));
            if (el.src !== url) el.src = url;
            el.currentTime = 0;
            el.volume = which === 'low' ? 0.35 : 0.45;
            await el.play();
            return true;
        } catch {
            return false;
        }
    };

    const playLow = async () => {
        const ok = await playAudio('low');
        if (!ok) playSequence([493.88, 523.25, 493.88, 523.25], 110, 0.045);
    };

    const playHigh = async () => {
        const ok = await playAudio('high');
        if (!ok) playSequence([1046.5, 1318.5, 1568.0, [1046.5, 1318.5, 1568.0, 2093.0]], 120, 0.06);
    };

    // Scroll Logic
    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior });
            setShowScrollButton(false);
            setUserScrolledUp(false);
        } else {
            endRef.current?.scrollIntoView({ behavior });
        }
    };

    const handleScroll = () => {
        if (!viewportRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isAtBottom) {
            setShowScrollButton(false);
            setUserScrolledUp(false);
        } else {
            setUserScrolledUp(true);
        }
    };

    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport) {
            viewport.addEventListener("scroll", handleScroll);
            return () => viewport.removeEventListener("scroll", handleScroll);
        }
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'user') {
                scrollToBottom();
            } else if (!userScrolledUp) {
                scrollToBottom();
            } else {
                setShowScrollButton(true);
            }
        }
    }, [messages, userScrolledUp]);

    // Message Handling Logic
    const nextOrder = () => ++messageOrderRef.current;
    const nextAssistantTimestamp = () => new Date(Date.now() + 1).toISOString();

    const appendSorted = (messages: ChatMessage[], message: ChatMessage) => {
        const nextOrderValue = (messages[messages.length - 1]?.order ?? 0) + 1;
        return [...messages, { ...message, order: nextOrderValue }];
    };

    const moveOptimisticToTail = (messages: ChatMessage[]) => {
        const optimisticId = lastOptimisticIdRef.current;
        if (!optimisticId) return messages;
        const currentUserIndex = messages.findIndex((m) => m.id === optimisticId);
        if (currentUserIndex <= -1) return messages;
        const streamingId = streamingDraftIdRef.current;
        if (!streamingId) return messages;
        const updatedStreamingIndex = messages.findIndex((m) => m.id === streamingId);
        if (updatedStreamingIndex === -1 || updatedStreamingIndex > currentUserIndex) return messages;
        const next = messages.slice();
        const [currentUserMessage] = next.splice(currentUserIndex, 1);
        next.push(currentUserMessage);
        next[next.length - 1].order = (next[next.length - 2]?.order ?? 0) + 1;
        return next;
    };

    const appendAssistantChunk = (messageId: string, chunk: string) => {
        if (!chunk) return;
        setMessages((prev) => {
            const existingIdx = prev.findIndex((m) => m.id === messageId);
            if (existingIdx >= 0) {
                const next = prev.slice();
                const existing = next[existingIdx];
                next[existingIdx] = {
                    ...existing,
                    body: (existing.body || '') + chunk,
                    streaming: true,
                    order: existing.order || nextOrder(),
                };
                return next;
            }
            const tentative: ChatMessage = {
                id: messageId,
                role: "assistant",
                body: chunk,
                at: nextAssistantTimestamp(),
                order: prev[prev.length - 1]?.order ?? 0,
                streaming: true,
            };
            return moveOptimisticToTail(appendSorted(prev, tentative));
        });
    };

    const finalizeAssistantMessage = (messageId: string, finalContent?: string) => {
        setMessages((prev) => {
            const existingIdx = prev.findIndex((m) => m.id === messageId);
            if (existingIdx >= 0) {
                const next = prev.slice();
                const existing = next[existingIdx];
                next[existingIdx] = {
                    ...existing,
                    body: finalContent !== undefined ? finalContent : existing.body,
                    streaming: false,
                };
                return next;
            }
            if (finalContent === undefined) return prev;
            const tentative: ChatMessage = {
                id: messageId,
                role: "assistant",
                body: finalContent,
                at: nextAssistantTimestamp(),
                order: prev[prev.length - 1]?.order ?? 0,
                streaming: false,
            };
            return moveOptimisticToTail(appendSorted(prev, tentative));
        });
        setStreamingMessageId(null);
        lastOptimisticIdRef.current = null;
    };

    const upsertFromRows = useCallback((rows: any[]) => {
        if (!rows || rows.length === 0) return;
        setMessages((prev) => {
            const map = new Map<string, ChatMessage>();
            prev.forEach((m) => map.set(m.id, m));
            let changed = false;

            for (const r of rows) {
                if (!r?.id) continue;

                let role: "user" | "assistant" | "system" = "user";
                if (r.role === 'system') {
                    role = 'system';
                } else if (r.role === 'agent' || r.role === 'assistant') {
                    role = 'assistant';
                } else {
                    role = 'user';
                }
                let inheritedOrder: number | null = null;

                if (role === 'assistant' && streamingDraftIdRef.current) {
                    for (const [key, value] of map.entries()) {
                        if (value.id === streamingDraftIdRef.current) {
                            inheritedOrder = value.order;
                            map.delete(key);
                            streamingDraftIdRef.current = null;
                            changed = true;
                            break;
                        }
                    }
                }

                if (role === 'user') {
                    const incomingAt = new Date(r.created_at || Date.now()).getTime();
                    let bestKey: string | null = null;
                    let bestOrder: number | null = null;
                    let bestDiff = Number.POSITIVE_INFINITY;
                    let bestTempType: string | undefined = undefined;
                    for (const [key, value] of map.entries()) {
                        if (!key.startsWith('temp-')) continue;
                        if (value.role !== 'user') continue;
                        const isBodyMatch = (value.body || '').trim() === (r.body || '').trim();
                        if (!isBodyMatch) continue;
                        const tempAt = new Date(value.at).getTime();
                        const diff = Number.isFinite(tempAt) ? Math.abs(incomingAt - tempAt) : 0;
                        if (diff < bestDiff) {
                            bestDiff = diff;
                            bestKey = key;
                            bestOrder = value.order ?? null;
                            bestTempType = value.type;
                        }
                    }
                    if (bestKey) {
                        inheritedOrder = bestOrder;
                        if (!r.type && bestTempType) r.type = bestTempType;
                        map.delete(bestKey);
                        lastOptimisticIdRef.current = null;
                        changed = true;
                    }
                }

                const existing = map.get(r.id);
                const createdAt = r.created_at || new Date().toISOString();
                const body = r.body || '';

                if (existing) {
                    if (existing.body !== body) { existing.body = body; changed = true; }
                    if (existing.at !== createdAt) { existing.at = createdAt; changed = true; }
                    if (r.type && !existing.type) { existing.type = r.type; changed = true; }
                    if (role === 'assistant' && existing.streaming) { existing.streaming = false; changed = true; }
                } else {
                    const item: ChatMessage = {
                        id: r.id,
                        role,
                        body,
                        at: createdAt,
                        order: inheritedOrder ?? nextOrder(),
                        ...(r.type ? { type: r.type } : {}),
                    };
                    map.set(item.id, item);
                    changed = true;
                }
            }

            const arr = Array.from(map.values());
            arr.sort((a, b) => a.order - b.order);

            if (!changed && arr.length === prev.length) {
                let identical = true;
                for (let i = 0; i < arr.length; i += 1) {
                    if (arr[i] !== prev[i]) { identical = false; break; }
                }
                if (identical) return prev;
            }
            return arr;
        });
    }, []);

    // Initialization & Realtime
    const clearCatchUpTimers = () => {
        if (catchUpTimersRef.current.length > 0) {
            catchUpTimersRef.current.forEach((id) => { try { clearTimeout(id); } catch { } });
            catchUpTimersRef.current = [];
        }
    };

    const requestCatchUpFetch = async (threadId: string | null, hydrate: (rows: any[]) => void) => {
        if (!threadId) return;
        const { data } = await supabase
            .from('messages')
            .select('id, role, body, created_at, type')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });
        if (Array.isArray(data)) hydrate(data);
    };

    const scheduleCatchUps = (threadId: string | null, hydrate: (rows: any[]) => void, delays: number[]) => {
        clearCatchUpTimers();
        if (!threadId) { pendingCatchUpRef.current = true; return; }
        catchUpTimersRef.current = delays.map((delay) =>
            window.setTimeout(async () => {
                try { await requestCatchUpFetch(threadId, hydrate); } catch (err) { console.error('[LiveChat] catch-up failed', err); }
            }, delay)
        );
    };

    const clearThreadAttachTimers = useCallback(() => {
        if (threadAttachTimersRef.current.length === 0) return;
        threadAttachTimersRef.current.forEach((id) => { try { clearTimeout(id); } catch { } });
        threadAttachTimersRef.current = [];
    }, []);

    const findThreadForCurrentSession = useCallback(async () => {
        if (!pid) return null;
        try {
            const { data } = await supabase
                .from('threads')
                .select('id, contact_id, created_at, additional_data, assignee_user_id, status, account_id, resolved_at, resolved_by_user_id, contacts(name)')
                .eq('channel_id', pid)
                .order('last_msg_at', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(50);
            if (!data) return null;
            const pendingInfo = pendingThreadInfoRef.current;
            const target = data.find((row: any) => {
                const additional = row?.additional_data as Record<string, any> | null;
                const accountMatch = accountId ? (row?.account_id === accountId || additional?.account_id === accountId) : false;
                const sessionMatch = sessionId ? additional?.session_id === sessionId : false;
                const contactName = (row?.contacts?.name || '') as string;
                const nameMatch = username ? contactName.trim().toLowerCase() === username.trim().toLowerCase() : false;
                if (accountId) { if (!(accountMatch || sessionMatch)) return false; }
                else { if (!(sessionMatch || nameMatch)) return false; }
                if (pendingInfo) {
                    const createdAt = row?.created_at ? new Date(row.created_at).getTime() : 0;
                    const startedAt = new Date(pendingInfo.startedAt).getTime() - 15000;
                    if (createdAt && createdAt < startedAt) return false;
                    const aliasMatch = pendingInfo.alias.trim().toLowerCase() === contactName.trim().toLowerCase();
                    if (accountId) { if (!sessionMatch && !accountMatch) return false; }
                    else { if (!aliasMatch && !sessionMatch && !accountMatch) return false; }
                }
                return true;
            });
            if (target?.id) return target;
            const legacy = data.find((row: any) => !row?.account_id && !(row?.additional_data as any)?.account_id);
            return legacy ?? null;
        } catch (err) {
            console.warn('[LiveChat] findThreadForCurrentSession failed', err);
            return null;
        }
    }, [pid, sessionId, username, accountId, supabase]);

    const reopenThreadIfResolved = useCallback(async (row: any) => {
        const status = (row?.status || '').toString().toLowerCase();
        const isClosed = status === 'closed' || status === 'done' || status === 'resolved';
        if (!isClosed || !row?.id) return row?.id || null;
        try {
            const { error } = await supabase
                .from('threads')
                .update({ status: 'pending', assignee_user_id: null, resolved_at: null, resolved_by_user_id: null })
                .eq('id', row.id);
            if (error) throw error;
            return row.id;
        } catch (err) {
            console.warn('[LiveChat] failed to reopen resolved thread', err);
            return row?.id || null;
        }
    }, []);

    const scheduleThreadAttachRetries = useCallback((delays: number[] = []) => {
        clearThreadAttachTimers();
        if (!delays.length) return;
        threadAttachTimersRef.current = delays.map((delay) =>
            window.setTimeout(async () => {
                if (!pendingThreadAttachRef.current || threadIdRef.current) return;
                const found = await findThreadForCurrentSession();
                if (found?.id) {
                    try {
                        const reopenedId = await reopenThreadIfResolved(found);
                        if (reopenedId) await attachToThreadRef.current?.(reopenedId);
                    } catch (err) { console.warn('[LiveChat] retry attach failed', err); }
                }
            }, delay),
        );
    }, [clearThreadAttachTimers, findThreadForCurrentSession, reopenThreadIfResolved]);

    // Effects
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const key = `livechat_session_${pid}`;
        const stored = window.sessionStorage.getItem(key);
        if (stored && stored !== sessionId) { setSessionId(stored); return; }
        if (!stored) {
            const generated = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            window.sessionStorage.setItem(key, generated);
            setSessionId(generated);
        }
    }, [pid]);

    useEffect(() => {
        const hasAccount = Boolean(accountId);
        const storage = typeof window !== 'undefined'
            ? (hasAccount ? window.localStorage : window.sessionStorage)
            : null;
        if (!storage) return;
        const key = hasAccount
            ? `livechat_username_${pid}_acct_${accountId}`
            : `livechat_username_${pid}_${sessionId}`;
        let value = '';
        try { value = storage.getItem(key) || ''; } catch { }
        if (!value) {
            const adjectives = ['Happy', 'Bright', 'Calm', 'Brave', 'Kind', 'Sunny', 'Lucky', 'Cheerful', 'Swift', 'Clever'];
            const nouns = ['User', 'Visitor', 'Friend', 'Guest', 'Buddy', 'Pal', 'Explorer', 'Champion', 'Star', 'Hero'];
            const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            const num = Math.floor(100 + Math.random() * 900);
            value = `${adj} ${noun} ${num}`;
            try { storage.setItem(key, value); } catch { }
        }
        setUsername(value);
    }, [pid, sessionId, accountId]);

    useEffect(() => {
        threadIdRef.current = threadIdRef.current; // Keep sync? No, using state for ID but logic uses ref often
        // Actually the logic uses threadId state but ref for callbacks
    }, []);

    useEffect(() => { return () => clearCatchUpTimers(); }, []);
    useEffect(() => { return () => clearThreadAttachTimers(); }, [clearThreadAttachTimers]);
    useEffect(() => { return () => { if (streamingMessageId) streamingDraftIdRef.current = null; }; }, [streamingMessageId]);

    useEffect(() => {
        const fetchAiProfileId = async () => {
            try {
                const { data: channel, error } = await supabase
                    .from('channels').select('ai_profile_id').eq('id', pid).maybeSingle();
                if (!error && channel?.ai_profile_id) setAiProfileId(channel.ai_profile_id);
            } catch (error) { console.error('Error fetching AI profile ID:', error); }
        };
        if (pid && pid !== 'unknown') fetchAiProfileId();
    }, [pid]);

    useEffect(() => {
        let sub: any = null;
        let threadsSub: any = null;

        const attachToThread = async (tid: string) => {
            if (threadIdRef.current === tid && sub) {
                pendingThreadAttachRef.current = false;
                scheduleCatchUps(tid, upsertFromRows, [0, 1200]);
                return;
            }
            if (sub) { try { supabase.removeChannel(sub); } catch { } sub = null; }
            threadIdRef.current = tid; // Sync ref
            pendingThreadAttachRef.current = false;
            pendingThreadInfoRef.current = null;
            clearThreadAttachTimers();
            systemNotificationIdsRef.current = new Set();
            notificationsReadyRef.current = false;
            clearCatchUpTimers();
            try {
                // Fetch current thread status
                const { data: threadRow } = await supabase
                    .from('threads')
                    .select('status')
                    .eq('id', tid)
                    .maybeSingle();
                threadStatusRef.current = threadRow?.status || null;

                const { data } = await supabase
                    .from('messages')
                    .select('id, role, body, created_at, type')
                    .eq('thread_id', tid)
                    .order('created_at', { ascending: true });
                if (Array.isArray(data)) upsertFromRows(data);
                const subscribeToThread = (thread: string) =>
                    supabase
                        .channel(`livechat-msgs-${thread}`)
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${thread}` }, (payload: any) => {
                            const row = payload?.new || payload?.old;
                            if (!row) return;
                            if (row?.role === 'system') { upsertFromRows([row]); return; }
                            if (payload.eventType === 'DELETE') return;
                            if (row?.role === 'user' || row?.role === 'agent' || row?.role === 'assistant') upsertFromRows([row]);
                        })
                        .subscribe((status) => {
                            if (status === 'SUBSCRIBED') notificationsReadyRef.current = true;
                            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                                scheduleCatchUps(threadIdRef.current, upsertFromRows, [0, 1500]);
                                if (sub) try { supabase.removeChannel(sub); } catch { }
                                sub = subscribeToThread(thread);
                            }
                        });
                sub = subscribeToThread(tid);
                scheduleCatchUps(tid, upsertFromRows, [0, 800, 2000, 5000, 10000]);
            } finally {
                notificationsReadyRef.current = true;
                setBooting(false);
            }
        };

        attachToThreadRef.current = attachToThread;

        const initialize = async () => {
            const found = await findThreadForCurrentSession();
            if (found?.id) {
                const reopenedId = await reopenThreadIfResolved(found);
                if (reopenedId) await attachToThread(reopenedId);
                return;
            }
            setBooting(false);
            pendingThreadAttachRef.current = false;
        };

        initialize();

        threadsSub = supabase
            .channel(`livechat-threads-${pid}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads', filter: `channel_id=eq.${pid}` }, async (payload: any) => {
                const tid = payload?.new?.id;
                if (!tid || tid === threadIdRef.current) return;
                const sessionFromAdditional = payload?.new?.additional_data?.session_id;
                const matchesSession = sessionFromAdditional && sessionFromAdditional === sessionId;
                if (!matchesSession) {
                    try {
                        const found = await findThreadForCurrentSession();
                        if (found?.id) {
                            const reopenedId = await reopenThreadIfResolved(found);
                            if (reopenedId) await attachToThread(reopenedId);
                        }
                    } catch (err) { }
                    return;
                }
                try {
                    const reopenedId = await reopenThreadIfResolved(payload?.new);
                    await attachToThread(reopenedId || tid);
                } catch (err) { }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'threads', filter: `channel_id=eq.${pid}` }, (payload: any) => {
                const row = payload?.new;
                if (!row?.id || row.id !== threadIdRef.current) return;
                const newStatus = row.status || null;
                threadStatusRef.current = newStatus;
                // If thread is pending (assigned to human), stop loading/typing animation
                if (newStatus === 'pending') {
                    setLoading(false);
                }
            })
            .subscribe(() => setBooting(false));

        return () => {
            try { if (sub) supabase.removeChannel(sub); } catch { }
            try { if (threadsSub) supabase.removeChannel(threadsSub); } catch { }
            attachToThreadRef.current = null;
        };
    }, [pid, sessionId, username, upsertFromRows, findThreadForCurrentSession, reopenThreadIfResolved, accountId]);

    // Send Handlers
    const handleSend = async () => {
        const text = draft.trim();
        if (!text && !stagedFile) return;
        const createdAt = new Date().toISOString();

        // ── 1. Thread resolution ──
        // Try local find first
        if (!threadIdRef.current) {
            try {
                const existingThread = await findThreadForCurrentSession();
                if (existingThread?.id) {
                    if (existingThread.contact_id) contactIdRef.current = existingThread.contact_id;
                    const reopenedId = await reopenThreadIfResolved(existingThread);
                    if (reopenedId) await attachToThreadRef.current?.(reopenedId);
                }
            } catch (err) { }
        }

        // If still no thread, call edge fn to create one (bypasses RLS)
        if (!threadIdRef.current) {
            try {
                const result = await callOrchestrator('ensure_thread', {
                    account_id: accountId || '',
                    channel_id: pid,
                    session_id: sessionId,
                    username: username || '',
                });
                if (result.thread_id) {
                    isNewThreadRef.current = result.is_new;
                    contactIdRef.current = result.contact_id;
                    await attachToThreadRef.current?.(result.thread_id);
                    if (result.ai_profile_id && !aiProfileId) setAiProfileId(result.ai_profile_id);
                    threadStatusRef.current = result.thread_status ?? 'open';
                }
            } catch (err) {
                console.error('[LiveChat] ensure_thread failed', err);
                // Fallback to old retry behaviour
                pendingThreadAttachRef.current = true;
                pendingThreadInfoRef.current = { alias: username, startedAt: new Date().toISOString() };
                scheduleThreadAttachRetries([0, 300, 900, 2000]);
            }
        }

        // ── 2. AI Message Limit check ──
        if (threadIdRef.current) {
            try {
                const { checkAIMessageLimit, autoAssignToSuperAgent } = await import('@/lib/aiMessageLimit');
                const limitInfo = await checkAIMessageLimit(supabase, threadIdRef.current);
                if (limitInfo.isExceeded && limitInfo.superAgentId) {
                    const assignResult = await autoAssignToSuperAgent(supabase, threadIdRef.current, limitInfo.superAgentId);
                    if (assignResult.success) {
                        toast.error(`Batas pesan AI telah tercapai. Percakapan dialihkan ke super agent.`);
                        return;
                    }
                } else if (limitInfo.isExceeded) {
                    toast.error(`Batas pesan AI tercapai. Tidak ada agen tersedia.`);
                    return;
                }
            } catch (error) { }
        }

        // ── 3. File upload ──
        let uploadedFile: UploadedFile | null = null;
        if (stagedFile) {
            setIsUploadingFile(true);
            try {
                uploadedFile = await uploadFileToStorage(stagedFile.file);
            } catch (error: any) {
                toast.error(`Upload failed: ${error.message}`);
                setIsUploadingFile(false);
                return;
            }
            setIsUploadingFile(false);
            setStagedFile(null);
        }

        const isAttachment = !!uploadedFile;
        const hasText = text.length > 0;

        // ── 4. Prepare messages ──
        const messagesToInsert: any[] = [];
        const optimisticMessages: any[] = [];

        if (isAttachment) {
            const attachId = crypto.randomUUID();
            const attachMsg = {
                id: attachId,
                thread_id: threadIdRef.current,
                role: 'user',
                direction: 'in',
                body: uploadedFile.url,
                type: uploadedFile.type as any,
                payload: {}
            };
            messagesToInsert.push(attachMsg);
            optimisticMessages.push({ ...attachMsg, at: createdAt, order: nextOrder() });

            if (hasText) {
                const textId = crypto.randomUUID();
                const textMsg = {
                    id: textId,
                    thread_id: threadIdRef.current,
                    role: 'user',
                    direction: 'in',
                    body: text,
                    type: 'text' as any,
                    payload: {}
                };
                messagesToInsert.push(textMsg);
                optimisticMessages.push({ ...textMsg, at: new Date(Date.now() + 1).toISOString(), order: nextOrder() });
            }
        } else {
            const textId = crypto.randomUUID();
            const textMsg = {
                id: textId,
                thread_id: threadIdRef.current,
                role: 'user',
                direction: 'in',
                body: text,
                type: 'text' as any,
                payload: {}
            };
            messagesToInsert.push(textMsg);
            optimisticMessages.push({ ...textMsg, at: createdAt, order: nextOrder() });
        }

        // ── 5. Insert user message into DB (always — fixes first-message bug) ──
        if (threadIdRef.current && messagesToInsert.length > 0) {
            try {
                await supabase.from('messages').insert(messagesToInsert);
            } catch (err) {
                console.warn('[LiveChat] direct insert failed', err);
            }
        }

        setMessages((prev) => [...prev, ...optimisticMessages]);
        lastOptimisticIdRef.current = optimisticMessages[0].id;
        playLow();
        setDraft("");

        // ── 6. Pending thread path — no AI call ──
        const isAssigned = threadStatusRef.current === 'pending';
        if (isAssigned) {
            // No AI response expected; message already inserted above
            return;
        }

        // ── 7. Fetch AI context via edge fn ──
        let aiContext: { ai_profile: any; contact_info: any; chat_history: string; super_agent_id: string } | null = null;
        if (threadIdRef.current) {
            try {
                aiContext = await callOrchestrator('get_ai_context', {
                    thread_id: threadIdRef.current,
                    channel_id: pid,
                    contact_id: contactIdRef.current || '',
                });
            } catch (err) {
                console.warn('[LiveChat] get_ai_context failed', err);
            }
        }

        // ── 7b. Insert welcome message BEFORE AI call (so it renders first) ──
        if (isNewThreadRef.current && threadIdRef.current && aiContext?.ai_profile?.welcome_message) {
            callOrchestrator('insert_welcome_message', {
                thread_id: threadIdRef.current,
                welcome_message: aiContext.ai_profile.welcome_message,
            }).catch((e: any) => console.warn('[LiveChat] insert_welcome_message failed', e));
            isNewThreadRef.current = false;
        }

        setLoading(true);

        const streamingId = `streaming-${Date.now()}`;
        setStreamingMessageId(streamingId);
        streamingDraftIdRef.current = streamingId;

        try {
            // ── 8. Build new webhook payload ──
            const webhookPayload = {
                message: text || (uploadedFile?.url || ''),
                account_id: accountId || undefined,
                channel_id: pid,
                session_id: sessionId,
                username: username || undefined,
                web: webId,
                stream: true,
                thread_id: threadIdRef.current,
                contact_id: contactIdRef.current || undefined,
                super_agent_id: aiContext?.super_agent_id || undefined,
                ai_profile: aiContext?.ai_profile || undefined,
                contact_info: aiContext?.contact_info || undefined,
                chat_history: aiContext?.chat_history || '',
            };

            let attempt = 0;
            let resp: Response | null = null;
            while (attempt < sendMessageMaxAttempts) {
                try {
                    resp = await callWebhook(
                        WEBHOOK_CONFIG.ENDPOINTS.AI_AGENT.CHAT_SETTINGS,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(webhookPayload),
                        },
                        { forceLegacy: attempt > 0 },
                    );
                } catch { }
                if (resp && resp.ok) break;
                attempt += 1;
                if (attempt < sendMessageMaxAttempts) await new Promise((r) => setTimeout(r, sendMessageRetryDelay));
            }

            if (!resp || !resp.ok) throw new Error("Webhook failed");

            // Schedule catch-ups for realtime sync
            scheduleCatchUps(threadIdRef.current, upsertFromRows, [0, 600, 1800, 4000, 9000, 15000]);

            // ── 9. Stream AI response ──
            let fullAiResponse = '';
            if (resp.body) {
                const reader = resp.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';
                        for (const line of lines) {
                            if (line.trim() === '') continue;
                            try {
                                if (line.startsWith('data: ')) {
                                    const data = line.slice(6);
                                    if (data === '[DONE]') { finalizeAssistantMessage(streamingId); break; }
                                    const parsed = JSON.parse(data);
                                    const chunk = parsed.content || parsed.delta || '';
                                    if (chunk) {
                                        fullAiResponse += chunk;
                                        appendAssistantChunk(streamingId, chunk);
                                    }
                                } else {
                                    const parsed = JSON.parse(line);
                                    const chunk = parsed.content || parsed.delta || '';
                                    if (chunk) {
                                        fullAiResponse += chunk;
                                        appendAssistantChunk(streamingId, chunk);
                                    }
                                }
                            } catch { appendAssistantChunk(streamingId, line); fullAiResponse += line; }
                        }
                    }
                } finally { reader.releaseLock(); }
            } else {
                const data = await resp.json();
                fullAiResponse = data.output || data.content || "Sorry, I couldn't process your message.";
                finalizeAssistantMessage(streamingId, fullAiResponse);
            }
            playHigh();

            // ── 10. Post-response ──
            // AI message insert, token logging, and handover check are handled by n8n post-AI nodes.
            // Welcome message was already inserted in Step 7b (before AI call).

        } catch (e) {
            console.error('Send error:', e);
            finalizeAssistantMessage(streamingId, "Sorry, I'm having trouble right now.");
            playHigh();
            pendingThreadAttachRef.current = false;
        } finally {
            setLoading(false);
        }
    };

    const handleAttachmentSend = async (uploadedFile: UploadedFile) => {
        // Logic similar to handleSend but for direct attachments, mostly redundant as handleSend handles staged files
        // But LiveChat has separate handleAttachmentSend which seems to be for IMMEDIATE send without staging?
        // Reviewing LiveChat.tsx... it seems handleAttachmentSend is NOT called by UI directly, UI uses setStagedFile then handleSend.
        // Wait, FileUploadButton in LiveChat just calls setStagedFile. 
        // Ah, LiveChat.tsx line 1583: onFileStaged={setStagedFile}
        // Is handleAttachmentSend used?
        // I see a definition `const handleAttachmentSend = ...`
        // I don't see it being used in the JSX provided in read_file (upto 1600).
        // Let me check if I should include it.
        // It seems `handleSend` handles staged files. `handleAttachmentSend` might be dead code or used by something I missed.
        // I'll include it just in case, but refactor to reuse logic if possible.
        // Actually, looking at `handleSend` implementation I copied, it handles `stagedFile`.
        // So I will exposing `handleSend` which covers both text and attachments.
    };

    return {
        messages,
        draft,
        setDraft,
        loading,
        stagedFile,
        setStagedFile,
        isUploadingFile,
        booting,
        handleSend,
        viewportRef,
        endRef,
        showScrollButton,
        scrollToBottom,
        userScrolledUp
    };
}
