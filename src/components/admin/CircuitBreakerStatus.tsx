/**
 * Circuit Breaker Status Dashboard
 * 
 * Displays real-time circuit breaker status, metrics, and allows
 * manual controls (admin only).
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { databaseCircuitBreaker, CircuitState, CircuitBreakerConfig } from '@/lib/circuitBreaker';
import { defaultMetricsCollector, getMetricsStats } from '@/lib/metrics';
import { defaultRateLimiter } from '@/lib/rateLimiter';
import { defaultRequestQueue } from '@/lib/requestQueue';
import { defaultFallbackHandler } from '@/lib/fallbackHandler';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, CartesianGrid } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Zap, Shield, Database, HelpCircle, Edit, AlertCircle, BookOpen } from 'lucide-react';
import { useRBAC } from '@/contexts/RBACContext';
import PermissionGate from '@/components/rbac/PermissionGate';
import { supabase } from '@/lib/supabase';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

export default function CircuitBreakerStatus() {
  const [stats, setStats] = useState(databaseCircuitBreaker.getStats());
  const [metrics, setMetrics] = useState<any>(null);
  const [queueStats, setQueueStats] = useState(defaultRequestQueue.getStats());
  const [cacheStats, setCacheStats] = useState(defaultFallbackHandler.getStats());
  const [refreshKey, setRefreshKey] = useState(0);
  const { hasPermission } = useRBAC();
  
  // Modal states
  const [showResetModal, setShowResetModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showFlushModal, setShowFlushModal] = useState(false);
  const [showEditConfigModal, setShowEditConfigModal] = useState(false);
  const [showDocumentationModal, setShowDocumentationModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  
  // Config state
  const [config, setConfig] = useState<CircuitBreakerConfig>(databaseCircuitBreaker.getConfig());
  const [editConfig, setEditConfig] = useState<CircuitBreakerConfig>(databaseCircuitBreaker.getConfig());

  const isAdmin = hasPermission('access_rules.configure'); // Using same permission as permissions page

  useEffect(() => {
    // Update stats periodically
    const interval = setInterval(() => {
      setStats(databaseCircuitBreaker.getStats());
      setQueueStats(defaultRequestQueue.getStats());
      setCacheStats(defaultFallbackHandler.getStats());
      setConfig(databaseCircuitBreaker.getConfig());
    }, 1000);

    // Subscribe to circuit breaker events
    const listener = () => {
      setStats(databaseCircuitBreaker.getStats());
      setRefreshKey(k => k + 1);
    };

    databaseCircuitBreaker.on('stateChange', listener);
    databaseCircuitBreaker.on('failure', listener);
    databaseCircuitBreaker.on('success', listener);

    // Load metrics
    loadMetrics();

    return () => {
      clearInterval(interval);
      databaseCircuitBreaker.off(listener);
    };
  }, []);

  const loadMetrics = async () => {
    try {
      const stats = await getMetricsStats();
      setMetrics(stats);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const getStateColor = (state: CircuitState) => {
    switch (state) {
      case CircuitState.CLOSED:
        return 'bg-green-100 text-green-800 border-green-200';
      case CircuitState.OPEN:
        return 'bg-red-100 text-red-800 border-red-200';
      case CircuitState.HALF_OPEN:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStateIcon = (state: CircuitState) => {
    switch (state) {
      case CircuitState.CLOSED:
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case CircuitState.OPEN:
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case CircuitState.HALF_OPEN:
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  const handleReset = () => {
    setShowResetModal(true);
  };

  const confirmReset = () => {
    databaseCircuitBreaker.reset();
    setStats(databaseCircuitBreaker.getStats());
    setRefreshKey(k => k + 1);
    setShowResetModal(false);
    setModalMessage('✅ Circuit breaker berhasil direset!');
    setShowSuccessModal(true);
  };

  const handleOpen = () => {
    setShowOpenModal(true);
  };

  const confirmOpen = () => {
    databaseCircuitBreaker.open();
    setStats(databaseCircuitBreaker.getStats());
    setRefreshKey(k => k + 1);
    setShowOpenModal(false);
    setModalMessage('🚨 Circuit breaker telah dibuka! Semua request database akan diblokir.');
    setShowSuccessModal(true);
  };

  const handleFlushMetrics = () => {
    setShowFlushModal(true);
  };

  const confirmFlush = async () => {
    try {
      await defaultMetricsCollector.forceFlush();
      setShowFlushModal(false);
      setModalMessage('✅ Metrik berhasil dikirim ke database!');
      setShowSuccessModal(true);
    } catch (error) {
      setShowFlushModal(false);
      setModalMessage('❌ Gagal mengirim metrik: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setShowErrorModal(true);
    }
  };

  const handleEditConfig = () => {
    setEditConfig(databaseCircuitBreaker.getConfig());
    setShowEditConfigModal(true);
  };

  const confirmEditConfig = () => {
    databaseCircuitBreaker.updateConfig(editConfig);
    setConfig(databaseCircuitBreaker.getConfig());
    setShowEditConfigModal(false);
    setModalMessage('✅ Konfigurasi circuit breaker berhasil diperbarui!');
    setShowSuccessModal(true);
  };

  const successRate = stats.totalRequests > 0 
    ? ((stats.totalRequests - stats.failures) / stats.totalRequests * 100).toFixed(1)
    : '0';

  // Sample metrics data for charts (last 10 minutes)
  const timeSeriesData = Array.from({ length: 10 }, (_, i) => {
    const time = new Date(Date.now() - (9 - i) * 60000);
    return {
      time: time.toLocaleTimeString(),
      requests: Math.floor(Math.random() * 50) + 10, // Placeholder - would use real data
      failures: Math.floor(Math.random() * 5),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Circuit Breaker Status</h2>
          <p className="text-sm text-muted-foreground">Monitor database protection and performance</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadMetrics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Circuit Breaker Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <LabelWithHelp 
                label="Circuit State" 
                description="Status circuit breaker saat ini: CLOSED (normal, semua request diizinkan), OPEN (terhenti, memblokir semua request untuk melindungi database), atau HALF_OPEN (testing, mencoba menghubungkan kembali)"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md border ${getStateColor(stats.state)}`}>
              {getStateIcon(stats.state)}
              <span className="font-semibold">{stats.state}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Changed: {new Date(stats.stateChangedAt).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <LabelWithHelp 
                label="Success Rate" 
                description="Persentase request database yang berhasil dari total request. Indikator kesehatan sistem - semakin tinggi semakin baik. Nilai rendah menunjukkan masalah potensial dengan database atau koneksi"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{successRate}%</div>
            <div className="text-xs text-muted-foreground">
              {stats.totalRequests - stats.failures} / {stats.totalRequests} requests
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <LabelWithHelp 
                label="Total Requests" 
                description="Jumlah total request database yang telah diproses sejak circuit breaker diinisialisasi. Termasuk request yang berhasil dan gagal"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.totalRequests.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              {stats.failures} failures, {stats.successes} successes
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <LabelWithHelp 
                label="Last Activity" 
                description="Waktu terakhir request database berhasil atau gagal. Membantu mengidentifikasi kapan masalah terakhir terjadi atau kapan sistem terakhir berfungsi normal"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {stats.lastSuccessTime ? (
                <div>
                  <span className="text-green-600">Last Success:</span>
                  <div className="text-xs text-muted-foreground">
                    {new Date(stats.lastSuccessTime).toLocaleTimeString()}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="text-sm mt-2">
              {stats.lastFailureTime ? (
                <div>
                  <span className="text-red-600">Last Failure:</span>
                  <div className="text-xs text-muted-foreground">
                    {new Date(stats.lastFailureTime).toLocaleTimeString()}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue and Cache Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <LabelWithHelp 
                label="Request Queue" 
                description="Antrian request database yang menunggu untuk diproses. Membantu menangani beban tinggi dengan mengatur prioritas dan menghindari duplikasi request"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      Queue Length:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Jumlah total request dalam antrian, termasuk yang menunggu dan sedang diproses</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-semibold">{queueStats.queueLength}</span>
              </div>
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      Pending Requests:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Jumlah request yang menunggu untuk diproses, belum dieksekusi</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-semibold">{queueStats.pendingRequests}</span>
              </div>
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      Processing:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Status apakah queue sedang memproses request atau idle</p>
                  </TooltipContent>
                </Tooltip>
                <Badge variant={queueStats.processing ? 'default' : 'secondary'}>
                  {queueStats.processing ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <LabelWithHelp 
                label="Rate Limiter" 
                description="Sistem pembatas kecepatan request untuk mencegah penyalahgunaan database. Membatasi jumlah request per menit berdasarkan jenis operasi (baca, tulis, RPC)"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      Reads Limit:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Batas maksimal request baca data per menit (100 request/menit). Melindungi database dari query berlebihan</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-semibold">100/min</span>
              </div>
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      Writes Limit:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Batas maksimal request tulis data per menit (30 request/menit). Lebih ketat dari reads karena write lebih berisiko terhadap database</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-semibold">30/min</span>
              </div>
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      RPC Limit:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Batas maksimal panggilan fungsi database (RPC) per menit (20 request/menit). Fungsi database biasanya lebih berat dari query biasa</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-semibold">20/min</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              <LabelWithHelp 
                label="Cache" 
                description="Sistem penyimpanan sementara untuk hasil query database. Mengurangi beban database dengan menyimpan hasil yang sering digunakan dan meningkatkan kecepatan response"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      Cached Entries:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Jumlah hasil query yang saat ini tersimpan di cache. Semakin banyak semakin baik untuk performa, selama tidak melebihi batas maksimal</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-semibold">{cacheStats.size}</span>
              </div>
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      Max Size:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Batas maksimal jumlah entry yang bisa disimpan di cache. Setelah mencapai limit, entry lama akan dihapus (LRU policy)</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-semibold">{cacheStats.maxSize}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  defaultFallbackHandler.clear();
                  setCacheStats(defaultFallbackHandler.getStats());
                }}
              >
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Charts */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                <LabelWithHelp 
                  label="Operations by Type" 
                  description="Distribusi operasi database berdasarkan jenis (read, write, RPC, auth). Membantu memahami pola penggunaan database dan mengidentifikasi jenis operasi yang paling banyak digunakan"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(metrics.operationsByType || {}).map(([type, count]) => ({ type, count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill={COLORS[1]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                <LabelWithHelp 
                  label="Circuit Breaker States" 
                  description="Distribusi status circuit breaker saat operasi database dilakukan. Menunjukkan berapa banyak operasi yang terjadi pada setiap state (CLOSED, OPEN, HALF_OPEN)"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(metrics.circuitBreakerStates || {}).map(([state, count]) => ({ state, count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="state" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill={COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin Controls */}
      <PermissionGate permission="access_rules.configure">
        {/* Limit Configuration */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                <LabelWithHelp 
                  label="Limit Configuration" 
                  description="Konfigurasi threshold dan timeout untuk circuit breaker. Klik Edit untuk mengubah nilai-nilai ini"
                />
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleEditConfig}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Failure Threshold</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Buka circuit setelah {config.failureThreshold} kegagalan</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={config.failureThreshold} 
                  disabled 
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Buka circuit setelah {config.failureThreshold} kegagalan
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Reset Timeout (ms)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tunggu {(config.resetTimeout / 1000).toFixed(0)}s sebelum uji pemulihan</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={config.resetTimeout} 
                  disabled 
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Tunggu {(config.resetTimeout / 1000).toFixed(0)}s sebelum uji pemulihan
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Success Threshold</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tutup circuit setelah {config.successThreshold} sukses</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={config.successThreshold} 
                  disabled 
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Tutup circuit setelah {config.successThreshold} sukses
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Monitoring Period (ms)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jendela waktu: {(config.monitoringPeriod / 1000).toFixed(0)}s</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={config.monitoringPeriod} 
                  disabled 
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Jendela waktu: {(config.monitoringPeriod / 1000).toFixed(0)}s
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Request Timeout (ms)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Timeout request: {(config.timeout / 1000).toFixed(0)}s</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={config.timeout} 
                  disabled 
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Timeout request: {(config.timeout / 1000).toFixed(0)}s
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentation Section */}
        <Card className="mb-4 bg-blue-50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <BookOpen className="h-5 w-5" />
                  Dokumentasi Circuit Breaker
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Pelajari cara kerja circuit breaker dan apa yang harus dilakukan jika terjadi masalah
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDocumentationModal(true)}>
                <BookOpen className="h-4 w-4 mr-2" />
                Lihat Dokumentasi Circuit Breaker
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <LabelWithHelp 
                label="Danger Zone" 
                description="Tindakan berbahaya yang dapat mempengaruhi seluruh aplikasi. Gunakan dengan sangat hati-hati!"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={handleReset}>
                    Reset Circuit Breaker
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset semua statistik dan state circuit breaker ke kondisi awal. Menghapus riwayat kegagalan dan mengembalikan state ke CLOSED</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="destructive" onClick={handleOpen}>
                    Manually Open Circuit
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Paksa buka circuit breaker secara manual. Akan MEMBLOKIR SEMUA REQUEST DATABASE dan menyebabkan aplikasi berhenti berfungsi. Gunakan hanya dalam keadaan darurat!</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={handleFlushMetrics}>
                    Flush Metrics
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Kirim semua metrik yang tertunda ke database secara paksa. Tidak berbahaya, hanya memperbarui data metrik di Supabase</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs text-red-700 dark:text-red-300 font-semibold">
                ⚠️ <strong>PERINGATAN KRITIS:</strong> Tindakan di zona ini dapat menghentikan seluruh aplikasi dan memblokir semua operasi database. Gunakan dengan sangat hati-hati dan hanya jika benar-benar diperlukan!
              </p>
            </div>
          </CardContent>
        </Card>
      </PermissionGate>

      {/* Reset Confirmation Modal */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Reset Circuit Breaker
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mereset circuit breaker?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-sm text-orange-800 dark:text-orange-200">Tindakan ini akan:</p>
              <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
                <li>Menghapus semua statistik circuit breaker</li>
                <li>Mereset state ke CLOSED</li>
                <li>Menghapus riwayat kegagalan</li>
              </ul>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-3 font-semibold">
                ⚠️ Tindakan ini TIDAK DAPAT DIBATALKAN!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetModal(false)}>
              Batal
            </Button>
            <Button variant="default" onClick={confirmReset}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Circuit Confirmation Modal */}
      <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Buka Circuit Breaker Secara Manual
            </DialogTitle>
            <DialogDescription>
              PERINGATAN KRITIS: Tindakan ini sangat berbahaya!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-sm text-red-800 dark:text-red-200">Tindakan ini akan:</p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                <li><strong>MENGHENTIKAN SEMUA REQUEST DATABASE</strong></li>
                <li>Memblokir semua operasi aplikasi</li>
                <li>Menyebabkan error pada semua fitur yang membutuhkan database</li>
              </ul>
              <div className="mt-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold">
                  ⚠️ APLIKASI AKAN BERHENTI BERFUNGSI!
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Gunakan hanya dalam keadaan darurat atau untuk testing.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenModal(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmOpen}>
              Buka Circuit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flush Metrics Confirmation Modal */}
      <Dialog open={showFlushModal} onOpenChange={setShowFlushModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              Kirim Metrik ke Database
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mengirim semua metrik yang tertunda?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-sm text-blue-800 dark:text-blue-200">Tindakan ini akan:</p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Mengirim semua metrik yang tersimpan di memori ke Supabase</li>
                <li>Memperbarui tabel circuit_breaker_metrics</li>
                <li>Menghapus metrik dari antrian lokal</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFlushModal(false)}>
              Batal
            </Button>
            <Button variant="default" onClick={confirmFlush}>
              Kirim Metrik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Berhasil
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">{modalMessage}</p>
          </div>
          <DialogFooter>
            <Button variant="default" onClick={() => setShowSuccessModal(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documentation Modal */}
      <Dialog open={showDocumentationModal} onOpenChange={setShowDocumentationModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Dokumentasi Circuit Breaker
            </DialogTitle>
            <DialogDescription>
              Panduan lengkap tentang cara kerja circuit breaker dan langkah-langkah troubleshooting
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {/* What is Circuit Breaker */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Apa itu Circuit Breaker?
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                <p className="text-sm">
                  <strong>Circuit Breaker</strong> adalah mekanisme perlindungan yang mencegah kegagalan sistem database merambat ke seluruh aplikasi. 
                  Seperti sekring listrik, circuit breaker akan memutuskan koneksi sementara ketika mendeteksi terlalu banyak kegagalan, 
                  sehingga memberikan waktu untuk sistem pulih dan mencegah beban berlebih.
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Melindungi database dari beban berlebih dan kegagalan cascade</li>
                  <li>Mengurangi risiko aplikasi crash saat database bermasalah</li>
                  <li>Memberikan waktu recovery otomatis untuk sistem</li>
                  <li>Monitoring dan pelaporan metrik untuk analisis</li>
                </ul>
              </div>
            </div>

            {/* How It Works */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Bagaimana Circuit Breaker Bekerja?
              </h3>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-blue-800 dark:text-blue-200">Tiga Status Circuit Breaker:</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <strong className="text-green-700 dark:text-green-300">CLOSED (Tertutup)</strong>
                        <p className="text-muted-foreground">
                          Status normal. Semua request database diizinkan. Circuit breaker memantau setiap request dan menghitung kegagalan dalam jendela waktu tertentu.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <strong className="text-red-700 dark:text-red-300">OPEN (Terbuka)</strong>
                        <p className="text-muted-foreground">
                          Circuit breaker mendeteksi terlalu banyak kegagalan (≥ {config.failureThreshold} dalam {(config.monitoringPeriod / 1000).toFixed(0)} detik). 
                          Semua request database diblokir untuk melindungi sistem. Status ini akan bertahan selama {config.resetTimeout / 1000} detik sebelum mencoba uji pemulihan.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <strong className="text-yellow-700 dark:text-yellow-300">HALF_OPEN (Setengah Terbuka)</strong>
                        <p className="text-muted-foreground">
                          Fase uji pemulihan. Setelah {config.resetTimeout / 1000} detik di status OPEN, circuit breaker mengizinkan beberapa request terbatas untuk mengecek apakah sistem sudah pulih. 
                          Jika {config.successThreshold} request berhasil berturut-turut, kembali ke CLOSED. Jika gagal, kembali ke OPEN.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-purple-800 dark:text-purple-200">Alur Kerja:</h4>
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">1.</span>
                      <span>Request database masuk → Circuit breaker memeriksa status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">2.</span>
                      <span>Jika CLOSED → Request diizinkan dan dimonitor</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">3.</span>
                      <span>Jika terjadi kegagalan → Dihitung dalam jendela waktu {(config.monitoringPeriod / 1000).toFixed(0)} detik</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">4.</span>
                      <span>Jika ≥ {config.failureThreshold} kegagalan → Beralih ke OPEN (blokir semua request)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">5.</span>
                      <span>Tunggu {config.resetTimeout / 1000} detik → Beralih ke HALF_OPEN (uji pemulihan)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">6.</span>
                      <span>Jika {config.successThreshold} sukses → Kembali ke CLOSED. Jika gagal → Kembali ke OPEN</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What to Do When Circuit Opens */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Apa yang Harus Dilakukan Jika Circuit Breaker Terbuka (OPEN)?
              </h3>
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-3">
                <div className="space-y-2 text-sm">
                  <div>
                    <strong className="text-orange-800 dark:text-orange-200">1. Jangan Panik - Ini Tindakan Perlindungan Otomatis</strong>
                    <p className="text-muted-foreground mt-1">
                      Circuit breaker terbuka adalah mekanisme perlindungan yang bekerja secara otomatis. 
                      Aplikasi sengaja memblokir request untuk mencegah database crash.
                    </p>
                  </div>
                  <div>
                    <strong className="text-orange-800 dark:text-orange-200">2. Identifikasi Penyebab Masalah</strong>
                    <p className="text-muted-foreground mt-1">
                      Periksa kemungkinan penyebab:
                    </p>
                    <ul className="list-disc list-inside ml-4 text-muted-foreground mt-1">
                      <li>Database server sedang down atau overload</li>
                      <li>Koneksi network bermasalah</li>
                      <li>Query database terlalu lambat (timeout)</li>
                      <li>Terlalu banyak request bersamaan (rate limiting)</li>
                      <li>Masalah pada Supabase (jika menggunakan Supabase)</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-orange-800 dark:text-orange-200">3. Periksa Metrik dan Log</strong>
                    <p className="text-muted-foreground mt-1">
                      Lihat bagian "Metrics Charts" untuk memahami:
                    </p>
                    <ul className="list-disc list-inside ml-4 text-muted-foreground mt-1">
                      <li>Jenis operasi yang paling banyak gagal (read/write/RPC)</li>
                      <li>Error category yang dominan (network/timeout/database)</li>
                      <li>Response time rata-rata sebelum circuit terbuka</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-orange-800 dark:text-orange-200">4. Tunggu Pemulihan Otomatis</strong>
                    <p className="text-muted-foreground mt-1">
                      Circuit breaker akan otomatis mencoba uji pemulihan setelah {config.resetTimeout / 1000} detik. 
                      Jika sistem sudah pulih, akan kembali ke status CLOSED secara otomatis.
                    </p>
                  </div>
                  <div>
                    <strong className="text-orange-800 dark:text-orange-200">5. Tindakan Manual (Jika Diperlukan)</strong>
                    <p className="text-muted-foreground mt-1">
                      Jika masalah berlanjut setelah beberapa siklus recovery:
                    </p>
                    <ul className="list-disc list-inside ml-4 text-muted-foreground mt-1">
                      <li><strong>Reset Circuit Breaker:</strong> Hapus statistik dan mulai fresh (gunakan dengan hati-hati)</li>
                      <li><strong>Periksa Status Database:</strong> Pastikan database server berjalan normal</li>
                      <li><strong>Hubungi Tim DevOps/Database:</strong> Jika masalah bersifat infrastruktur</li>
                      <li><strong>Review Query Performance:</strong> Optimalkan query yang lambat</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Understanding Metrics */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Memahami Metrik Circuit Breaker
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3 text-sm">
                <div>
                  <strong>Success Rate:</strong>
                  <p className="text-muted-foreground mt-1">
                    Persentase request yang berhasil. Nilai rendah (&lt; 90%) menunjukkan masalah potensial dengan database atau koneksi.
                  </p>
                </div>
                <div>
                  <strong>Total Requests:</strong>
                  <p className="text-muted-foreground mt-1">
                    Jumlah total request sejak inisialisasi. Membantu memahami volume traffic aplikasi.
                  </p>
                </div>
                <div>
                  <strong>Operations by Type:</strong>
                  <p className="text-muted-foreground mt-1">
                    Distribusi operasi berdasarkan jenis (read/write/RPC/auth). Membantu mengidentifikasi jenis operasi yang paling bermasalah.
                  </p>
                </div>
                <div>
                  <strong>Circuit Breaker States:</strong>
                  <p className="text-muted-foreground mt-1">
                    Menunjukkan berapa banyak operasi yang terjadi pada setiap state. Banyak operasi di OPEN state = sistem sering bermasalah.
                  </p>
                </div>
              </div>
            </div>

            {/* Best Practices */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Best Practices
              </h3>
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2 text-sm">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Monitor metrik secara berkala untuk mendeteksi masalah sejak dini</li>
                  <li>Jangan terlalu sering melakukan reset manual kecuali benar-benar diperlukan</li>
                  <li>Jika circuit sering terbuka, pertimbangkan untuk optimasi query atau scaling database</li>
                  <li>Gunakan cache untuk mengurangi beban database pada query yang sering digunakan</li>
                  <li>Review dan sesuaikan threshold jika circuit breaker terlalu sensitif atau tidak sensitif</li>
                  <li>Dokumentasikan setiap insiden circuit breaker untuk analisis tren</li>
                </ul>
              </div>
            </div>

            {/* Configuration Reference */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Referensi Konfigurasi
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <strong>Failure Threshold:</strong> {config.failureThreshold}
                    <p className="text-xs text-muted-foreground">Buka circuit setelah kegagalan ini</p>
                  </div>
                  <div>
                    <strong>Reset Timeout:</strong> {config.resetTimeout / 1000}s
                    <p className="text-xs text-muted-foreground">Tunggu sebelum uji pemulihan</p>
                  </div>
                  <div>
                    <strong>Success Threshold:</strong> {config.successThreshold}
                    <p className="text-xs text-muted-foreground">Sukses untuk tutup circuit</p>
                  </div>
                  <div>
                    <strong>Monitoring Period:</strong> {config.monitoringPeriod / 1000}s
                    <p className="text-xs text-muted-foreground">Jendela waktu hitungan</p>
                  </div>
                  <div className="md:col-span-2">
                    <strong>Request Timeout:</strong> {config.timeout / 1000}s
                    <p className="text-xs text-muted-foreground">Timeout maksimal per request</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="default" onClick={() => setShowDocumentationModal(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Config Modal */}
      <Dialog open={showEditConfigModal} onOpenChange={setShowEditConfigModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-500" />
              Edit Circuit Breaker Configuration
            </DialogTitle>
            <DialogDescription>
              Ubah threshold dan timeout untuk circuit breaker. Perubahan akan langsung diterapkan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="failureThreshold">
                  Failure Threshold
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jumlah kegagalan yang diperlukan sebelum circuit breaker terbuka (min: 1, max: 100)</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="failureThreshold"
                  type="number"
                  min={1}
                  max={100}
                  value={editConfig.failureThreshold}
                  onChange={(e) => setEditConfig({ ...editConfig, failureThreshold: parseInt(e.target.value) || 5 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resetTimeout">
                  Reset Timeout (milliseconds)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Waktu tunggu sebelum mencoba pemulihan (transisi ke HALF_OPEN). Min: 5000ms, Max: 300000ms</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="resetTimeout"
                  type="number"
                  min={5000}
                  max={300000}
                  step={1000}
                  value={editConfig.resetTimeout}
                  onChange={(e) => setEditConfig({ ...editConfig, resetTimeout: parseInt(e.target.value) || 30000 })}
                />
                <p className="text-xs text-muted-foreground">
                  {(editConfig.resetTimeout / 1000).toFixed(0)} seconds
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="successThreshold">
                  Success Threshold
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jumlah sukses berturut-turut di HALF_OPEN untuk menutup circuit (min: 1, max: 10)</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="successThreshold"
                  type="number"
                  min={1}
                  max={10}
                  value={editConfig.successThreshold}
                  onChange={(e) => setEditConfig({ ...editConfig, successThreshold: parseInt(e.target.value) || 2 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monitoringPeriod">
                  Monitoring Period (milliseconds)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jendela waktu untuk menghitung kegagalan. Kegagalan di luar jendela ini tidak dihitung. Min: 1000ms, Max: 60000ms</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="monitoringPeriod"
                  type="number"
                  min={1000}
                  max={60000}
                  step={1000}
                  value={editConfig.monitoringPeriod}
                  onChange={(e) => setEditConfig({ ...editConfig, monitoringPeriod: parseInt(e.target.value) || 10000 })}
                />
                <p className="text-xs text-muted-foreground">
                  {(editConfig.monitoringPeriod / 1000).toFixed(0)} seconds
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="timeout">
                  Request Timeout (milliseconds)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Timeout maksimal untuk setiap request database. Request yang melebihi waktu ini akan dianggap gagal. Min: 1000ms, Max: 60000ms</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="timeout"
                  type="number"
                  min={1000}
                  max={60000}
                  step={1000}
                  value={editConfig.timeout}
                  onChange={(e) => setEditConfig({ ...editConfig, timeout: parseInt(e.target.value) || 10000 })}
                />
                <p className="text-xs text-muted-foreground">
                  {(editConfig.timeout / 1000).toFixed(0)} seconds
                </p>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Tips:</strong> Threshold yang terlalu rendah dapat membuat circuit breaker terlalu sensitif. Threshold yang terlalu tinggi dapat menunda respons terhadap masalah database. Gunakan nilai yang sesuai dengan karakteristik aplikasi Anda.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditConfigModal(false)}>
              Batal
            </Button>
            <Button variant="default" onClick={confirmEditConfig}>
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Error
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-red-600 dark:text-red-400">{modalMessage}</p>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => setShowErrorModal(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

