import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, BarChart, Bar, Legend, LabelList, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { supabase, logAction, protectedSupabase } from "@/lib/supabase";
import { isDocumentHidden, onDocumentVisible } from "@/lib/utils";
import { HelpCircle, Database, Trash2, AlertTriangle, CheckCircle, Shield, CalendarIcon } from "lucide-react";
import PermissionGate from "@/components/rbac/PermissionGate";
import { useRBAC } from "@/contexts/RBACContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

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

// Helper component for labels with help icon
const LabelWithHelp = ({ label, description }: { label: string; description: string }) => (
  <div className="flex items-center gap-2">
    <span>{label}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent>
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  </div>
);

export default function Analytics() {
  const pieColors = useMemo(() => COLORS.slice(0, humanResolution.length), []);
  const { hasPermission } = useRBAC();

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
  // Token usage (from token_usage_logs)
  const [tokenSeries, setTokenSeries] = useState<Array<{ day: string; input: number; output: number; total: number }>>([]);
  const [modelUsage, setModelUsage] = useState<Array<{ model: string; tokens: number }>>([]);
  const [tokenTotals, setTokenTotals] = useState<{ input: number; output: number; total: number }>({ input: 0, output: 0, total: 0 });
  // Human Agent analytics
  const [handoverBySuper, setHandoverBySuper] = useState<Array<{ super_agent_id: string | null; super_agent_name: string | null; human_resolved: number; ai_resolved: number; handover_rate: number }>>([]);
  const [handoverByAgent, setHandoverByAgent] = useState<Array<{ agent_user_id: string; agent_name: string | null; super_agent_id: string | null; human_resolved: number; ai_resolved: number; handover_rate: number }>>([]);
  const [agentKpis, setAgentKpis] = useState<Array<{ agent_user_id: string; agent_name: string | null; resolved_count: number; avg_resolution_minutes: number | null }>>([]);
  const [selectedSuperForAgents, setSelectedSuperForAgents] = useState<string | 'all'>('all');
  // Database analytics - comprehensive state
  const [databaseStats, setDatabaseStats] = useState<Array<{
    tablename: string;
    total_size_bytes: number;
    total_size_pretty: string;
    table_size_bytes: number;
    table_size_pretty: string;
    indexes_size_bytes: number;
    indexes_size_pretty: string;
    row_count: number;
    dead_rows: number;
    sequential_scans: number;
    index_scans: number;
    table_scan_ratio: number;
    last_vacuum: string | null;
    last_autovacuum: string | null;
    last_analyze: string | null;
    last_autoanalyze: string | null;
    inserts: number;
    updates: number;
    deletes: number;
    hot_updates: number;
  }>>([]);
  const [databaseOverview, setDatabaseOverview] = useState<{
    total_size_bytes: number;
    total_size_pretty: string;
    data_size_bytes: number;
    data_size_pretty: string;
    indexes_size_bytes: number;
    indexes_size_pretty: string;
    total_tables: number;
    total_rows: number;
    total_indexes: number;
    total_sequences: number;
  } | null>(null);
  const [memoryStats, setMemoryStats] = useState<{
    shared_buffers_hit: number;
    shared_buffers_read: number;
    shared_buffers_hit_ratio: number;
    cache_hit_ratio: number;
    heap_hit_ratio: number;
    idx_scan_ratio: number;
    total_sequential_scans: number;
    total_index_scans: number;
  } | null>(null);
  const [indexStats, setIndexStats] = useState<Array<{
    tablename: string;
    indexname: string;
    index_size_bytes: number;
    index_size_pretty: string;
    index_scans: number;
    index_tup_reads: number;
    index_tup_fetches: number;
    idx_blks_hit: number;
    idx_blks_read: number;
  }>>([]);
  const [databaseActivity, setDatabaseActivity] = useState<{
    total_inserts: number;
    total_updates: number;
    total_deletes: number;
    total_sequential_scans: number;
    total_index_scans: number;
    total_blocks_hit: number;
    total_blocks_read: number;
    cache_hit_percentage: number;
  } | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  
  // Data retention & GDPR moved to Admin Panel

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
    const { data: ch } = await protectedSupabase.rpc('get_channel_chat_counts', { p_from: start, p_to: end });
    setChannelCounts((ch as any || []).map((r: any) => ({ provider: r.provider, display_name: r.display_name, thread_count: Number(r.thread_count||0) })));
    // Response times
    const { data: rt } = await protectedSupabase.rpc('get_response_time_stats', { p_from: start, p_to: end, p_channel: channelFilter !== 'all' ? channelFilter : null });
    if (rt && (rt as any[]).length > 0) {
      const row = (rt as any[])[0];
      setAiAvg(Number(row.ai_avg||0));
      setAgentAvg(Number(row.agent_avg||0));
    }
    // Containment & handover (fallback if combined RPC missing)
    const { data: ch2, error: ch2Err } = await protectedSupabase.rpc('get_containment_and_handover', { p_from: start, p_to: end });
    if (!ch2Err && ch2 && (ch2 as any[]).length > 0) {
      const row = (ch2 as any[])[0];
      setContainment({ total: Number(row.total_threads||0), ai: Number(row.ai_resolved_count||0), rate: Number(row.containment_rate||0), handover: Number(row.handover_count||0), handover_rate: Number(row.handover_rate||0) });
    } else if (ch2Err && ch2Err.code === 'PGRST202') {
      // Fallback: use get_containment + get_handover_stats
      const { data: cont } = await protectedSupabase.rpc('get_containment', { p_from: start, p_to: end });
      let total = 0, ai = 0, rate = 0, handover = 0, handover_rate = 0;
      if (cont && (cont as any[]).length > 0) {
        const row2 = (cont as any[])[0];
        total = Number(row2.total_threads || 0);
        ai = Number(row2.ai_resolved_count || 0);
        rate = Number(row2.rate || 0);
      }
      const { data: hsForFallback } = await protectedSupabase.rpc('get_handover_stats', { p_from: start, p_to: end });
      const sumHandover = ((hsForFallback as any[]) || []).reduce((sum, r) => sum + Number((r as any).count || 0), 0);
      handover = sumHandover;
      handover_rate = total > 0 ? (sumHandover / total) : 0;
      setContainment({ total, ai, rate, handover, handover_rate });
    }
    // Time series
    const { data: ts } = await protectedSupabase.rpc('get_chats_timeseries', { p_from: start, p_to: end, p_channel: channelFilter !== 'all' ? channelFilter : null });
    setSeries(((ts as any) || []).map((r: any) => ({ bucket: r.bucket, provider: r.provider, count: Number(r.count||0) })));
    // Handover stats
    const { data: hs } = await protectedSupabase.rpc('get_handover_stats', { p_from: start, p_to: end });
    setHandoverStats(((hs as any) || []).map((r: any) => ({ reason: formatHandoverLabel(r.reason) || '(unspecified)', count: Number(r.count||0), total: Number(r.total||0), rate: Number(r.rate||0) })));

    // Token usage (client-side aggregation from token_usage_logs)
    try {
      const { data: logs } = await supabase
        .from('token_usage_logs')
        .select('made_at, prompt_tokens, completion_tokens, total_tokens, model, channel_id')
        .gte('made_at', start)
        .lt('made_at', end)
        .order('made_at', { ascending: true });
      const byDay: Record<string, { input: number; output: number; total: number }> = {};
      const byModel: Record<string, number> = {};
      let sumIn = 0, sumOut = 0, sumTotal = 0;
      for (const row of (logs as any[]) || []) {
        const day = new Date(row.made_at).toISOString().slice(0,10);
        const input = Number(row.prompt_tokens || 0);
        const output = Number(row.completion_tokens || 0);
        const total = Number(row.total_tokens || (input + output));
        if (!byDay[day]) byDay[day] = { input: 0, output: 0, total: 0 };
        byDay[day].input += input;
        byDay[day].output += output;
        byDay[day].total += total;
        const model = String(row.model || 'unknown');
        byModel[model] = (byModel[model] || 0) + total;
        sumIn += input; sumOut += output; sumTotal += total;
      }
      const series = Object.keys(byDay).sort().map(d => ({ day: d, ...byDay[d] }));
      const models = Object.entries(byModel)
        .sort((a,b)=>b[1]-a[1])
        .slice(0, 8)
        .map(([model, tokens]) => ({ model, tokens }));
      setTokenSeries(series);
      setModelUsage(models);
      setTokenTotals({ input: sumIn, output: sumOut, total: sumTotal });
    } catch {}

    // Human Agent analytics
    try {
      const { data: bySuper } = await protectedSupabase.rpc('get_handover_by_super_agent', { p_from: start, p_to: end });
      setHandoverBySuper(((bySuper as any) || []).map((r: any) => ({
        super_agent_id: r.super_agent_id,
        super_agent_name: r.super_agent_name,
        human_resolved: Number(r.human_resolved || 0),
        ai_resolved: Number(r.ai_resolved || 0),
        handover_rate: Number(r.handover_rate || 0),
      })));

      const superFilter = selectedSuperForAgents !== 'all' ? selectedSuperForAgents : null;
      const [{ data: byAgent }, { data: kpis }] = await Promise.all([
        protectedSupabase.rpc('get_handover_by_agent', { p_from: start, p_to: end, p_super_agent_id: superFilter }),
        protectedSupabase.rpc('get_agent_kpis', { p_from: start, p_to: end, p_super_agent_id: superFilter })
      ]);
      setHandoverByAgent(((byAgent as any) || []).map((r: any) => ({
        agent_user_id: r.agent_user_id,
        agent_name: r.agent_name,
        super_agent_id: r.super_agent_id,
        human_resolved: Number(r.human_resolved || 0),
        ai_resolved: Number(r.ai_resolved || 0),
        handover_rate: Number(r.handover_rate || 0),
      })));
      setAgentKpis(((kpis as any) || []).map((r: any) => ({
        agent_user_id: r.agent_user_id,
        agent_name: r.agent_name,
        resolved_count: Number(r.resolved_count || 0),
        avg_resolution_minutes: r.avg_resolution_minutes != null ? Number(r.avg_resolution_minutes) : null,
      })));
    } catch {}
  };

  const fetchDatabaseStats = async () => {
    try {
      // Fetch detailed table statistics
      const { data: stats, error: statsError } = await protectedSupabase.rpc('get_database_stats_detailed');
      if (statsError) {
        console.error('Error fetching database stats:', statsError);
        return;
      }
      if (stats) {
        console.log('Database stats fetched:', stats.length, 'tables');
        setDatabaseStats((stats as any[]).map((r: any) => ({
          tablename: r.tablename,
          total_size_bytes: Number(r.total_size_bytes || 0),
          total_size_pretty: r.total_size_pretty || '0 bytes',
          table_size_bytes: Number(r.table_size_bytes || 0),
          table_size_pretty: r.table_size_pretty || '0 bytes',
          indexes_size_bytes: Number(r.indexes_size_bytes || 0),
          indexes_size_pretty: r.indexes_size_pretty || '0 bytes',
          row_count: Number(r.row_count || 0),
          dead_rows: Number(r.dead_rows || 0),
          sequential_scans: Number(r.sequential_scans || 0),
          index_scans: Number(r.index_scans || 0),
          table_scan_ratio: Number(r.table_scan_ratio || 0),
          last_vacuum: r.last_vacuum || null,
          last_autovacuum: r.last_autovacuum || null,
          last_analyze: r.last_analyze || null,
          last_autoanalyze: r.last_autoanalyze || null,
          inserts: Number(r.inserts || 0),
          updates: Number(r.updates || 0),
          deletes: Number(r.deletes || 0),
          hot_updates: Number(r.hot_updates || 0),
        })));
      }
      
      // Fetch database overview
      const { data: overview, error: overviewError } = await protectedSupabase.rpc('get_database_overview');
      if (overviewError) {
        console.error('Error fetching database overview:', overviewError);
      }
      if (overview && (overview as any[]).length > 0) {
        console.log('Database overview fetched:', overview);
        const row = (overview as any[])[0];
        setDatabaseOverview({
          total_size_bytes: Number(row.total_size_bytes || 0),
          total_size_pretty: row.total_size_pretty || '0 bytes',
          data_size_bytes: Number(row.data_size_bytes || 0),
          data_size_pretty: row.data_size_pretty || '0 bytes',
          indexes_size_bytes: Number(row.indexes_size_bytes || 0),
          indexes_size_pretty: row.indexes_size_pretty || '0 bytes',
          total_tables: Number(row.total_tables || 0),
          total_rows: Number(row.total_rows || 0),
          total_indexes: Number(row.total_indexes || 0),
          total_sequences: Number(row.total_sequences || 0),
        });
      }

      // Fetch memory and cache statistics
      const { data: memory } = await protectedSupabase.rpc('get_database_memory_stats');
      if (memory && (memory as any[]).length > 0) {
        const row = (memory as any[])[0];
        setMemoryStats({
          shared_buffers_hit: Number(row.shared_buffers_hit || 0),
          shared_buffers_read: Number(row.shared_buffers_read || 0),
          shared_buffers_hit_ratio: Number(row.shared_buffers_hit_ratio || 0),
          cache_hit_ratio: Number(row.cache_hit_ratio || 0),
          heap_hit_ratio: Number(row.heap_hit_ratio || 0),
          idx_scan_ratio: Number(row.idx_scan_ratio || 0),
          total_sequential_scans: Number(row.total_sequential_scans || 0),
          total_index_scans: Number(row.total_index_scans || 0),
        });
      }

      // Fetch index statistics
      const { data: indexes } = await protectedSupabase.rpc('get_index_stats');
      if (indexes) {
        setIndexStats((indexes as any[]).map((r: any) => ({
          tablename: r.tablename,
          indexname: r.indexname,
          index_size_bytes: Number(r.index_size_bytes || 0),
          index_size_pretty: r.index_size_pretty || '0 bytes',
          index_scans: Number(r.index_scans || 0),
          index_tup_reads: Number(r.index_tup_reads || 0),
          index_tup_fetches: Number(r.index_tup_fetches || 0),
          idx_blks_hit: Number(r.idx_blks_hit || 0),
          idx_blks_read: Number(r.idx_blks_read || 0),
        })));
      }

      // Fetch database activity
      const { data: activity } = await protectedSupabase.rpc('get_database_activity');
      if (activity && (activity as any[]).length > 0) {
        const row = (activity as any[])[0];
        setDatabaseActivity({
          total_inserts: Number(row.total_inserts || 0),
          total_updates: Number(row.total_updates || 0),
          total_deletes: Number(row.total_deletes || 0),
          total_sequential_scans: Number(row.total_sequential_scans || 0),
          total_index_scans: Number(row.total_index_scans || 0),
          total_blocks_hit: Number(row.total_blocks_hit || 0),
          total_blocks_read: Number(row.total_blocks_read || 0),
          cache_hit_percentage: Number(row.cache_hit_percentage || 0),
        });
      }
    } catch (error) {
      console.error('Failed to fetch database stats:', error);
      // Set empty states on error so UI doesn't break
      setDatabaseStats([]);
      setDatabaseOverview(null);
      setMemoryStats(null);
      setIndexStats([]);
      setDatabaseActivity(null);
    }
  };

  const formatInputDate = (date: Date) => date.toISOString().slice(0, 10);

  const formatDisplayDate = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  const dateSummary = useMemo(() => {
    if (from && to) {
      return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
    }
    if (from) {
      return `From ${formatDisplayDate(from)}`;
    }
    if (to) {
      return `Until ${formatDisplayDate(to)}`;
    }
    return "Select date range";
  }, [from, to]);

  useEffect(() => {
    setDateRange((prev) => {
      const nextFrom = from ? new Date(from) : undefined;
      const nextTo = to ? new Date(to) : undefined;

      if (!nextFrom && !nextTo) {
        return prev ? undefined : prev;
      }

      const prevFromTime = prev?.from ? prev.from.getTime() : undefined;
      const prevToTime = prev?.to ? prev.to.getTime() : undefined;
      const nextFromTime = nextFrom ? nextFrom.getTime() : undefined;
      const nextToTime = nextTo ? nextTo.getTime() : undefined;

      if (prevFromTime === nextFromTime && prevToTime === nextToTime) {
        return prev;
      }

      return { from: nextFrom, to: nextTo };
    });
  }, [from, to]);

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (!range) {
      setFrom("");
      setTo("");
      return;
    }
    const nextFrom = range.from ? formatInputDate(range.from) : "";
    const nextTo = range.to ? formatInputDate(range.to) : "";
    setFrom(nextFrom);
    setTo(nextTo);
    if (range.from && range.to) {
      setDatePopoverOpen(false);
    }
  };

  const handleClearDateRange = () => {
    setDateRange(undefined);
    setFrom("");
    setTo("");
    setDatePopoverOpen(false);
  };


  // Single source of truth for fetching; avoids double calls on mount
  useEffect(() => {
    if (datePopoverOpen) {
      return;
    }
    const run = () => {
      fetchMetrics();
      fetchDatabaseStats();
      // Retention & GDPR moved to Admin Panel
    };
    run();
  }, [from, to, channelFilter, datePopoverOpen]);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">High-level KPIs for conversations, AI agents, and human agents.</p>
      </div>

      {/* Range controls */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground mb-1">Date Range</span>
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`justify-start text-left font-normal h-9 w-[220px] ${!from && !to ? "text-muted-foreground" : ""}`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateSummary}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-[520px] p-0" align="start">
              <CalendarComponent
                mode="range"
                numberOfMonths={2}
                selected={dateRange}
                defaultMonth={dateRange?.from ?? new Date()}
                onSelect={handleCalendarSelect}
                disabled={(date) => date > new Date()}
                initialFocus
              />
              <div className="flex items-center justify-between border-t px-3 py-2">
                <Button variant="ghost" size="sm" onClick={handleClearDateRange}>
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePopoverOpen(false)}
                    disabled={!dateRange?.from && !dateRange?.to}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
        <Button variant="outline" className="h-9" onClick={() => { fetchMetrics(); fetchDatabaseStats(); }}>Refresh</Button>
      </div>

      <Tabs defaultValue="conversation" className="w-full mt-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-5 bg-muted/50 p-1">
          <TabsTrigger 
            value="conversation"
            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-muted/30"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span>Conversation</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat analitik percakapan dan KPI</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
          <TabsTrigger 
            value="ai-agent"
            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-muted/30"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span>AI Agent</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat metrik kinerja agen AI</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
          <TabsTrigger 
            value="human-agent"
            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-muted/30"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span>Human Agent</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat metrik kinerja agen manusia</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
          <TabsTrigger 
            value="database"
            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-muted/30"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span>Database</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat statistik penggunaan database dan ukuran tabel</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversation" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Total Chats" 
                    description="Jumlah total percakapan yang terjadi dalam periode yang dipilih"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{containment.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="AI Containment Rate" 
                    description="Persentase percakapan yang berhasil diselesaikan oleh AI tanpa perlu intervensi manusia. Semakin tinggi semakin baik."
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{Math.round(containment.rate * 100)}%</div>
                <div className="text-sm text-muted-foreground">{containment.ai} / {containment.total}</div>
                <Button variant="outline" className="mt-2 h-8" onClick={async()=>{ setDrillOpen(true); const { start, end } = getRange(); const { data } = await protectedSupabase.rpc('get_non_contained', { p_from: start, p_to: end, p_limit: 100, p_offset: 0 }); setDrillRows((data as any)||[]); }}>View non-contained</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Handover Rate" 
                    description="Persentase percakapan yang dialihkan dari AI ke agen manusia karena memerlukan intervensi manual"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{Math.round(containment.handover_rate * 100)}%</div>
                <div className="text-sm text-muted-foreground">{containment.handover} / {containment.total}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Chats per Channel" 
                  description="Distribusi jumlah percakapan berdasarkan saluran komunikasi (WhatsApp, Telegram, Web Chat, dll)"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelCounts.map(r=>({ name: r.display_name || r.provider, count: r.thread_count }))}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill={COLORS[2]} radius={[4,4,0,0]}>
                    <LabelList dataKey="count" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Chats Time Series (Asia/Jakarta)" 
                  description="Grafik tren jumlah percakapan dari waktu ke waktu dalam zona waktu Asia/Jakarta, dikelompokkan berdasarkan saluran"
                />
              </CardTitle>
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
                      <RechartsTooltip />
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

          {/* Admin-only retention & GDPR moved to Admin Panel */}
        </TabsContent>

        <TabsContent value="ai-agent" className="space-y-6">
          {/* <Card>
            <CardHeader>
              <CardTitle>AI Metrics</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: 'AI Avg Response (s)', value: aiAvg }]}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill={COLORS[3]} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="value" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card> */}

          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="AI Token Usage (by day)" 
                  description="Penggunaan token AI per hari, menunjukkan token input (prompt) dan output (completion). Token adalah unit penggunaan untuk menghitung biaya AI"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokenSeries.map(r=>({ day: new Date(r.day).toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta' }), input: r.input, output: r.output }))}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="input" stackId="tokens" fill={COLORS[1]} name="Prompt tokens" />
                  <Bar dataKey="output" stackId="tokens" fill={COLORS[2]} name="Completion tokens" />
                </BarChart>
              </ResponsiveContainer>
              <div className="text-xs text-muted-foreground mt-2">Total tokens: {tokenTotals.total.toLocaleString()} (input {tokenTotals.input.toLocaleString()}, output {tokenTotals.output.toLocaleString()})</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Top Models by Tokens" 
                  description="Model AI yang paling banyak menggunakan token, diurutkan berdasarkan total penggunaan. Membantu mengidentifikasi model mana yang paling banyak digunakan"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelUsage.map(m=>({ name: m.model, tokens: m.tokens }))} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={160} />
                  <RechartsTooltip />
                  <Bar dataKey="tokens" fill={COLORS[4]} radius={[0,4,4,0]}>
                    <LabelList dataKey="tokens" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="human-agent" className="space-y-6">

          {/* Filter and handover per agent within selected super agent */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Super Agent</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filter untuk melihat metrik agen yang berada di bawah super agent tertentu. Pilih 'All' untuk melihat semua agen</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select value={selectedSuperForAgents} onValueChange={(v)=>setSelectedSuperForAgents(v as any)}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {handoverBySuper.map(s=> (
                  <SelectItem key={s.super_agent_id || 'none'} value={String(s.super_agent_id || 'none')}>{s.super_agent_name || '—'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-9" onClick={fetchMetrics}>Apply</Button>
          </div>

          {/* Agent KPIs */}
          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Agent KPIs" 
                  description="Key Performance Indicators untuk setiap agen manusia: jumlah percakapan yang diselesaikan dan waktu rata-rata penyelesaian (dalam menit)"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentKpis.map(k=>({ name: k.agent_name || '—', resolved: k.resolved_count, avgMin: Math.round((k.avg_resolution_minutes||0)) }))}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="resolved" name="Resolved" fill={COLORS[3]} radius={[4,4,0,0]} />
                  <Bar dataKey="avgMin" name="Avg Resolution (min)" fill={COLORS[5]} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          {/* Database Overview KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Total Database Size" 
                    description="Total ukuran database termasuk semua tabel, indeks, dan metadata dalam format yang mudah dibaca"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{databaseOverview?.total_size_pretty || 'Loading...'}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Data: {databaseOverview?.data_size_pretty || '—'} | Indexes: {databaseOverview?.indexes_size_pretty || '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Total Tables" 
                    description="Jumlah total tabel yang ada di database public schema"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{databaseOverview?.total_tables || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Total Rows" 
                    description="Jumlah total baris data di semua tabel database"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{(databaseOverview?.total_rows || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Total Indexes" 
                    description="Jumlah total indeks yang ada di database. Indeks membantu mempercepat query"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{databaseOverview?.total_indexes || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Memory & Cache Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Cache Hit Ratio" 
                    description="Persentase data yang ditemukan di cache memory. Semakin tinggi semakin baik (idealnya >95%). Menunjukkan efisiensi penggunaan memory"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {memoryStats ? `${(memoryStats.cache_hit_ratio * 100).toFixed(2)}%` : 'Loading...'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Hits: {memoryStats ? memoryStats.shared_buffers_hit.toLocaleString() : '—'} | 
                  Reads: {memoryStats ? memoryStats.shared_buffers_read.toLocaleString() : '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Index Scan Ratio" 
                    description="Persentase scan yang menggunakan indeks dibanding sequential scan. Semakin tinggi semakin baik. Menunjukkan efektivitas indeks"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {memoryStats ? `${(memoryStats.idx_scan_ratio * 100).toFixed(2)}%` : 'Loading...'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Index: {memoryStats ? memoryStats.total_index_scans.toLocaleString() : '—'} | 
                  Seq: {memoryStats ? memoryStats.total_sequential_scans.toLocaleString() : '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Heap Hit Ratio" 
                    description="Persentase hit pada heap (tabel data) di cache memory. Semakin tinggi semakin baik"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {memoryStats ? `${(memoryStats.heap_hit_ratio * 100).toFixed(2)}%` : 'Loading...'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Database Activity Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Total Inserts" 
                    description="Jumlah total operasi INSERT yang pernah dilakukan di semua tabel"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{(databaseActivity?.total_inserts || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Total Updates" 
                    description="Jumlah total operasi UPDATE yang pernah dilakukan di semua tabel"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{(databaseActivity?.total_updates || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Total Deletes" 
                    description="Jumlah total operasi DELETE yang pernah dilakukan di semua tabel"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{(databaseActivity?.total_deletes || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <LabelWithHelp 
                    label="Cache Hit %" 
                    description="Persentase blok yang ditemukan di cache vs yang dibaca dari disk. Semakin tinggi semakin baik untuk performa"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{databaseActivity ? `${databaseActivity.cache_hit_percentage.toFixed(2)}%` : 'Loading...'}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Hits: {databaseActivity ? databaseActivity.total_blocks_hit.toLocaleString() : '—'} | 
                  Reads: {databaseActivity ? databaseActivity.total_blocks_read.toLocaleString() : '—'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table Sizes Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Table Sizes" 
                  description="Ukuran total (termasuk indeks) untuk setiap tabel diurutkan dari yang terbesar. Membantu mengidentifikasi tabel yang memakan banyak ruang"
                />
              </CardTitle>
            </CardHeader>
              <CardContent className="h-64">
              {databaseStats.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={databaseStats.slice(0, 10).map(s => ({ 
                      name: s.tablename, 
                      size: s.total_size_bytes / 1024 // Convert to KB for better readability
                    }))} 
                    layout="vertical"
                  >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={160} />
                  <RechartsTooltip 
                    formatter={(value: any) => `${value.toFixed(2)} KB`}
                    labelFormatter={(label) => `Table: ${label}`}
                  />
                  <Bar dataKey="size" fill={COLORS[1]} radius={[0,4,4,0]}>
                    <LabelList 
                      dataKey="size" 
                      position="right" 
                      formatter={(value: any) => `${value.toFixed(2)} KB`}
                    />
                  </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Row Counts Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Row Counts by Table" 
                  description="Jumlah baris data per tabel, diurutkan dari yang terbanyak. Menunjukkan tabel mana yang paling aktif menyimpan data"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {databaseStats.filter(s => s.row_count > 0).length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={databaseStats.filter(s => s.row_count > 0).slice(0, 10).map(s => ({ 
                      name: s.tablename, 
                      rows: s.row_count
                    }))} 
                    layout="vertical"
                  >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={160} />
                  <RechartsTooltip />
                  <Bar dataKey="rows" fill={COLORS[3]} radius={[0,4,4,0]}>
                    <LabelList dataKey="rows" position="right" />
                  </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Index Sizes Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Index Sizes (Top 15)" 
                  description="Ukuran setiap indeks diurutkan dari yang terbesar. Indeks besar mungkin perlu dioptimasi"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {indexStats.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={indexStats.slice(0, 15).map(s => ({ 
                      name: `${s.tablename}.${s.indexname}`.substring(0, 30), 
                      size: s.index_size_bytes / 1024,
                      scans: s.index_scans
                    }))} 
                    layout="vertical"
                  >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={200} />
                  <RechartsTooltip 
                    formatter={(value: any, name: string) => {
                      if (name === 'size') return `${value.toFixed(2)} KB`;
                      return value.toLocaleString();
                    }}
                    labelFormatter={(label) => `Index: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="size" name="Size (KB)" fill={COLORS[1]} radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Table Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Table Activity (Top 10)" 
                  description="Jumlah operasi INSERT, UPDATE, dan DELETE per tabel. Menunjukkan tabel mana yang paling aktif"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {databaseStats.filter(s => (s.inserts + s.updates + s.deletes) > 0).length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={databaseStats.filter(s => (s.inserts + s.updates + s.deletes) > 0).slice(0, 10).map(s => ({ 
                      name: s.tablename, 
                      inserts: s.inserts,
                      updates: s.updates,
                      deletes: s.deletes
                    }))} 
                    layout="vertical"
                  >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={160} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="inserts" stackId="activity" fill={COLORS[2]} name="Inserts" />
                  <Bar dataKey="updates" stackId="activity" fill={COLORS[4]} name="Updates" />
                  <Bar dataKey="deletes" stackId="activity" fill={COLORS[5]} name="Deletes" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Scan Ratio Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Table Scan Ratios" 
                  description="Rasio sequential scan vs index scan per tabel. Sequential scan tinggi menunjukkan perlu indeks yang lebih baik"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {databaseStats.filter(s => (s.sequential_scans + s.index_scans) > 0).length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={databaseStats.filter(s => (s.sequential_scans + s.index_scans) > 0).slice(0, 10).map(s => ({ 
                      name: s.tablename, 
                      seqRatio: Number((s.table_scan_ratio * 100).toFixed(1)),
                      idxRatio: Number(((1 - s.table_scan_ratio) * 100).toFixed(1))
                    }))} 
                    layout="vertical"
                  >
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={160} />
                  <RechartsTooltip formatter={(value: any) => `${value}%`} />
                  <Legend />
                  <Bar dataKey="seqRatio" stackId="scan" fill={COLORS[5]} name="Seq Scan %" />
                  <Bar dataKey="idxRatio" stackId="scan" fill={COLORS[3]} name="Index Scan %" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Detailed Table Statistics Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Comprehensive Table Statistics" 
                  description="Rincian lengkap setiap tabel: ukuran, baris, statistik scan, operasi DML, dan informasi maintenance"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 sticky left-0 bg-background">Table</th>
                      <th className="text-right py-2 px-2">Total Size</th>
                      <th className="text-right py-2 px-2">Rows</th>
                      <th className="text-right py-2 px-2">Dead Rows</th>
                      <th className="text-right py-2 px-2">Inserts</th>
                      <th className="text-right py-2 px-2">Updates</th>
                      <th className="text-right py-2 px-2">Deletes</th>
                      <th className="text-right py-2 px-2">Seq Scans</th>
                      <th className="text-right py-2 px-2">Idx Scans</th>
                      <th className="text-left py-2 px-2">Last Vacuum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {databaseStats.slice(0, 25).map((stat) => (
                      <tr key={stat.tablename} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium sticky left-0 bg-background">{stat.tablename}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.total_size_pretty}</td>
                        <td className="py-2 px-2 text-right">{stat.row_count.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.dead_rows > 0 ? <span className="text-orange-600">{stat.dead_rows.toLocaleString()}</span> : '0'}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.inserts.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.updates.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.deletes.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.sequential_scans.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.index_scans.toLocaleString()}</td>
                        <td className="py-2 px-2 text-left text-xs text-muted-foreground">
                          {stat.last_vacuum ? new Date(stat.last_vacuum).toLocaleDateString() : 
                           stat.last_autovacuum ? `Auto: ${new Date(stat.last_autovacuum).toLocaleDateString()}` : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Index Statistics Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                <LabelWithHelp 
                  label="Index Statistics" 
                  description="Statistik lengkap setiap indeks: ukuran, jumlah scan, dan performa cache. Membantu mengidentifikasi indeks yang tidak digunakan atau perlu dioptimasi"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 sticky left-0 bg-background">Table</th>
                      <th className="text-left py-2 px-2">Index</th>
                      <th className="text-right py-2 px-2">Size</th>
                      <th className="text-right py-2 px-2">Scans</th>
                      <th className="text-right py-2 px-2">Tuples Read</th>
                      <th className="text-right py-2 px-2">Tuples Fetched</th>
                      <th className="text-right py-2 px-2">Cache Hits</th>
                      <th className="text-right py-2 px-2">Cache Reads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexStats.slice(0, 30).map((stat, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium sticky left-0 bg-background">{stat.tablename}</td>
                        <td className="py-2 px-2 font-mono text-xs">{stat.indexname}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.index_size_pretty}</td>
                        <td className="py-2 px-2 text-right">{stat.index_scans.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.index_tup_reads.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.index_tup_fetches.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.idx_blks_hit.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{stat.idx_blks_read.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

      {/* Retention & GDPR modals moved to Admin Panel */}
    </div>
  );
}


