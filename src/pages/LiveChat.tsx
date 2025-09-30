import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import WEBHOOK_CONFIG from "@/config/webhook";

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
  const [profile, setProfile] = useState<null | {
    system_prompt: string;
    welcome_message: string;
    transfer_conditions: string;
    model: string;
    temperature: number;
  }>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioLowRef = useRef<HTMLAudioElement | null>(null);
  const audioHighRef = useRef<HTMLAudioElement | null>(null);
  const LOW_TONE_URL = '/tones/send.mp3';
  const HIGH_TONE_URL = '/tones/reply.mp3';

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Load AI profile settings from the platform/channel
  useEffect(() => {
    const load = async () => {
      try {
        if (!pid) return;
        const { data: ch } = await supabase
          .from('channels')
          .select('ai_profile_id')
          .eq('id', pid)
          .maybeSingle();
        const profId = (ch as any)?.ai_profile_id as string | undefined;
        if (!profId) { setBooting(false); return; }
        const { data: prof } = await supabase
          .from('ai_profiles')
          .select('system_prompt, welcome_message, transfer_conditions, model, temperature')
          .eq('id', profId)
          .maybeSingle();
        if (prof) {
          setProfile({
            system_prompt: prof.system_prompt || "",
            welcome_message: prof.welcome_message || "",
            transfer_conditions: prof.transfer_conditions || "",
            model: prof.model || 'gpt-4o-mini',
            temperature: typeof prof.temperature === 'number' ? prof.temperature : 0.3,
          });
        }
      } finally {
        setBooting(false);
      }
    };
    load();
  }, [pid]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", body: text, at: now }]);
    playLow();
    setLoading(true);

    try {
      if (!profile) {
        // Fallback echo if no profile configured for this platform
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", body: "Thanks! We received: " + text, at: new Date().toISOString() }]);
        return;
      }

      const body = {
        message: text,
        system_prompt: `${profile.system_prompt}${profile.welcome_message}${profile.transfer_conditions}`,
        model: profile.model,
        temperature: profile.temperature,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        platform_id: pid,
      } as const;

      const resp = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.AI_AGENT.CHAT_SETTINGS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`Webhook failed ${resp.status}`);
      const data = await resp.json().catch(() => ({}));
      const out = data?.output || data?.message || data?.reply || 'Okay.';
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", body: String(out), at: new Date().toISOString() }]);
      playHigh();
    } catch (e) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", body: "Sorry, I'm having trouble right now. Please try again later.", at: new Date().toISOString() }]);
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


