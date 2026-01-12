const sendMessageRetryDelay = 1000;
const sendMessageMaxAttempts = 3;

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import WEBHOOK_CONFIG from "@/config/webhook";
import { callWebhook } from "@/lib/webhookClient";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    chatConfig?: {
      baseUrl?: string;
      platformId?: string;
      sendToneUrl?: string;   // optional CDN URL for send tone
      replyToneUrl?: string;  // optional CDN URL for reply tone
    };
  }
}

export default function LiveChat() {
  const { platform_id, platformId } = useParams();
  // Support either :platform_id or :platformId param
  const pid = useMemo(() => platform_id || platformId || "unknown", [platform_id, platformId]);

  type ChatMessage = { id: string; role: "user" | "assistant"; body: string; at: string; order: number; streaming?: boolean };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === 'undefined') return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = `livechat_session_${platform_id || platformId || "unknown"}`;
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const generated = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(key, generated);
    return generated;
  });
  const [threadId, setThreadId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [aiProfileId, setAiProfileId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messageOrderRef = useRef(0);
  const systemNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsReadyRef = useRef(false);
  const catchUpTimersRef = useRef<number[]>([]);
  const threadIdRef = useRef<string | null>(null);
  const streamingDraftIdRef = useRef<string | null>(null);
  const lastOptimisticIdRef = useRef<string | null>(null);
  const attachToThreadRef = useRef<((tid: string) => Promise<void>) | null>(null);
  const sessionThreadKeyRef = useRef<string | null>(null);
  const pendingCatchUpRef = useRef(false);
  const pendingThreadAttachRef = useRef(false);
  const pendingThreadInfoRef = useRef<{ alias: string; startedAt: string } | null>(null);
  const threadAttachTimersRef = useRef<number[]>([]);
  const nextOrder = () => ++messageOrderRef.current;
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
  const sessionThreadKey = typeof window !== 'undefined' ? `livechat_thread_${pid}_${sessionId}` : null;
  useEffect(() => {
    sessionThreadKeyRef.current = sessionThreadKey;
  }, [sessionThreadKey]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `livechat_session_${pid}`;
    const stored = window.sessionStorage.getItem(key);
    if (stored && stored !== sessionId) {
      setSessionId(stored);
      return;
    }
    if (!stored) {
      const generated = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem(key, generated);
      setSessionId(generated);
    }
  }, [pid]);
  // Profile settings are resolved server-side by the webhook; no client DB calls.
  const endRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioLowRef = useRef<HTMLAudioElement | null>(null);
  const audioHighRef = useRef<HTMLAudioElement | null>(null);
  // Use provided ringtones from public/tones (can be overridden via window.chatConfig)
  const LOW_TONE_URL = '/tones/mixkit-message-pop-alert-2354.mp3';
  const HIGH_TONE_URL = '/tones/mixkit-long-pop-2358.wav';

  // Audio helpers: schedule richer "ring" tones (melodic/chordal), not monotone
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
    // soft attack/decay envelope
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
    } catch {}
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

  // Two pleasant, familiar chimes (major pentatonic style)
  // Low ring: soft "sent" chime (B4→C5 bounce)
  const playLow = async () => {
    const ok = await playAudio('low');
    if (!ok) playSequence([493.88, 523.25, 493.88, 523.25], 110, 0.045);
  };
  // High ring: bright C-major chime (C6→E6→G6, then chord C6+E6+G6(+C7))
  const playHigh = async () => {
    const ok = await playAudio('high');
    if (!ok) playSequence([1046.5, 1318.5, 1568.0, [1046.5, 1318.5, 1568.0, 2093.0]], 120, 0.06);
  };

const notifySystemMessage = (message: { id?: string; body?: string }) => {
  if (!message?.id) return;
  if (systemNotificationIdsRef.current.has(message.id)) return;
  systemNotificationIdsRef.current.add(message.id);
  if (!notificationsReadyRef.current) return;
  const content = String(message.body || '').trim();
  if (!content) return;
  import('@/components/ui/sonner')
    .then(({ toast }) => {
      toast.info(content, { duration: 3500 });
    })
    .catch(() => {});
};

