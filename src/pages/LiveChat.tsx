import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import WEBHOOK_CONFIG from "@/config/webhook";
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

  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; body: string; at: string }>>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [sessionId, setSessionId] = useState<string>("session_" + Date.now());
  const [threadId, setThreadId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
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

  // Attach to existing thread for this platform and current username, and subscribe to realtime
  useEffect(() => {
    let sub: any = null;
    let threadsSub: any = null;
    
    const upsertFromRows = (rows: any[]) => {
      if (!rows || rows.length === 0) return;
      setMessages((prev) => {
        const map = new Map<string, { id: string; role: "user" | "assistant"; body: string; at: string }>();
        prev.forEach((m) => map.set(m.id, m));
        for (const r of rows) {
          if (!r?.id) continue;
          const role: "user" | "assistant" = (r.role === 'agent' || r.role === 'assistant') ? 'assistant' : 'user';
          const item = { id: r.id, role, body: r.body || '', at: r.created_at || new Date().toISOString() };
          map.set(item.id, item);
        }
        const arr = Array.from(map.values());
        arr.sort((a,b)=> new Date(a.at).getTime()-new Date(b.at).getTime());
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
          // If INSERT of user's own message arrives, dedupe temporary local copy by body
          if (ev === 'INSERT' && row?.body) {
            setMessages((prev) => {
              const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.role === 'user' && m.body === row.body);
              if (tempIdx >= 0) {
                const next = prev.slice();
                next.splice(tempIdx, 1);
                return next;
              }
              return prev;
            });
          }
          upsertFromRows([row]);
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
    setDraft("");
    // Optimistic preview while waiting for DB insert (will be replaced by realtime row)
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", body: text, at: new Date().toISOString() }]);
    playLow();
    setLoading(true);

    try {
      const body = {
        message: text,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        channel_id: pid,
        username: username || undefined,
      } as const;

      const resp = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.AI_AGENT.CHAT_SETTINGS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`Webhook failed ${resp.status}`);
      // Do not use webhook response for chat content; realtime will deliver rows.
      playHigh();
    } catch (e) {
      // Replace temp with an error note
      setMessages((prev) => prev.filter((m) => m.id !== tempId).concat({ id: crypto.randomUUID(), role: "assistant", body: "Sorry, I'm having trouble right now. Please try again later.", at: new Date().toISOString() }));
      playHigh();
    } finally {
      setLoading(false);
    }
  };

  const onKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%] space-y-1">
                      <div
                        className={`px-4 py-2 text-sm rounded-2xl shadow-sm transition-colors ${
                          m.role === "user"
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-white text-slate-900 border border-blue-100 rounded-bl-md"
                        }`}
                      >
                        {m.body}
                      </div>
                      <div className={`text-[10px] ${m.role === "user" ? "text-blue-200 text-right" : "text-slate-400"}`}>
                        {fmt(m.at)}
                      </div>
                    </div>
                  </div>
                ))}
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


