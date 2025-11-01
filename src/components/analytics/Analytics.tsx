import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, BarChart, Bar, Legend, LabelList, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { supabase, logAction, protectedSupabase } from "@/lib/supabase";
import { isDocumentHidden, onDocumentVisible } from "@/lib/utils";
import { HelpCircle, Database, Trash2, AlertTriangle, CheckCircle, Shield } from "lucide-react";
import CircuitBreakerStatus from "@/components/admin/CircuitBreakerStatus";
import PermissionGate from "@/components/rbac/PermissionGate";
import { useRBAC } from "@/contexts/RBACContext";

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
  
  // Data retention & GDPR state
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [editRetentionDays, setEditRetentionDays] = useState<number>(90);
  const [showGdprModal, setShowGdprModal] = useState(false);
  const [gdprContactId, setGdprContactId] = useState<string>("");
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [gdprLoading, setGdprLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

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

  // Fetch retention settings
  const fetchRetentionSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (membership?.org_id) {
        const { data: settings } = await protectedSupabase
          .from('org_settings')
          .select('retention_days')
          .eq('org_id', membership.org_id)
          .maybeSingle();
        
        setRetentionDays(settings?.retention_days ?? 90);
        setEditRetentionDays(settings?.retention_days ?? 90);
      }
    } catch (error) {
      console.error('Failed to fetch retention settings:', error);
    }
  };

  // Save retention settings
  const saveRetentionDays = async () => {
    try {
      setCleanupLoading(true);
      setErrorMessage("");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (!membership?.org_id) throw new Error('Organization not found');
      
      const { error } = await protectedSupabase
        .from('org_settings')
        .upsert({
          org_id: membership.org_id,
          retention_days: editRetentionDays,
        }, {
          onConflict: 'org_id'
        });
      
      if (error) throw error;
      
      setRetentionDays(editRetentionDays);
      setShowRetentionModal(false);
      setSuccessMessage(`Retention period updated to ${editRetentionDays} days`);
      setTimeout(() => setSuccessMessage(""), 5000);
      
      try { await logAction({ action: 'retention.update', resource: 'org_settings', context: { retention_days: editRetentionDays } }); } catch {}
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to update retention settings');
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setCleanupLoading(false);
    }
  };

  // Manual cleanup trigger
  const triggerCleanup = async () => {
    try {
      setCleanupLoading(true);
      setErrorMessage("");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (!membership?.org_id) throw new Error('Organization not found');
      
      const { data, error } = await protectedSupabase.rpc('cleanup_old_chat_data', {
        p_org_id: membership.org_id
      });
      
      if (error) throw error;
      
      setCleanupResult(data);
      setSuccessMessage(`Cleanup completed: ${data?.threads_deleted || 0} threads, ${data?.messages_deleted || 0} messages deleted`);
      setTimeout(() => setSuccessMessage(""), 8000);
      
      try { await logAction({ action: 'retention.cleanup', resource: 'chat_data', context: data }); } catch {}
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to run cleanup');
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setCleanupLoading(false);
    }
  };

  // GDPR deletion
  const executeGdprDeletion = async () => {
    if (!gdprContactId.trim()) {
      setErrorMessage('Please enter a contact ID');
      return;
    }
    
    try {
      setGdprLoading(true);
      setErrorMessage("");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (!membership?.org_id) throw new Error('Organization not found');
      
      const { data, error } = await protectedSupabase.rpc('gdpr_delete_user_data', {
        p_contact_id: gdprContactId.trim(),
        p_org_id: membership.org_id
      });
      
      if (error) throw error;
      
      setSuccessMessage(`GDPR deletion completed: ${data?.threads_deleted || 0} threads, ${data?.messages_deleted || 0} messages, ${data?.contact_deleted || 0} contacts deleted`);
      setShowGdprModal(false);
      setGdprContactId("");
      setTimeout(() => setSuccessMessage(""), 8000);
      
      try { await logAction({ action: 'gdpr.delete_request', resource: 'contact', resourceId: gdprContactId, context: data }); } catch {}
      
      // Refresh metrics
      fetchMetrics();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to execute GDPR deletion');
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setGdprLoading(false);
    }
  };

  // Single source of truth for fetching; avoids double calls on mount
  useEffect(() => {
    const run = () => {
      fetchMetrics();
      fetchDatabaseStats();
      if (hasPermission('access_rules.configure')) {
        fetchRetentionSettings();
      }
    };
    run();
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
          <TabsTrigger 
            value="circuit-breaker"
            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-muted/30"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span>Circuit Breaker</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat status dan metrik circuit breaker untuk perlindungan database</p>
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

          {/* Data Retention & GDPR Controls - Admin Only */}
          <PermissionGate permission="access_rules.configure">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data Retention Settings */}
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <Database className="h-5 w-5" />
                    <LabelWithHelp 
                      label="Data Retention Policy" 
                      description="Atur durasi penyimpanan data chat dan media. Data yang lebih tua dari periode retensi akan otomatis dihapus oleh job harian (setiap jam 2 pagi UTC). Default: 90 hari."
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Retention Period (days)</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={retentionDays ?? 90}
                        disabled
                        className="flex-1"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setEditRetentionDays(retentionDays ?? 90);
                          setShowRetentionModal(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Current: {retentionDays ?? 90} days. Chats older than this will be automatically deleted.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={triggerCleanup}
                    disabled={cleanupLoading}
                  >
                    {cleanupLoading ? 'Running Cleanup...' : 'Run Cleanup Now'}
                  </Button>
                  {cleanupResult && (
                    <div className="text-xs bg-muted p-2 rounded">
                      Last cleanup: {cleanupResult.threads_deleted} threads, {cleanupResult.messages_deleted} messages, {cleanupResult.contacts_deleted} contacts
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* GDPR Deletion */}
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                    <Shield className="h-5 w-5" />
                    <LabelWithHelp 
                      label="GDPR/PDPA Right to Erasure" 
                      description="Hapus semua data pengguna sesuai permintaan GDPR/PDPA. Ini akan menghapus semua thread, pesan, dan kontak untuk ID kontak yang ditentukan. Tindakan ini TIDAK DAPAT DIBATALKAN."
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Contact ID</Label>
                    <Input
                      type="text"
                      placeholder="Enter contact UUID"
                      value={gdprContactId}
                      onChange={(e) => setGdprContactId(e.target.value)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter the contact ID (UUID) gotten from contact detail to delete all associated data permanently.
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => setShowGdprModal(true)}
                    disabled={!gdprContactId.trim() || gdprLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete User Data
                  </Button>
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-2">
                    <p className="text-xs text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      <strong>Warning:</strong> This action permanently deletes all data and cannot be undone.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
              </div>
            )}
            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
              </div>
            )}
          </PermissionGate>
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

        <TabsContent value="circuit-breaker" className="space-y-6">
          <CircuitBreakerStatus />
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

      {/* Retention Settings Modal */}
      <Dialog open={showRetentionModal} onOpenChange={setShowRetentionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-500" />
              Configure Data Retention
            </DialogTitle>
            <DialogDescription>
              Set how many days to retain chat data. Data older than this period will be automatically deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="retention-days">Retention Period (days)</Label>
              <Input
                id="retention-days"
                type="number"
                min="1"
                max="365"
                value={editRetentionDays}
                onChange={(e) => setEditRetentionDays(parseInt(e.target.value) || 90)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Minimum: 1 day, Maximum: 365 days. Default: 90 days.
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <p className="text-xs text-orange-700 dark:text-orange-300">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Automatic cleanup runs daily at 2 AM UTC. You can also trigger manual cleanup from the main panel.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetentionModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveRetentionDays} disabled={cleanupLoading}>
              {cleanupLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GDPR Deletion Confirmation Modal */}
      <Dialog open={showGdprModal} onOpenChange={setShowGdprModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Confirm GDPR Data Deletion
            </DialogTitle>
            <DialogDescription>
              This action will permanently delete all data associated with contact ID: <code className="bg-muted px-1 rounded">{gdprContactId}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-sm text-red-800 dark:text-red-200">This will delete:</p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                <li>All threads/conversations</li>
                <li>All messages</li>
                <li>The contact record</li>
              </ul>
              <p className="text-xs text-red-600 dark:text-red-400 mt-3 font-semibold">
                ⚠️ This action CANNOT be undone!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGdprModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeGdprDeletion} disabled={gdprLoading}>
              {gdprLoading ? 'Deleting...' : 'Confirm Deletion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