const nextAssistantTimestamp = () => new Date(Date.now() + 1).toISOString();

const clearCatchUpTimers = () => {
  if (catchUpTimersRef.current.length > 0) {
    catchUpTimersRef.current.forEach((id) => {
      try { clearTimeout(id); } catch {}
    });
    catchUpTimersRef.current = [];
  }
};

const requestCatchUpFetch = async (threadId: string | null, hydrate: (rows: any[]) => void) => {
  if (!threadId) return;
  const { data } = await supabase
    .from('messages')
    .select('id, role, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (Array.isArray(data)) {
    hydrate(data);
  }
};

const scheduleCatchUps = (threadId: string | null, hydrate: (rows: any[]) => void, delays: number[]) => {
  clearCatchUpTimers();
  if (!threadId) {
    pendingCatchUpRef.current = true;
    return;
  }
  catchUpTimersRef.current = delays.map((delay) =>
    window.setTimeout(async () => {
      try {
        await requestCatchUpFetch(threadId, hydrate);
      } catch (err) {
        console.error('[LiveChat] catch-up failed', err);
      }
    }, delay)
  );
};


  // Ensure we have a session-scoped friendly username
  useEffect(() => {
    try {
      const storage = typeof window !== 'undefined' ? window.sessionStorage : null;
      if (!storage) return;
      const key = `livechat_username_${pid}_${sessionId}`;
      let value = '';
      try { value = storage.getItem(key) || ''; } catch {}
      if (!value) {
        const adjectives = ['Happy', 'Bright', 'Calm', 'Brave', 'Kind', 'Sunny', 'Lucky', 'Cheerful', 'Swift', 'Clever'];
        const nouns = ['User', 'Visitor', 'Friend', 'Guest', 'Buddy', 'Pal', 'Explorer', 'Champion', 'Star', 'Hero'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(100 + Math.random() * 900);
        value = `${adj} ${noun} ${num}`;
        try { storage.setItem(key, value); } catch {}
      }
      setUsername(value);
    } catch {}
  }, [pid, sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    threadIdRef.current = threadId;
    if (!threadId) {
    clearCatchUpTimers();
    }
  if (threadId && pendingCatchUpRef.current) {
    pendingCatchUpRef.current = false;
    scheduleCatchUps(threadId, upsertFromRows, [0]);
  }
  }, [threadId]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        scheduleCatchUps(threadIdRef.current, upsertFromRows, [0]);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => () => clearCatchUpTimers(), []);

  // Test Supabase connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.from('channels').select('count').limit(1);
        if (error) {
          console.error('Supabase connection error:', error);
        } else {
          
        }
      } catch (err) {
        console.error('Supabase connection test failed:', err);
      }
    };
    testConnection();
  }, []);

  // Cleanup streaming messages on unmount
  useEffect(() => {
    return () => {
      if (streamingMessageId) {
        setStreamingMessageId(null);
        streamingDraftIdRef.current = null;
      }
    };
  }, [streamingMessageId]);

  // Removed periodic polling; realtime subscriptions now handle message sync exclusively.

  // Attach to existing thread for this platform and current username, and subscribe to realtime
  // Fetch AI profile ID from channel/platform (best-effort; webhook can resolve server-side)
  useEffect(() => {
    const fetchAiProfileId = async () => {
      try {
        
        const { data: channel, error } = await supabase
          .from('channels')
          .select('ai_profile_id')
          .eq('id', pid)
          .maybeSingle();
        
        if (!error && channel?.ai_profile_id) {
          
          setAiProfileId(channel.ai_profile_id);
          
        }
      } catch (error) {
        console.error('Error fetching AI profile ID:', error);
      }
    };

    if (pid && pid !== 'unknown') {
      fetchAiProfileId();
    }
  }, [pid]);

