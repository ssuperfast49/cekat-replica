import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToCsv } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type LogRow = {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  context: any;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string | null;
};

export default function Logs() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [qUser, setQUser] = useState<string>('all');
  const [qAction, setQAction] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [userOptions, setUserOptions] = useState<{ id: string; email: string }[]>([]);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [userMap, setUserMap] = useState<Record<string, { email: string | null; display_name: string | null }>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<LogRow | null>(null);

  const range = useMemo(() => ({ from: from ? new Date(from).toISOString() : null, to: to ? new Date(to).toISOString() : null }), [from, to]);

  const fetchFilters = async () => {
    // distinct users
    const { data: users } = await supabase
      .from('audit_logs')
      .select('user_id')
      .not('user_id', 'is', null)
      .limit(1000);
    const uniqueUserIds = Array.from(new Set((users || []).map(u => u.user_id as string)));
    if (uniqueUserIds.length > 0) {
      const { data: vusers } = await supabase
        .from('v_users')
        .select('id,email,display_name')
        .in('id', uniqueUserIds);
      const options = (vusers || []).map((u: any) => ({ id: u.id, email: u.email }));
      setUserOptions(options);
      const nextMap: Record<string, { email: string | null; display_name: string | null }> = {};
      for (const vu of (vusers || [])) nextMap[vu.id] = { email: vu.email, display_name: vu.display_name };
      setUserMap(prev => ({ ...prev, ...nextMap }));
    } else {
      setUserOptions([]);
    }

    const { data: actions } = await supabase
      .from('audit_logs')
      .select('action')
      .limit(1000);
    setActionOptions(Array.from(new Set((actions || []).map(a => a.action))));
  };

  const fetchPage = async () => {
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (qUser !== 'all') query = query.eq('user_id', qUser);
    if (qAction !== 'all') query = query.eq('action', qAction);
    if (range.from) query = query.gte('created_at', range.from);
    if (range.to) query = query.lte('created_at', range.to);

    const { data, error, count } = await query.range(fromIdx, toIdx);
    if (!error) {
      const list = (data || []) as LogRow[];
      setRows(list);
      setTotal(count || 0);

      // Fetch missing user details for display
      const ids = Array.from(new Set(list.map(r => r.user_id).filter(Boolean) as string[]));
      const missing = ids.filter(id => !userMap[id]);
      if (missing.length > 0) {
        const { data: vusers } = await supabase
          .from('v_users')
          .select('id,email,display_name')
          .in('id', missing);
        const nextMap: Record<string, { email: string | null; display_name: string | null }> = {};
        for (const vu of (vusers || [])) nextMap[vu.id] = { email: vu.email, display_name: vu.display_name };
        if (Object.keys(nextMap).length) setUserMap(prev => ({ ...prev, ...nextMap }));
      }
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchPage();
  }, [page, pageSize, qUser, qAction, range.from, range.to]);

  useEffect(() => {
    // realtime updates
    const channel = supabase
      .channel('realtime:logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        const row = payload.new as LogRow;
        setRows((prev) => [row, ...prev].slice(0, pageSize));
        const id = row.user_id;
        if (id && !userMap[id]) {
          supabase.from('v_users').select('id,email,display_name').eq('id', id).maybeSingle().then(({ data }) => {
            if (data) setUserMap(prev => ({ ...prev, [data.id]: { email: data.email, display_name: data.display_name } }));
          });
        }
        setTotal((t) => t + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Logs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">User</label>
            <Select value={qUser} onValueChange={setQUser}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {userOptions.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Action</label>
            <Select value={qAction} onValueChange={setQAction}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {actionOptions.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="h-9" />
          </div>
          <div className="flex items-end gap-2">
            <Select value={String(pageSize)} onValueChange={(v)=>setPageSize(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Page size" /></SelectTrigger>
              <SelectContent>
                {[10,20,50,100].map(n => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={()=>exportToCsv(`logs_${new Date().toISOString()}.csv`, rows)}>Export CSV</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Resource ID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {r.user_id ? (
                        userMap[r.user_id]?.display_name || userMap[r.user_id]?.email || r.user_id
                      ) : '—'}
                    </TableCell>
                    <TableCell>{r.action}</TableCell>
                    <TableCell>{r.resource}</TableCell>
                    <TableCell>{r.resource_id || '—'}</TableCell>
                    <TableCell>{r.ip || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSelected(r); setDetailsOpen(true); }}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))}>Prev</Button>
              <Button variant="outline" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages, p+1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
            <DialogDescription>
              {selected ? new Date(selected.created_at).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">User</div>
                  <div>
                    {selected.user_id
                      ? (userMap[selected.user_id]?.display_name || userMap[selected.user_id]?.email || selected.user_id)
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Action</div>
                  <div>{selected.action}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Resource</div>
                  <div>{selected.resource}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Resource ID</div>
                  <div>{selected.resource_id || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">IP</div>
                  <div>{selected.ip || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">User Agent</div>
                  <div className="truncate" title={selected.user_agent || undefined}>{selected.user_agent || '—'}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Context</div>
                <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
{JSON.stringify(selected.context ?? {}, null, 2)}
                </pre>
              </div>
          </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


