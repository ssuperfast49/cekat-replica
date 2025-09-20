import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, Legend, LabelList, PieChart, Pie, Cell } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { supabase, logAction } from "@/lib/supabase";
import { isDocumentHidden, onDocumentVisible } from "@/lib/utils";

type ConversationPoint = { time: string; value: number; firstTime?: number; returning?: number };
type AgentMetric = { name: string; value: number };

const conversationData: ConversationPoint[] = [
  { time: "06/08", value: 50, firstTime: 30, returning: 45 },
  { time: "07/08", value: 75, firstTime: 45, returning: 60 },
  { time: "08/08", value: 65, firstTime: 40, returning: 55 },
  { time: "09/08", value: 60, firstTime: 35, returning: 50 },
  { time: "10/08", value: 85, firstTime: 55, returning: 70 },
  { time: "11/08", value: 90, firstTime: 60, returning: 75 },
  { time: "12/08", value: 80, firstTime: 50, returning: 65 },
  { time: "13/08", value: 70, firstTime: 45, returning: 60 },
];

const aiAgentMetrics: AgentMetric[] = [
  { name: "Avg Response (s)", value: 2.1 },
  { name: "Containment (%)", value: 82 },
  { name: "CSAT", value: 4.3 },
  { name: "Deflection (%)", value: 37 },
];

const humanResolution: AgentMetric[] = [
  { name: "Resolved by Human", value: 15 },
  { name: "Resolved by AI", value: 85 },
];

const COLORS = ["#60a5fa", "#2563eb", "#1d4ed8", "#10b981", "#f59e0b", "#ef4444"]; 