const upsertFromRows = useCallback((rows: any[]) => {
  if (!rows || rows.length === 0) return;
  setMessages((prev) => {
    const map = new Map<string, ChatMessage>();
    prev.forEach((m) => map.set(m.id, m));
    let changed = false;

    for (const r of rows) {
      if (!r?.id) continue;
      if (r.role === 'system') {
        notifySystemMessage(r);
        continue;
      }
      const role: "user" | "assistant" = (r.role === 'agent' || r.role === 'assistant') ? 'assistant' : 'user';
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
        for (const [key, value] of map.entries()) {
          if (
            value.id.startsWith('temp-') &&
            value.role === 'user' &&
            value.body === r.body &&
            Math.abs(new Date(value.at).getTime() - new Date(r.created_at).getTime()) < 10000
          ) {
            inheritedOrder = value.order;
            map.delete(key);
            changed = true;
            break;
          }
        }
      }

      const existing = map.get(r.id);
      const createdAt = r.created_at || new Date().toISOString();
      const body = r.body || '';

      if (existing) {
        if (existing.body !== body) {
          existing.body = body;
          changed = true;
        }
        if (existing.at !== createdAt) {
          existing.at = createdAt;
          changed = true;
        }
        if (role === 'assistant' && existing.streaming) {
          existing.streaming = false;
          changed = true;
        }
      } else {
        const item: ChatMessage = {
          id: r.id,
          role,
          body,
          at: createdAt,
          order: inheritedOrder ?? nextOrder(),
        };
        map.set(item.id, item);
        changed = true;
      }
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => a.order - b.order);

    // Guard against duplicate rows emitted by the backend (same content/timestamp but new ids)
    const deduped: ChatMessage[] = [];
    const dedupeWindowMs = 2000;
    const seen = new Map<string, number>();
    for (const item of arr) {
      const key = `${item.role}:${item.body?.trim().toLowerCase() ?? ''}`;
      const at = new Date(item.at).getTime();
      const lastSeen = seen.get(key);
      if (Number.isFinite(at) && lastSeen !== undefined) {
        if (Math.abs(at - lastSeen) < dedupeWindowMs) {
          continue;
        }
      }
      if (Number.isFinite(at)) {
        seen.set(key, at);
      }
      deduped.push(item);
    }

    if (!changed && deduped.length === prev.length) {
      let identical = true;
      for (let i = 0; i < deduped.length; i += 1) {
        const a = deduped[i];
        const b = prev[i];
        if (a !== b) {
          identical = false;
          break;
        }
      }
      if (identical) {
        return prev;
      }
    }

    return deduped;
  });
}, []);

  const clearThreadAttachTimers = useCallback(() => {
    if (threadAttachTimersRef.current.length === 0) return;
    threadAttachTimersRef.current.forEach((id) => {
      try {
        clearTimeout(id);
      } catch {}
    });
    threadAttachTimersRef.current = [];
  }, []);

  const findThreadForCurrentSession = useCallback(async () => {
    if (!pid) return null;
    try {
      const { data } = await supabase
        .from('threads')
        .select('id, created_at, additional_data, assignee_user_id, status, resolved_at, resolved_by_user_id, contacts(name)')
        .eq('channel_id', pid)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!data) return null;
      const pendingInfo = pendingThreadInfoRef.current;
      const target = data.find((row: any) => {
        const additional = row?.additional_data as Record<string, any> | null;
        const sessionMatch = sessionId ? additional?.session_id === sessionId : false;
        const contactName = (row?.contacts?.name || '') as string;
        const nameMatch = username ? contactName.trim().toLowerCase() === username.trim().toLowerCase() : false;
        if (!(sessionMatch || nameMatch)) return false;
        if (pendingInfo) {
          const createdAt = row?.created_at ? new Date(row.created_at).getTime() : 0;
          const startedAt = new Date(pendingInfo.startedAt).getTime() - 15000; // tolerate clock skew
          if (createdAt && createdAt < startedAt) {
            return false;
          }
          const aliasMatch = pendingInfo.alias.trim().toLowerCase() === contactName.trim().toLowerCase();
          if (!aliasMatch && !sessionMatch) return false;
        }
        return true;
      });
      return target ?? null;
    } catch (err) {
      console.warn('[LiveChat] findThreadForCurrentSession failed', err);
      return null;
    }
  }, [pid, sessionId, username]);

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

  const scheduleThreadAttachRetries = useCallback(
    (delays: number[] = []) => {
      clearThreadAttachTimers();
      if (!delays.length) return;
      threadAttachTimersRef.current = delays.map((delay) =>
        window.setTimeout(async () => {
          if (!pendingThreadAttachRef.current || threadIdRef.current) return;
          const found = await findThreadForCurrentSession();
          if (found?.id) {
            try {
              const reopenedId = await reopenThreadIfResolved(found);
              if (reopenedId) {
                await attachToThreadRef.current?.(reopenedId);
              }
            } catch (err) {
              console.warn('[LiveChat] retry attach failed', err);
            }
          }
        }, delay),
      );
    },
    [clearThreadAttachTimers, findThreadForCurrentSession, reopenThreadIfResolved],
  );

  useEffect(() => () => clearThreadAttachTimers(), [clearThreadAttachTimers]);

  useEffect(() => {
    let sub: any = null;
    let threadsSub: any = null;

    const attachToThread = async (tid: string) => {
      if (threadIdRef.current === tid && sub) {
        pendingThreadAttachRef.current = false;
        scheduleCatchUps(tid, upsertFromRows, [0, 1200]);
        return;
      }
      if (sub) {
        try {
          supabase.removeChannel(sub);
        } catch {}
        sub = null;
      }
      setThreadId((current) => (current === tid ? current : tid));
      threadIdRef.current = tid;
      pendingThreadAttachRef.current = false;
      pendingThreadInfoRef.current = null;
      clearThreadAttachTimers();
      systemNotificationIdsRef.current = new Set();
      notificationsReadyRef.current = false;
      clearCatchUpTimers();
      try {
        const { data } = await supabase
          .from('messages')
          .select('id, role, body, created_at')
          .eq('thread_id', tid)
          .order('created_at', { ascending: true });
        if (Array.isArray(data)) upsertFromRows(data);
        const subscribeToThread = (thread: string) =>
          supabase
            .channel(`livechat-msgs-${thread}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${thread}` }, (payload: any) => {
              const ev = payload?.eventType;
              const row = payload?.new || payload?.old;
              if (!row) return;
              if (row?.role === 'system') {
                notifySystemMessage(row);
                return;
              }
              if (ev === 'DELETE') {
                return;
              }
              if (row?.role === 'user' || row?.role === 'agent' || row?.role === 'assistant') {
                upsertFromRows([row]);
              }
            })
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                notificationsReadyRef.current = true;
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn('[LiveChat] realtime channel status', status);
                scheduleCatchUps(threadIdRef.current, upsertFromRows, [0, 1500]);
                if (sub) {
                  try {
                    supabase.removeChannel(sub);
                  } catch {}
                }
                sub = subscribeToThread(thread);
              }
            });
        sub = subscribeToThread(tid);
        scheduleCatchUps(tid, upsertFromRows, [0, 800, 2000, 5000, 10000]);
        if (sessionThreadKeyRef.current && typeof window !== 'undefined') {
          try { window.sessionStorage.setItem(sessionThreadKeyRef.current, tid); } catch {}
        }
      } finally {
        notificationsReadyRef.current = true;
        setBooting(false);
      }
    };

    attachToThreadRef.current = attachToThread;

    const storedThreadId =
      sessionThreadKeyRef.current && typeof window !== 'undefined'
        ? window.sessionStorage.getItem(sessionThreadKeyRef.current)
        : null;

    const attachStoredThread = async () => {
      if (!storedThreadId) return false;
      try {
        const { data } = await supabase
          .from('threads')
          .select('id, additional_data, status')
          .eq('id', storedThreadId)
          .maybeSingle();
        const sessionFromThread = (data?.additional_data as Record<string, any> | null)?.session_id;
        if (!data || sessionFromThread !== sessionId) {
          throw new Error('thread-session mismatch');
        }
        const reopenedId = await reopenThreadIfResolved(data);
        if (reopenedId) {
          await attachToThread(reopenedId);
          return true;
        }
        return true;
      } catch {
        if (sessionThreadKeyRef.current && typeof window !== 'undefined') {
          try { window.sessionStorage.removeItem(sessionThreadKeyRef.current); } catch {}
        }
        return false;
      }
    };

    const initialize = async () => {
      const restored = await attachStoredThread();
      if (restored) return;
      const found = await findThreadForCurrentSession();
      if (found?.id) {
        const reopenedId = await reopenThreadIfResolved(found);
        if (reopenedId) {
          await attachToThread(reopenedId);
        }
      }
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
              if (reopenedId) {
                await attachToThread(reopenedId);
              }
            }
          } catch (err) {
            console.warn('[LiveChat] failed to attach from realtime (non-session match)', err);
          }
          return;
        }
        try {
          const reopenedId = await reopenThreadIfResolved(payload?.new);
          await attachToThread(reopenedId || tid);
        } catch (err) {
          console.warn('[LiveChat] failed to attach from realtime', err);
        }
      })
      .subscribe(() => setBooting(false));

    return () => {
      try { if (sub) supabase.removeChannel(sub); } catch {}
      try { if (threadsSub) supabase.removeChannel(threadsSub); } catch {}
      attachToThreadRef.current = null;
    };
  }, [pid, sessionId, username, upsertFromRows, findThreadForCurrentSession, reopenThreadIfResolved]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    const createdAt = new Date().toISOString();

    if (!threadIdRef.current) {
      try {
        const existingThread = await findThreadForCurrentSession();
        if (existingThread?.id) {
          const reopenedId = await reopenThreadIfResolved(existingThread);
          if (reopenedId) {
            await attachToThreadRef.current?.(reopenedId);
          }
        }
      } catch (err) {
        console.warn('[LiveChat] failed to attach existing thread before send', err);
      }
    }

    if (!threadIdRef.current) {
      pendingThreadAttachRef.current = true;
      pendingThreadInfoRef.current = {
        alias: username,
        startedAt: new Date().toISOString(),
      };
      scheduleThreadAttachRetries([0, 600, 1500, 3000, 6000]);
    }

    // Check AI message limit before sending user message
    if (threadId) {
      try {
        const { checkAIMessageLimit, autoAssignToSuperAgent } = await import('@/lib/aiMessageLimit');
        const limitInfo = await checkAIMessageLimit(supabase, threadId);
        
        if (limitInfo.isExceeded && limitInfo.superAgentId) {
          // Auto-assign to super agent
          const assignResult = await autoAssignToSuperAgent(supabase, threadId, limitInfo.superAgentId);
          
          if (assignResult.success) {
            // Show notification that thread was assigned to super agent
            const { toast } = await import('@/components/ui/sonner');
            toast.error(
              `Batas pesan AI telah tercapai (${limitInfo.currentCount}/${limitInfo.limit}). ` +
              `Percakapan telah dialihkan ke super agent.`
            );
            // Don't send message to AI, let super agent handle it
            return;
          }
        } else if (limitInfo.isExceeded && !limitInfo.superAgentId) {
          // Limit exceeded but no super agent available
          const { toast } = await import('@/components/ui/sonner');
          toast.error(
            `Batas pesan AI telah tercapai (${limitInfo.currentCount}/${limitInfo.limit}). ` +
            `Tidak ada super agent yang tersedia untuk penanganan.`
          );
          return;
        }
      } catch (error) {
        console.error('Error checking AI message limit:', error);
        // Continue with normal flow if check fails (graceful degradation)
      }
    }

    setDraft("");
    // Optimistic preview while waiting for DB insert (will be replaced by realtime row)
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", body: text, at: createdAt, order: nextOrder() }]);
    lastOptimisticIdRef.current = tempId;
    playLow();
    setLoading(true);

    // Set a timeout to ensure user message stays visible even if realtime is slow
    const userMessageTimeout = setTimeout(() => {
      setMessages((prev) => {
        const tempIdx = prev.findIndex((m) => m.id === tempId);
        if (tempIdx >= 0) {
          // Keep the temp message as is - don't change the ID
          // The realtime subscription will handle replacement when the real message arrives
          
          return prev; // No change needed, message is already visible
        }
        return prev;
      });
    }, 3000); // 3 second timeout

    // Create a streaming message for AI response (but don't add to messages until content arrives)
    const streamingId = `streaming-${Date.now()}`;
    setStreamingMessageId(streamingId);
    streamingDraftIdRef.current = streamingId;

    // Set a timeout to fallback to realtime if streaming doesn't work
    const streamingTimeout = setTimeout(() => {
      if (streamingDraftIdRef.current === streamingId) {
        finalizeAssistantMessage(streamingId, "Waiting for response...");
      }
    }, 10000); // 10 second timeout

    try {
      const body = {
        message: text,
        session_id: sessionId,
        timestamp: createdAt,
        channel_id: pid,
        username: username || undefined,
        ai_profile_id: aiProfileId,
        stream: true, // Request streaming response
      } as const;

      let attempt = 0;
      let resp: Response | null = null;
      let proxyStatus: number | null = null;

      while (attempt < sendMessageMaxAttempts) {
        try {
          resp = await callWebhook(
            WEBHOOK_CONFIG.ENDPOINTS.AI_AGENT.CHAT_SETTINGS,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
            { forceLegacy: attempt > 0 },
          );
        } catch (proxyError) {
          console.warn('[LiveChat] proxy webhook call failed', proxyError);
          resp = null;
        }

        if (resp && resp.ok) break;

        proxyStatus = resp?.status ?? null;
        attempt += 1;
        if (attempt < sendMessageMaxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, sendMessageRetryDelay));
        }
      }

      if (!resp.ok) {
        const statusDetails = proxyStatus ? ` (proxy status ${proxyStatus})` : '';
        throw new Error(`Webhook failed ${resp.status}${statusDetails}`);
      }

      // Ensure the newly created thread (if any) is attached for this session
      let attachedThreadId: string | null = null;
      try {
        const foundThread = await findThreadForCurrentSession();
        if (foundThread?.id) {
          const reopenedId = await reopenThreadIfResolved(foundThread);
          attachedThreadId = reopenedId || foundThread.id;
          if (threadIdRef.current !== attachedThreadId) {
            await attachToThreadRef.current?.(attachedThreadId);
          }
        } else if (pendingThreadAttachRef.current && !threadIdRef.current) {
          scheduleThreadAttachRetries([400, 1200, 2500, 5000, 8000]);
        }
      } catch (attachErr) {
        console.warn('[LiveChat] failed to attach thread after send', attachErr);
      }
      
      // Immediately fetch latest state after backend processes the message
      const targetThreadId = attachedThreadId ?? threadIdRef.current;
      scheduleCatchUps(targetThreadId, upsertFromRows, [0, 600, 1800, 4000, 9000, 15000]);
      
      // Handle streaming response
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
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              
              try {
                // Handle different streaming formats
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    finalizeAssistantMessage(streamingId);
                    break;
                  }
                  
                  const parsed = JSON.parse(data);
                  
                  if (parsed.content || parsed.delta) {
                    appendAssistantChunk(streamingId, parsed.content || parsed.delta);
                  }
                } else {
                  // Try to parse as JSON directly
                  const parsed = JSON.parse(line);
                  if (parsed.content || parsed.delta) {
                    appendAssistantChunk(streamingId, parsed.content || parsed.delta);
                  }
                }
              } catch (parseError) {
                // If it's not JSON, treat as plain text
                appendAssistantChunk(streamingId, line);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        // Fallback to non-streaming response
        
        try {
          const data = await resp.json();
          
          const responseText = data.output || data.content || data.message || "Sorry, I couldn't process your message.";
          
          finalizeAssistantMessage(streamingId, responseText);
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError);
          // Create a fallback message
          finalizeAssistantMessage(streamingId, "I'm processing your message, please wait...");
        }
      }
      
      playHigh();
      
      // Trigger immediate refresh to catch any realtime messages (AGENT ONLY)
      setTimeout(() => {
        if (threadId) {
          supabase
            .from('messages')
            .select('id, role, body, created_at')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true })
            .then(({ data }) => {
              if (Array.isArray(data)) {
                setMessages((prev) => {
                  const map = new Map<string, ChatMessage>();
                  prev.forEach((m) => map.set(m.id, m));
                  
                  // Only process agent/assistant messages from immediate refresh
                  for (const r of data) {
                    if (!r?.id) continue;
                    if (r.role === 'system') {
                      notifySystemMessage(r);
                      continue;
                    }
                    const role: "user" | "assistant" = (r.role === 'agent' || r.role === 'assistant') ? 'assistant' : 'user';
                    let inheritedOrder: number | null = null;
                    
                    // SKIP user messages from immediate refresh
                    if (role === 'user') {
                      
                      continue;
                    }
                    
                    const existing = map.get(r.id);
                    const item: ChatMessage = existing ?? {
                      id: r.id,
                      role,
                      body: r.body || '',
                      at: r.created_at || new Date().toISOString(),
                      order: nextOrder(),
                    };
                    if (!existing) {
                      item.body = r.body || '';
                      item.at = r.created_at || new Date().toISOString();
                    }
                    const draftId = streamingDraftIdRef.current;
                    if (draftId) {
                      for (const [key, value] of map.entries()) {
                        if (value.id === draftId) {
                          inheritedOrder = value.order;
                          map.delete(key);
                          streamingDraftIdRef.current = null;
                          break;
                        }
                      }
                    }
                    if (!existing) {
                      item.order = inheritedOrder ?? item.order;
                    }
                    map.set(item.id, item);
                  }
                  
                  const arr = Array.from(map.values());
                  arr.sort((a,b)=> a.order - b.order);
                  return arr;
                });
              }
            });
        }
      }, 1000); // Refresh after 1 second
      
    } catch (e) {
      console.error('Streaming error:', e);
      // Replace streaming message with error
      finalizeAssistantMessage(streamingId, "Sorry, I'm having trouble right now. Please try again later.");
      pendingThreadAttachRef.current = false;
      playHigh();
    } finally {
      clearTimeout(streamingTimeout);
      clearTimeout(userMessageTimeout);
      setLoading(false);
    }
  };

  const onKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.order - b.order);
  }, [messages]);

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
      <div className="mx-auto w-full max-w-xl h-full">
        <Card className="border border-blue-100 shadow-xl rounded-2xl bg-white/90 backdrop-blur">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white">
              <div className="text-sm font-medium tracking-wide">Live Chat</div>
            </div>

            <ScrollArea className="h-[450px] p-4">
              <div className="space-y-3">
                {booting && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Preparing chat…
                  </div>
                )}
                {sortedMessages.map((m) => {
                  // Don't render empty messages or streaming messages with no content
                  if (!m.body || (m.streaming && m.body.trim() === '')) {
                    return null;
                  }
                  
                  return (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] space-y-1">
                        <div
                          className={`px-4 py-2 text-sm rounded-2xl shadow-sm transition-colors ${
                            m.role === "user"
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-white text-slate-900 border border-blue-100 rounded-bl-md"
                          }`}
                        >
                          <span className="whitespace-pre-wrap">{m.body}</span>
                        </div>
                        <div className={`text-[10px] ${m.role === "user" ? "text-blue-200 text-right" : "text-slate-400"}`}>
                          {fmt(m.at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Typing…
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-blue-100 rounded-b-2xl bg-blue-50/40">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Type a message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyPress={onKeyPress}
                  className="rounded-full h-10 px-4 border-blue-200 focus-visible:ring-blue-500 placeholder:text-slate-400"
                />
                <Button
                  onClick={handleSend}
                  disabled={!draft.trim()}
                  className="rounded-full h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



