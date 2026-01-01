import { useEffect, useMemo, useRef, useState } from "react";
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
  const [sessionId, setSessionId] = useState<string>("session_" + Date.now());
  const [threadId, setThreadId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [aiProfileId, setAiProfileId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messageOrderRef = useRef(0);
  const nextOrder = () => ++messageOrderRef.current;
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

const nextAssistantTimestamp = () => new Date(Date.now() + 1).toISOString();

  // Ensure we have a persistent, friendly username per platform/host
  useEffect(() => {
    try {
      const host = (typeof window !== 'undefined' ? window.location.host : 'unknown');
      const key = `livechat_username_${pid}_${host}`;
      let value = '';
      try { value = localStorage.getItem(key) || ''; } catch {}
      if (!value) {
        const adjectives = ['Happy', 'Bright', 'Calm', 'Brave', 'Kind', 'Sunny', 'Lucky', 'Cheerful', 'Swift', 'Clever'];
        const nouns = ['User', 'Visitor', 'Friend', 'Guest', 'Buddy', 'Pal', 'Explorer', 'Champion', 'Star', 'Hero'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(100 + Math.random() * 900);
        value = `${adj} ${noun} ${num}`;
        try { localStorage.setItem(key, value); } catch {}
      }
      setUsername(value);
    } catch {}
  }, [pid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
      }
    };
  }, [streamingMessageId]);

  // Periodic refresh as backup to ensure messages are up-to-date
  useEffect(() => {
    if (!threadId) return;
    
    const refreshMessages = async () => {
      try {
        const { data } = await supabase
          .from('messages')
          .select('id, role, body, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });
        
        if (Array.isArray(data)) {
          setMessages((prev) => {
            const map = new Map<string, ChatMessage>();
            prev.forEach((m) => map.set(m.id, m));
            
            // Only process agent/assistant messages from periodic refresh
            // Skip user messages to prevent duplicates with optimistic updates
            for (const r of data) {
              if (!r?.id) continue;
              const role: "user" | "assistant" = (r.role === 'agent' || r.role === 'assistant') ? 'assistant' : 'user';
              
              // SKIP user messages from periodic refresh
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
              map.set(item.id, item);
            }
            
            const arr = Array.from(map.values());
            arr.sort((a,b)=> a.order - b.order);
            return arr;
          });
        }
      } catch (error) {
        console.error('Error refreshing messages:', error);
      }
    };

    const interval = setInterval(refreshMessages, 2000); // Refresh every 2 seconds for faster updates
    return () => clearInterval(interval);
  }, [threadId]);

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

  useEffect(() => {
    let sub: any = null;
    let threadsSub: any = null;
    
    const upsertFromRows = (rows: any[]) => {
      if (!rows || rows.length === 0) return;
      
      
      setMessages((prev) => {
        const map = new Map<string, ChatMessage>();
        prev.forEach((m) => map.set(m.id, m));
        
        for (const r of rows) {
          if (!r?.id) continue;
          const role: "user" | "assistant" = (r.role === 'agent' || r.role === 'assistant') ? 'assistant' : 'user';
          let inheritedOrder: number | null = null;
          if (role === 'assistant' && streamingMessageId) {
            for (const [key, value] of map.entries()) {
              if (value.id === streamingMessageId) {
                inheritedOrder = value.order;
                map.delete(key);
                break;
              }
            }
          }
          const existing = map.get(r.id);
          const item: ChatMessage = existing ?? {
            id: r.id,
            role,
            body: r.body || '',
            at: r.created_at || new Date().toISOString(),
            order: inheritedOrder ?? nextOrder(),
          };
          if (!existing) {
            item.body = r.body || '';
            item.at = r.created_at || new Date().toISOString();
          }
          
          // For user messages, check if we already have a temp message to replace
          if (role === 'user') {
            // Find and remove any temp message with same content
            for (const [key, value] of map.entries()) {
              if (value.id.startsWith('temp-') && 
                  value.role === 'user' && 
                  value.body === r.body &&
                  Math.abs(new Date(value.at).getTime() - new Date(r.created_at).getTime()) < 10000) { // Within 10 seconds
                map.delete(key);
                
                break; // Only replace one temp message
              }
            }
          }
          
          // Only add if we don't already have this message
          if (!map.has(item.id)) {
            map.set(item.id, item);
          } else {
            
          }
        }
        
        const arr = Array.from(map.values());
        arr.sort((a,b)=> a.order - b.order);
        
        return arr;
      });
    };

    const attachToThread = async (tid: string) => {
      setThreadId(tid);
      try {
        const { data } = await supabase
          .from('messages')
          .select('id, role, body, created_at')
          .eq('thread_id', tid)
          .order('created_at', { ascending: true });
        if (Array.isArray(data)) upsertFromRows(data);
      } catch {}
      sub = supabase
        .channel(`livechat-msgs-${tid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${tid}` }, (payload: any) => {
          const ev = payload?.eventType;
          const row = payload?.new || payload?.old;
          if (!row) return;
          
          
          
          // COMPLETELY SKIP user messages from realtime to prevent duplicates
          if (row?.role === 'user') {
            
            return;
          }
          
          // Only process agent/assistant messages from realtime
          if (row?.role === 'agent' || row?.role === 'assistant') {
            
            upsertFromRows([row]);
          }
          
          // Clear streaming message ID if we get a real agent message
          if (ev === 'INSERT' && row?.role === 'agent' && streamingMessageId) {
            setStreamingMessageId(null);
          }
        })
        .subscribe();
      setBooting(false);
    };

    const init = async () => {
      try {
        // Try to find recent thread for this platform and contact name === username
        const { data } = await supabase
          .from('threads')
          .select('id, contact_id, contacts(name)')
          .eq('channel_id', pid)
          .eq('contacts.name', username)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) { await attachToThread(data.id); return; }
      } catch {}
      // If not found or access denied, watch for new threads for this platform and match by contact name
      threadsSub = supabase
        .channel(`livechat-threads-${pid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads', filter: `channel_id=eq.${pid}` }, async (payload: any) => {
          const tid = payload?.new?.id;
          const contactId = payload?.new?.contact_id;
          if (!tid || !contactId) return;
          try {
            const { data: c } = await supabase.from('contacts').select('id, name').eq('id', contactId).maybeSingle();
            if (c?.name && username && c.name === username) {
              await attachToThread(tid);
            }
          } catch {}
        })
        .subscribe(() => setBooting(false));
    };

    init();

    return () => {
      try { if (sub) supabase.removeChannel(sub); } catch {}
      try { if (threadsSub) supabase.removeChannel(threadsSub); } catch {}
    };
  }, [pid, username]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;

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
    setMessages((prev) => [...prev, { id: tempId, role: "user", body: text, at: new Date().toISOString(), order: nextOrder() }]);
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

    // Set a timeout to fallback to realtime if streaming doesn't work
    const streamingTimeout = setTimeout(() => {
      if (streamingMessageId === streamingId) {
        
        setStreamingMessageId(null);
        setMessages((prev) => prev.map(m => 
          m.id === streamingId 
            ? { ...m, streaming: false, body: m.body || "Waiting for response..." }
            : m
        ));
      }
    }, 10000); // 10 second timeout

    try {
      const body = {
        message: text,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        channel_id: pid,
        username: username || undefined,
        ai_profile_id: aiProfileId,
        stream: true, // Request streaming response
      } as const;

      
      
      let resp: Response | null = null;
      let proxyStatus: number | null = null;
      try {
        resp = await callWebhook(
          WEBHOOK_CONFIG.ENDPOINTS.AI_AGENT.CHAT_SETTINGS,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
          { forceLegacy: false },
        );
      } catch (proxyError) {
        console.warn('[LiveChat] proxy webhook call failed', proxyError);
      }

      if (!resp || !resp.ok) {
        proxyStatus = resp?.status ?? null;
        resp = await callWebhook(
          WEBHOOK_CONFIG.ENDPOINTS.AI_AGENT.CHAT_SETTINGS,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
          { forceLegacy: true },
        );
      }

      if (!resp.ok) {
        const statusDetails = proxyStatus ? ` (proxy status ${proxyStatus})` : '';
        throw new Error(`Webhook failed ${resp.status}${statusDetails}`);
      }
      
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
                    // Streaming complete
                    setMessages((prev) => prev.map(m => 
                      m.id === streamingId 
                        ? { ...m, streaming: false }
                        : m
                    ));
                    setStreamingMessageId(null);
                    break;
                  }
                  
                  const parsed = JSON.parse(data);
                  
                  if (parsed.content || parsed.delta) {
                    const content = parsed.content || parsed.delta;
                    
                    setMessages((prev) => {
                      const existingIdx = prev.findIndex(m => m.id === streamingId);
                      if (existingIdx >= 0) {
                        // Update existing streaming message
                        const next = prev.slice();
                        next[existingIdx] = { ...next[existingIdx], body: next[existingIdx].body + content };
                        return next;
                      } else {
                        // Create new streaming message with content
                        return [
                          ...prev,
                          {
                            id: streamingId,
                            role: "assistant",
                            body: content,
                            at: nextAssistantTimestamp(),
                            order: nextOrder(),
                            streaming: true,
                          },
                        ];
                      }
                    });
                  }
                } else {
                  // Try to parse as JSON directly
                  const parsed = JSON.parse(line);
                  if (parsed.content || parsed.delta) {
                    const content = parsed.content || parsed.delta;
                    setMessages((prev) => {
                      const existingIdx = prev.findIndex(m => m.id === streamingId);
                      if (existingIdx >= 0) {
                        // Update existing streaming message
                        const next = prev.slice();
                        next[existingIdx] = { ...next[existingIdx], body: next[existingIdx].body + content };
                        return next;
                      } else {
                        // Create new streaming message with content
                        return [
                          ...prev,
                          {
                            id: streamingId,
                            role: "assistant",
                            body: content,
                            at: nextAssistantTimestamp(),
                            order: nextOrder(),
                            streaming: true,
                          },
                        ];
                      }
                    });
                  }
                }
              } catch (parseError) {
                // If it's not JSON, treat as plain text
                setMessages((prev) => {
                  const existingIdx = prev.findIndex(m => m.id === streamingId);
                  if (existingIdx >= 0) {
                    // Update existing streaming message
                    const next = prev.slice();
                    next[existingIdx] = { ...next[existingIdx], body: next[existingIdx].body + line };
                    return next;
                  } else {
                    // Create new streaming message with content
                    return [
                      ...prev,
                      {
                        id: streamingId,
                        role: "assistant",
                        body: line,
                        at: nextAssistantTimestamp(),
                        order: nextOrder(),
                        streaming: true,
                      },
                    ];
                  }
                });
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
          
          setMessages((prev) => {
            const existingIdx = prev.findIndex(m => m.id === streamingId);
            if (existingIdx >= 0) {
              // Update existing streaming message
              const next = prev.slice();
              next[existingIdx] = { ...next[existingIdx], body: responseText, streaming: false };
              return next;
            } else {
              // Create new message if streaming message doesn't exist
              return [
                ...prev,
                {
                  id: streamingId,
                  role: "assistant",
                  body: responseText,
                  at: nextAssistantTimestamp(),
                  order: nextOrder(),
                  streaming: false,
                },
              ];
            }
          });
          setStreamingMessageId(null);
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError);
          // Create a fallback message
          setMessages((prev) => [
            ...prev,
            {
              id: streamingId,
              role: "assistant",
              body: "I'm processing your message, please wait...",
              at: nextAssistantTimestamp(),
              order: nextOrder(),
              streaming: false,
            },
          ]);
          setStreamingMessageId(null);
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
                    if (streamingMessageId) {
                      for (const [key, value] of map.entries()) {
                        if (value.id === streamingMessageId) {
                          inheritedOrder = value.order;
                          map.delete(key);
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
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== streamingId)
          .concat({
            id: crypto.randomUUID(),
            role: "assistant",
            body: "Sorry, I'm having trouble right now. Please try again later.",
            at: nextAssistantTimestamp(),
            order: nextOrder(),
          }),
      );
      setStreamingMessageId(null);
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


