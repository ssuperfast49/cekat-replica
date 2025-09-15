import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, Legend, LabelList } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

  const getRange = () => {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(Date.now() - 7*24*60*60*1000);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchMetrics = async () => {
    const { start, end } = getRange();
    // Chats per channel
    const { data: ch } = await supabase.rpc('get_channel_chat_counts', { p_from: start, p_to: end });
    setChannelCounts((ch as any || []).map((r: any) => ({ provider: r.provider, display_name: r.display_name, thread_count: Number(r.thread_count||0) })));
    // Response times
    const { data: rt } = await supabase.rpc('get_response_times', { p_from: start, p_to: end });
    if (rt && (rt as any[]).length > 0) {
      const row = (rt as any[])[0];
      setAiAvg(Number(row.ai_avg_seconds||0));
      setAgentAvg(Number(row.agent_avg_seconds||0));
    }
    // Containment & handover
    const { data: ch2 } = await supabase.rpc('get_containment_and_handover', { p_from: start, p_to: end });
    if (ch2 && (ch2 as any[]).length > 0) {
      const row = (ch2 as any[])[0];
      setContainment({ total: Number(row.total_threads||0), ai: Number(row.ai_resolved_count||0), rate: Number(row.containment_rate||0), handover: Number(row.handover_count||0), handover_rate: Number(row.handover_rate||0) });
    }
  };

  useEffect(() => { fetchMetrics(); }, []);
  useEffect(() => { fetchMetrics(); }, [from, to]);

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
          <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="h-9 w-[180px]" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">To</div>
          <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="h-9 w-[180px]" />
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
                <BarChart data={[
                  { name: 'Agent Avg Resp (s)', value: agentAvg },
                  { name: 'Containment %', value: Math.round(containment.rate*100) },
                  { name: 'Handover %', value: Math.round(containment.handover_rate*100) },
                ]}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[0]} radius={[4,4,0,0]}>
                    <LabelList dataKey="value" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