export default function Analytics() {
  const pieColors = useMemo(() => COLORS.slice(0, humanResolution.length), []);

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [channelCounts, setChannelCounts] = useState<{ provider: string; display_name: string | null; thread_count: number }[]>([]);
  const [aiAvg, setAiAvg] = useState<number>(0);
  const [agentAvg, setAgentAvg] = useState<number>(0);
  const [containment, setContainment] = useState<{ total: number; ai: number; rate: number; handover: number; handover_rate: number }>({ total: 0, ai: 0, rate: 0, handover: 0, handover_rate: 0 });
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [series, setSeries] = useState<Array<{ bucket: string; provider: string; count: number }>>([]);
  const [handoverStats, setHandoverStats] = useState<Array<{ reason: string; count: number; total: number; rate: number }>>([]);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillRows, setDrillRows] = useState<Array<{ id: string; created_at: string; contact_name: string; handover_reason: string | null; status: string }>>([]);

  const formatHandoverLabel = (reason?: string | null) => {
    if (!reason || reason.trim().length === 0) return '(unspecified)';
    if (reason.startsWith('other:')) return reason.replace(/^other:/, 'Other: ');
    switch (reason) {
      case 'ambiguous': return 'Ambiguous intent';
      case 'payment': return 'Payment-related';
      case 'policy': return 'Policy/compliance';
      default: return reason;
    }
  };

  const getRange = () => {
    const now = new Date();
    const endSrc = to ? new Date(to) : now;
    const startSrc = from ? new Date(from) : new Date(now.getTime() - 29*24*60*60*1000);
    // Use full-day boundaries in UTC: [start 00:00:00, end next-day 00:00:00)
    const startUtc = new Date(Date.UTC(startSrc.getUTCFullYear(), startSrc.getUTCMonth(), startSrc.getUTCDate(), 0, 0, 0));
    const endUtc = new Date(Date.UTC(endSrc.getUTCFullYear(), endSrc.getUTCMonth(), endSrc.getUTCDate() + 1, 0, 0, 0));
    return { start: startUtc.toISOString(), end: endUtc.toISOString() };
  };

  const fetchMetrics = async () => {
    const { start, end } = getRange();
    // Chats per channel
    const { data: ch } = await supabase.rpc('get_channel_chat_counts', { p_from: start, p_to: end });
    setChannelCounts((ch as any || []).map((r: any) => ({ provider: r.provider, display_name: r.display_name, thread_count: Number(r.thread_count||0) })));
    // Response times
    const { data: rt } = await supabase.rpc('get_response_time_stats', { p_from: start, p_to: end, p_channel: channelFilter !== 'all' ? channelFilter : null });
    if (rt && (rt as any[]).length > 0) {
      const row = (rt as any[])[0];
      setAiAvg(Number(row.ai_avg||0));
      setAgentAvg(Number(row.agent_avg||0));
    }
    // Containment & handover (fallback if combined RPC missing)
    const { data: ch2, error: ch2Err } = await supabase.rpc('get_containment_and_handover', { p_from: start, p_to: end });
    if (!ch2Err && ch2 && (ch2 as any[]).length > 0) {
      const row = (ch2 as any[])[0];
      setContainment({ total: Number(row.total_threads||0), ai: Number(row.ai_resolved_count||0), rate: Number(row.containment_rate||0), handover: Number(row.handover_count||0), handover_rate: Number(row.handover_rate||0) });
    } else if (ch2Err && ch2Err.code === 'PGRST202') {
      // Fallback: use get_containment + get_handover_stats
      const { data: cont } = await supabase.rpc('get_containment', { p_from: start, p_to: end });
      let total = 0, ai = 0, rate = 0, handover = 0, handover_rate = 0;
      if (cont && (cont as any[]).length > 0) {
        const row2 = (cont as any[])[0];
        total = Number(row2.total_threads || 0);
        ai = Number(row2.ai_resolved_count || 0);
        rate = Number(row2.rate || 0);
      }
      const { data: hsForFallback } = await supabase.rpc('get_handover_stats', { p_from: start, p_to: end });
      const sumHandover = ((hsForFallback as any[]) || []).reduce((sum, r) => sum + Number((r as any).count || 0), 0);
      handover = sumHandover;
      handover_rate = total > 0 ? (sumHandover / total) : 0;
      setContainment({ total, ai, rate, handover, handover_rate });
    }
    // Time series
    const { data: ts } = await supabase.rpc('get_chats_timeseries', { p_from: start, p_to: end, p_channel: channelFilter !== 'all' ? channelFilter : null });
    setSeries(((ts as any) || []).map((r: any) => ({ bucket: r.bucket, provider: r.provider, count: Number(r.count||0) })));
    // Handover stats
    const { data: hs } = await supabase.rpc('get_handover_stats', { p_from: start, p_to: end });
    setHandoverStats(((hs as any) || []).map((r: any) => ({ reason: formatHandoverLabel(r.reason) || '(unspecified)', count: Number(r.count||0), total: Number(r.total||0), rate: Number(r.rate||0) })));
  };

  // Single source of truth for fetching; avoids double calls on mount
  useEffect(() => {
    const run = () => fetchMetrics();
    if (isDocumentHidden()) onDocumentVisible(run); else run();
  }, [from, to, channelFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">High-level KPIs for conversations, AI agents, and human agents.</p>
      </div>

      {/* Range controls */}
      <div className="flex items-end gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">From</div>
          <Input
            type="date"
            value={from}
            max={to || new Date().toISOString().slice(0,10)}
            onChange={(e)=>{
              const v = e.target.value;
              setFrom(v);
              if (to && v && v > to) setTo(v);
            }}
            className="h-9 w-[180px]"
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">To</div>
          <Input
            type="date"
            value={to}
            min={from || undefined}
            max={new Date().toISOString().slice(0,10)}
            onChange={(e)=>{
              const v = e.target.value;
              setTo(v);
              if (from && v && v < from) setFrom(v);
            }}
            className="h-9 w-[180px]"
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Channel</div>
          <Select value={channelFilter} onValueChange={async(v)=>{ setChannelFilter(v); try{ await logAction({ action: 'analytics.channel_filter', resource: 'analytics', context: { channel: v } }); } catch{} }}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="h-9" onClick={fetchMetrics}>Refresh</Button>
      </div>

      <Tabs defaultValue="conversation" className="w-full mt-4">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="ai-agent">AI Agent</TabsTrigger>
          <TabsTrigger value="human-agent">Human Agent</TabsTrigger>
        </TabsList>

        <TabsContent value="conversation" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Total Chats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{containment.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>AI Containment Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{Math.round(containment.rate * 100)}%</div>
                <div className="text-sm text-muted-foreground">{containment.ai} / {containment.total}</div>
                <Button variant="outline" className="mt-2 h-8" onClick={async()=>{ setDrillOpen(true); const { start, end } = getRange(); const { data } = await supabase.rpc('get_non_contained', { p_from: start, p_to: end, p_limit: 100, p_offset: 0 }); setDrillRows((data as any)||[]); }}>View non-contained</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Handover Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{Math.round(containment.handover_rate * 100)}%</div>
                <div className="text-sm text-muted-foreground">{containment.handover} / {containment.total}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Chats per Channel</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelCounts.map(r=>({ name: r.display_name || r.provider, count: r.thread_count }))}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS[2]} radius={[4,4,0,0]}>
                    <LabelList dataKey="count" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chats Time Series (Asia/Jakarta)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const providers = Array.from(new Set(series.map(s => s.provider)));
                  const buckets = Array.from(new Set(series.map(s => s.bucket))).sort();
                  const data = buckets.map(b => {
                    const row: any = { bucket: new Date(b).toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta' }) };
                    for (const p of providers) {
                      row[p] = series.find(s => s.bucket === b && s.provider === p)?.count || 0;
                    }
                    return row;
                  });
                  return (
                    <BarChart data={data}>
                      <XAxis dataKey="bucket" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {providers.map((p, idx) => (
                        <Bar key={p} dataKey={p} stackId={undefined} fill={COLORS[(idx % (COLORS.length-1))+1]} />
                      ))}
                    </BarChart>
                  );
                })()}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-agent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Metrics</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: 'AI Avg Response (s)', value: aiAvg }]}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[3]} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="value" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="human-agent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Metrics & Rates</CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={handoverStats.map(h=>({ name: h.reason, value: h.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {handoverStats.map((_, i)=> (
                      <Cell key={i} fill={COLORS[(i % (COLORS.length-1))+1]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Non-contained Conversations</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Contact</th>
                  <th className="text-left py-2">Handover Reason</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map(r => (
                  <tr key={r.id}>
                    <td className="py-1">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-1">{r.contact_name}</td>
                    <td className="py-1">{r.handover_reason || '(none)'}</td>
                    <td className="py-1">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


