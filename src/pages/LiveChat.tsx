const sendMessageRetryDelay = 1000;
const sendMessageMaxAttempts = 3;

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import WEBHOOK_CONFIG from "@/config/webhook";
import { callWebhook } from "@/lib/webhookClient";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/config/supabase";
import type { Database } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { LinkPreview } from "@/components/chat/LinkPreview";
import { isImageLink, extractUrls } from "@/lib/utils";

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
  const [accountId, setAccountId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const storage = window.localStorage;
    // If storage is empty, generate a fresh account_id per channel
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
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === 'undefined') return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = `livechat_session_${platform_id || platformId || "unknown"}`;
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
  // Disable stored thread reuse; always derive from account/session lookup
  const sessionThreadKey = null;
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
      .catch(() => { });
  };

  const nextAssistantTimestamp = () => new Date(Date.now() + 1).toISOString();

  const clearCatchUpTimers = () => {
    if (catchUpTimersRef.current.length > 0) {
      catchUpTimersRef.current.forEach((id) => {
        try { clearTimeout(id); } catch { }
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


  // Ensure we have a friendly username; bind to account_id when available (one name per account)
  useEffect(() => {
    try {
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
    } catch { }
  }, [pid, sessionId, accountId]);

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
          // Match real user row to any pending optimistic temp message with the same body,
          // even if the backend response arrives much later (e.g., after AI finishes).
          const incomingAt = new Date(r.created_at || Date.now()).getTime();
          let bestKey: string | null = null;
          let bestOrder: number | null = null;
          let bestDiff = Number.POSITIVE_INFINITY;
          for (const [key, value] of map.entries()) {
            if (!key.startsWith('temp-')) continue;
            if (value.role !== 'user') continue;
            if ((value.body || '').trim() !== (r.body || '').trim()) continue;
            const tempAt = new Date(value.at).getTime();
            const diff = Number.isFinite(tempAt) ? Math.abs(incomingAt - tempAt) : 0;
            if (diff < bestDiff) {
              bestDiff = diff;
              bestKey = key;
              bestOrder = value.order ?? null;
            }
          }
          if (bestKey) {
            inheritedOrder = bestOrder;
            map.delete(bestKey);
            lastOptimisticIdRef.current = null;
            changed = true;
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

      if (!changed && arr.length === prev.length) {
        let identical = true;
        for (let i = 0; i < arr.length; i += 1) {
          const a = arr[i];
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

      return arr;
    });
  }, []);

  const clearThreadAttachTimers = useCallback(() => {
    if (threadAttachTimersRef.current.length === 0) return;
    threadAttachTimersRef.current.forEach((id) => {
      try {
        clearTimeout(id);
      } catch { }
    });
    threadAttachTimersRef.current = [];
  }, []);

  const findThreadForCurrentSession = useCallback(async () => {
    if (!pid) return null;
    try {
      const { data } = await supabase
        .from('threads')
        .select('id, created_at, additional_data, assignee_user_id, status, account_id, resolved_at, resolved_by_user_id, contacts(name)')
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
        // If we have an accountId, only accept account/session matches; do NOT fall back to name
        if (accountId) {
          if (!(accountMatch || sessionMatch)) return false;
        } else {
          if (!(sessionMatch || nameMatch)) return false;
        }
        if (pendingInfo) {
          const createdAt = row?.created_at ? new Date(row.created_at).getTime() : 0;
          const startedAt = new Date(pendingInfo.startedAt).getTime() - 15000; // tolerate clock skew
          if (createdAt && createdAt < startedAt) {
            return false;
          }
          const aliasMatch = pendingInfo.alias.trim().toLowerCase() === contactName.trim().toLowerCase();
          if (accountId) {
            if (!sessionMatch && !accountMatch) return false;
          } else {
            if (!aliasMatch && !sessionMatch && !accountMatch) return false;
          }
        }
        return true;
      });
      if (target?.id) return target;
      // Fallback for legacy threads without account_id: reuse the most recent thread for this channel.
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
        } catch { }
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
                  } catch { }
                }
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
      // Only reuse threads that match account/session/name; do not attach arbitrary latest when storage is empty
      const found = await findThreadForCurrentSession();
      if (found?.id) {
        const reopenedId = await reopenThreadIfResolved(found);
        if (reopenedId) {
          await attachToThread(reopenedId);
        }
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
      try { if (sub) supabase.removeChannel(sub); } catch { }
      try { if (threadsSub) supabase.removeChannel(threadsSub); } catch { }
      attachToThreadRef.current = null;
    };
  }, [pid, sessionId, username, upsertFromRows, findThreadForCurrentSession, reopenThreadIfResolved, accountId]);

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
      scheduleThreadAttachRetries([0, 300, 900, 2000]);
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

    try {
      const body = {
        message: text,
        session_id: sessionId,
        account_id: accountId || undefined,
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

      // Ensure the newly created thread (if any) is attached for this session/account
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
                  arr.sort((a, b) => a.order - b.order);
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


                  const MarkdownComponents = {
                    a: ({ href, children }: any) => {
                      const url = href || "";
                      if (isImageLink(url)) {
                        return (
                          <img
                            src={url}
                            alt="User uploaded content"
                            className="rounded-lg max-w-full h-auto my-2 border border-black/10 shadow-sm"
                            loading="lazy"
                          />
                        );
                      }
                      return (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={m.role === "user" ? "text-blue-300 font-medium underline hover:text-white" : "text-blue-600 font-medium underline hover:text-blue-800"}
                        >
                          {children}
                        </a>
                      );
                    },
                    img: ({ src, alt }: any) => (
                      <img
                        src={src}
                        alt={alt}
                        className="rounded-lg max-w-full h-auto my-2 border border-black/10 shadow-sm overflow-hidden"
                        loading="lazy"
                      />
                    )
                  };

                  return (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] space-y-1">
                        <div
                          className={`px-4 py-2 text-sm rounded-2xl shadow-sm transition-colors ${m.role === "user"
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-white text-slate-900 border border-blue-100 rounded-bl-md"
                            }`}
                        >
                          <div className={`prose prose-sm leading-normal max-w-none [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${m.role === "user" ? "text-white [&_*]:text-inherit [&_li]:marker:text-white [&_code]:text-blue-100 [&_code]:bg-blue-700" : ""}`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MarkdownComponents}>
                              {m.body}
                            </ReactMarkdown>
                          </div>
                          {(() => {
                            const urls = extractUrls(m.body);
                            if (urls.length === 0) return null;

                            return (
                              <div className="space-y-2 mt-2">
                                {urls.map((u) => !isImageLink(u) && (
                                  <LinkPreview key={u} url={u} isDark={m.role === "user"} />
                                ))}
                              </div>
                            );
                          })()}
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
                <Textarea
                  placeholder="Type a message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyPress}
                  className="rounded-xl min-h-[40px] max-h-[120px] resize-none px-4 py-2 border-blue-200 focus-visible:ring-blue-500 placeholder:text-slate-400 bg-white text-slate-900"
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



