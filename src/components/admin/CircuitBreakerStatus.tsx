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
import { defaultAdaptiveRateLimiter, AdaptiveConfig } from '@/lib/adaptiveRateLimiter';
import type { OperationType } from '@/lib/rateLimiter';
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
  const [showEditAdaptiveConfigModal, setShowEditAdaptiveConfigModal] = useState(false);
  const [showDocumentationModal, setShowDocumentationModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  
  // Config state
  const [config, setConfig] = useState<CircuitBreakerConfig>(databaseCircuitBreaker.getConfig());
  const [editConfig, setEditConfig] = useState<CircuitBreakerConfig>(databaseCircuitBreaker.getConfig());
  const [adaptiveConfig, setAdaptiveConfig] = useState<AdaptiveConfig>(defaultAdaptiveRateLimiter.getConfig());
  const [editAdaptiveConfig, setEditAdaptiveConfig] = useState<AdaptiveConfig>(defaultAdaptiveRateLimiter.getConfig());
  const [adaptiveMultipliers, setAdaptiveMultipliers] = useState<Record<OperationType, number>>({
    read: defaultAdaptiveRateLimiter.getMultiplier('read'),
    write: defaultAdaptiveRateLimiter.getMultiplier('write'),
    rpc: defaultAdaptiveRateLimiter.getMultiplier('rpc'),
    auth: defaultAdaptiveRateLimiter.getMultiplier('auth'),
  });

  const isAdmin = hasPermission('admin_panel.update'); // Admins can update panel settings

  useEffect(() => {
    // Update stats periodically
    const interval = setInterval(() => {
      setStats(databaseCircuitBreaker.getStats());
      setQueueStats(defaultRequestQueue.getStats());
      setCacheStats(defaultFallbackHandler.getStats());
      setConfig(databaseCircuitBreaker.getConfig());
      setAdaptiveConfig(defaultAdaptiveRateLimiter.getConfig());
      setAdaptiveMultipliers({
        read: defaultAdaptiveRateLimiter.getMultiplier('read'),
        write: defaultAdaptiveRateLimiter.getMultiplier('write'),
        rpc: defaultAdaptiveRateLimiter.getMultiplier('rpc'),
        auth: defaultAdaptiveRateLimiter.getMultiplier('auth'),
      });
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

  const handleEditAdaptiveConfig = () => {
    setEditAdaptiveConfig(defaultAdaptiveRateLimiter.getConfig());
    setShowEditAdaptiveConfigModal(true);
  };

  const confirmEditAdaptiveConfig = () => {
    defaultAdaptiveRateLimiter.updateConfig(editAdaptiveConfig);
    setAdaptiveConfig(defaultAdaptiveRateLimiter.getConfig());
    setAdaptiveMultipliers({
      read: defaultAdaptiveRateLimiter.getMultiplier('read'),
      write: defaultAdaptiveRateLimiter.getMultiplier('write'),
      rpc: defaultAdaptiveRateLimiter.getMultiplier('rpc'),
      auth: defaultAdaptiveRateLimiter.getMultiplier('auth'),
    });
    setShowEditAdaptiveConfigModal(false);
    setModalMessage('✅ Konfigurasi adaptive rate limiter berhasil diperbarui!');
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
                label="Rate Limiter (Adaptive)" 
                description="Sistem pembatas kecepatan request adaptif yang secara otomatis menyesuaikan limit berdasarkan kondisi sistem. Melindungi database dari traffic spike dan overload"
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
                    <p>Batas maksimal request baca data per menit (dinamis: {defaultAdaptiveRateLimiter.getEffectiveLimit('read')} request/menit, {(adaptiveMultipliers.read * 100).toFixed(0)}% dari base {adaptiveConfig.baseConfig.read.limit}). Limit menyesuaikan otomatis berdasarkan kondisi sistem</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-right">
                  <span className="font-semibold">{defaultAdaptiveRateLimiter.getEffectiveLimit('read')}/min</span>
                  <span className="text-xs text-muted-foreground ml-1">({(adaptiveMultipliers.read * 100).toFixed(0)}%)</span>
                </div>
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
                    <p>Batas maksimal request tulis data per menit (dinamis: {defaultAdaptiveRateLimiter.getEffectiveLimit('write')} request/menit, {(adaptiveMultipliers.write * 100).toFixed(0)}% dari base {adaptiveConfig.baseConfig.write.limit}). Lebih ketat dari reads karena write lebih berisiko terhadap database</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-right">
                  <span className="font-semibold">{defaultAdaptiveRateLimiter.getEffectiveLimit('write')}/min</span>
                  <span className="text-xs text-muted-foreground ml-1">({(adaptiveMultipliers.write * 100).toFixed(0)}%)</span>
                </div>
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
                    <p>Batas maksimal panggilan fungsi database (RPC) per menit (dinamis: {defaultAdaptiveRateLimiter.getEffectiveLimit('rpc')} request/menit, {(adaptiveMultipliers.rpc * 100).toFixed(0)}% dari base {adaptiveConfig.baseConfig.rpc.limit}). Fungsi database biasanya lebih berat dari query biasa</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-right">
                  <span className="font-semibold">{defaultAdaptiveRateLimiter.getEffectiveLimit('rpc')}/min</span>
                  <span className="text-xs text-muted-foreground ml-1">({(adaptiveMultipliers.rpc * 100).toFixed(0)}%)</span>
                </div>
              </div>
              <div className="flex justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex items-center gap-1">
                      Auth Limit:
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Batas maksimal operasi autentikasi per menit (dinamis: {defaultAdaptiveRateLimiter.getEffectiveLimit('auth')} request/menit, {(adaptiveMultipliers.auth * 100).toFixed(0)}% dari base {adaptiveConfig.baseConfig.auth.limit})</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-right">
                  <span className="font-semibold">{defaultAdaptiveRateLimiter.getEffectiveLimit('auth')}/min</span>
                  <span className="text-xs text-muted-foreground ml-1">({(adaptiveMultipliers.auth * 100).toFixed(0)}%)</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              <p>💡 Limit berubah otomatis berdasarkan response time dan error rate sistem</p>
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
      <PermissionGate permission="admin_panel.update">
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

        {/* Adaptive Rate Limiter Configuration */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                <LabelWithHelp 
                  label="Adaptive Rate Limiter Configuration" 
                  description="Konfigurasi untuk adaptive rate limiter yang secara otomatis menyesuaikan limit berdasarkan kondisi sistem. Menangani traffic spike dengan lebih baik"
                />
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleEditAdaptiveConfig}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Reads Base Limit</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Limit dasar untuk operasi read. Limit aktual akan disesuaikan secara otomatis berdasarkan kondisi sistem</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={adaptiveConfig.baseConfig.read.limit} 
                  disabled 
                  className="font-mono"
                />
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Effective:</span>
                  <span className="font-semibold">{defaultAdaptiveRateLimiter.getEffectiveLimit('read')}/min</span>
                  <span className="text-green-600">({(adaptiveMultipliers.read * 100).toFixed(0)}%)</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Writes Base Limit</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Limit dasar untuk operasi write. Limit aktual akan disesuaikan secara otomatis berdasarkan kondisi sistem</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={adaptiveConfig.baseConfig.write.limit} 
                  disabled 
                  className="font-mono"
                />
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Effective:</span>
                  <span className="font-semibold">{defaultAdaptiveRateLimiter.getEffectiveLimit('write')}/min</span>
                  <span className="text-green-600">({(adaptiveMultipliers.write * 100).toFixed(0)}%)</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">RPC Base Limit</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Limit dasar untuk operasi RPC. Limit aktual akan disesuaikan secara otomatis berdasarkan kondisi sistem</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={adaptiveConfig.baseConfig.rpc.limit} 
                  disabled 
                  className="font-mono"
                />
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Effective:</span>
                  <span className="font-semibold">{defaultAdaptiveRateLimiter.getEffectiveLimit('rpc')}/min</span>
                  <span className="text-green-600">({(adaptiveMultipliers.rpc * 100).toFixed(0)}%)</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Auth Base Limit</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Limit dasar untuk operasi autentikasi. Limit aktual akan disesuaikan secara otomatis berdasarkan kondisi sistem</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={adaptiveConfig.baseConfig.auth.limit} 
                  disabled 
                  className="font-mono"
                />
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Effective:</span>
                  <span className="font-semibold">{defaultAdaptiveRateLimiter.getEffectiveLimit('auth')}/min</span>
                  <span className="text-green-600">({(adaptiveMultipliers.auth * 100).toFixed(0)}%)</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Min Multiplier</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Multiplier minimum (misal: 0.5 = 50% dari base limit). Digunakan saat sistem dalam kondisi stres</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={adaptiveConfig.minMultiplier} 
                  disabled 
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum: {(adaptiveConfig.minMultiplier * 100).toFixed(0)}% dari base
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Max Multiplier</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Multiplier maksimum (misal: 2.0 = 200% dari base limit). Digunakan saat sistem dalam kondisi sehat</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={adaptiveConfig.maxMultiplier} 
                  disabled 
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum: {(adaptiveConfig.maxMultiplier * 100).toFixed(0)}% dari base
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Adjustment Interval (ms)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Frekuensi pengecekan dan penyesuaian limit (dalam milliseconds)</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input 
                  value={adaptiveConfig.adjustmentInterval} 
                  disabled 
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Setiap {(adaptiveConfig.adjustmentInterval / 1000).toFixed(0)} detik
                </p>
              </div>
            </div>
            <div className="mt-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-700 dark:text-green-300">
                ✅ <strong>Status:</strong> Adaptive rate limiter aktif dan melindungi database. Limit akan otomatis menyesuaikan berdasarkan metrik sistem (response time, error rate).
              </p>
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

            {/* Circuit Breaker Configuration Explanation */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Penjelasan Detail Setiap Input Circuit Breaker
              </h3>
              <div className="space-y-4">
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="text-sm space-y-4 text-muted-foreground">
                    {/* Failure Threshold */}
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300 text-base">1. Failure Threshold (Ambang Kegagalan)</strong>
                      <p className="mt-1 mb-2">Jumlah maksimal kegagalan yang dapat terjadi dalam jendela waktu monitoring sebelum circuit breaker terbuka (OPEN).</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <div>
                          <strong className="text-sm">Failure Threshold: {config.failureThreshold}</strong>
                          <p className="text-xs mt-1">
                            <br />• Default: 5 kegagalan (range: 1 - 100)
                            <br />• Sistem akan menghitung jumlah kegagalan dalam jendela waktu {(config.monitoringPeriod / 1000).toFixed(0)} detik
                            <br />• Jika mencapai {config.failureThreshold} kegagalan atau lebih → Circuit breaker akan <strong>OPEN</strong> (blokir semua request)
                            <br />• <strong>Mengapa penting?</strong> Mencegah kegagalan cascade dengan memblokir request sebelum sistem benar-benar crash
                            <br />• <strong>Tips:</strong>
                            <br />&nbsp;&nbsp;- Nilai terlalu rendah (1-3): Circuit breaker terlalu sensitif, sering terbuka karena error sementara
                            <br />&nbsp;&nbsp;- Nilai terlalu tinggi (20+): Circuit breaker kurang responsif, database bisa overload sebelum terbuka
                            <br />&nbsp;&nbsp;- Rekomendasi: 5-10 untuk aplikasi production, 3-5 untuk aplikasi kritis
                            <br />• <strong>Contoh:</strong> Jika threshold = {config.failureThreshold}, dan terjadi {config.failureThreshold} timeout/error dalam {(config.monitoringPeriod / 1000).toFixed(0)} detik terakhir → Circuit OPEN
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Reset Timeout */}
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300 text-base">2. Reset Timeout (Waktu Tunggu Reset)</strong>
                      <p className="mt-1 mb-2">Waktu yang harus ditunggu setelah circuit breaker OPEN sebelum mencoba uji pemulihan (transisi ke HALF_OPEN).</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <div>
                          <strong className="text-sm">Reset Timeout: {(config.resetTimeout / 1000).toFixed(0)} detik ({config.resetTimeout}ms)</strong>
                          <p className="text-xs mt-1">
                            <br />• Default: 30 detik (30000ms, range: 5s - 600s)
                            <br />• Setelah circuit OPEN, sistem akan menunggu {config.resetTimeout / 1000} detik sebelum mencoba uji pemulihan
                            <br />• Setelah timeout, circuit breaker akan transisi ke <strong>HALF_OPEN</strong> (mengizinkan beberapa request terbatas untuk testing)
                            <br />• <strong>Mengapa penting?</strong> Memberi waktu database untuk recovery sebelum mengizinkan request lagi
                            <br />• <strong>Tips:</strong>
                            <br />&nbsp;&nbsp;- Nilai terlalu pendek (5-10s): Tidak cukup waktu untuk recovery, circuit langsung terbuka lagi
                            <br />&nbsp;&nbsp;- Nilai terlalu panjang (300s+): Aplikasi terlalu lama tidak bisa digunakan
                            <br />&nbsp;&nbsp;- Rekomendasi: 30-60 detik untuk masalah network sementara, 60-120 detik untuk masalah database serius
                            <br />• <strong>Contoh:</strong> Circuit OPEN → Tunggu {config.resetTimeout / 1000} detik → Uji dengan {config.successThreshold} request terbatas → Jika semua sukses, kembali CLOSED
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Success Threshold */}
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300 text-base">3. Success Threshold (Ambang Keberhasilan)</strong>
                      <p className="mt-1 mb-2">Jumlah minimal request yang harus berhasil berturut-turut dalam fase HALF_OPEN sebelum circuit breaker kembali CLOSED.</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <div>
                          <strong className="text-sm">Success Threshold: {config.successThreshold}</strong>
                          <p className="text-xs mt-1">
                            <br />• Default: 2 sukses berturut-turut (range: 1 - 10)
                            <br />• Setelah circuit HALF_OPEN (uji pemulihan), sistem akan mengizinkan beberapa request terbatas
                            <br />• Jika {config.successThreshold} request berhasil berturut-turut → Circuit breaker akan <strong>CLOSED</strong> (kembali normal)
                            <br />• Jika ada 1 request gagal → Circuit breaker kembali <strong>OPEN</strong> (tunggu reset timeout lagi)
                            <br />• <strong>Mengapa penting?</strong> Memastikan sistem benar-benar pulih sebelum mengizinkan semua request
                            <br />• <strong>Tips:</strong>
                            <br />&nbsp;&nbsp;- Nilai terlalu rendah (1): Terlalu mudah kembali CLOSED, bisa langsung OPEN lagi
                            <br />&nbsp;&nbsp;- Nilai terlalu tinggi (5+): Terlalu lama di HALF_OPEN, memperlambat recovery
                            <br />&nbsp;&nbsp;- Rekomendasi: 2-3 untuk aplikasi production
                            <br />• <strong>Contoh:</strong> Circuit HALF_OPEN → Request 1 sukses → Request 2 sukses ({config.successThreshold} tercapai) → Circuit CLOSED
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Monitoring Period */}
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300 text-base">4. Monitoring Period (Jendela Waktu Monitoring)</strong>
                      <p className="mt-1 mb-2">Jendela waktu (sliding window) untuk menghitung jumlah kegagalan. Hanya kegagalan dalam jendela waktu ini yang dihitung untuk menentukan apakah circuit harus terbuka.</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <div>
                          <strong className="text-sm">Monitoring Period: {(config.monitoringPeriod / 1000).toFixed(0)} detik ({config.monitoringPeriod}ms)</strong>
                          <p className="text-xs mt-1">
                            <br />• Default: 10 detik (10000ms, range: 5s - 300s)
                            <br />• Sistem hanya menghitung kegagalan yang terjadi dalam {(config.monitoringPeriod / 1000).toFixed(0)} detik terakhir
                            <br />• Kegagalan yang lebih lama dari {(config.monitoringPeriod / 1000).toFixed(0)} detik tidak dihitung (expired)
                            <br />• <strong>Mengapa penting?</strong> Mencegah kegagalan lama mempengaruhi keputusan saat ini, fokus pada kondisi terbaru
                            <br />• <strong>Tips:</strong>
                            <br />&nbsp;&nbsp;- Nilai terlalu pendek (5s): Terlalu fokus pada kondisi saat ini, tidak melihat tren
                            <br />&nbsp;&nbsp;- Nilai terlalu panjang (60s+): Kegagalan lama masih mempengaruhi, recovery lebih lambat
                            <br />&nbsp;&nbsp;- Rekomendasi: 10-30 detik untuk balance antara responsivitas dan stabilitas
                            <br />• <strong>Contoh:</strong> Jika monitoring period = {(config.monitoringPeriod / 1000).toFixed(0)}s, dan terjadi {config.failureThreshold} kegagalan dalam {(config.monitoringPeriod / 1000).toFixed(0)} detik terakhir → Circuit OPEN. Kegagalan yang lebih dari {(config.monitoringPeriod / 1000).toFixed(0)} detik tidak dihitung.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Request Timeout */}
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300 text-base">5. Request Timeout (Waktu Maksimal Request)</strong>
                      <p className="mt-1 mb-2">Waktu maksimal yang diizinkan untuk setiap request database. Request yang melebihi timeout ini akan dianggap gagal dan dibatalkan.</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <div>
                          <strong className="text-sm">Request Timeout: {(config.timeout / 1000).toFixed(0)} detik ({config.timeout}ms)</strong>
                          <p className="text-xs mt-1">
                            <br />• Default: 10 detik (10000ms, range: 1s - 60s)
                            <br />• Setiap request database akan dibatalkan jika melebihi {(config.timeout / 1000).toFixed(0)} detik dan dianggap gagal
                            <br />• Timeout ini diterapkan sebelum request mencapai database (client-side timeout)
                            <br />• <strong>Mengapa penting?</strong> Mencegah request yang hang/tidak merespons menumpuk dan membebani sistem
                            <br />• <strong>Tips:</strong>
                            <br />&nbsp;&nbsp;- Nilai terlalu pendek (1-3s): Request normal bisa dianggap gagal, false positive tinggi
                            <br />&nbsp;&nbsp;- Nilai terlalu panjang (30s+): Request hang akan menunggu terlalu lama, resource terbuang
                            <br />&nbsp;&nbsp;- Rekomendasi: 
                            <br />&nbsp;&nbsp;&nbsp;&nbsp;• Read queries: 5-10 detik
                            <br />&nbsp;&nbsp;&nbsp;&nbsp;• Write queries: 10-15 detik
                            <br />&nbsp;&nbsp;&nbsp;&nbsp;• RPC/complex queries: 15-30 detik
                            <br />• <strong>Contoh:</strong> Request dimulai → Jika belum selesai dalam {(config.timeout / 1000).toFixed(0)} detik → Request dibatalkan → Dianggap gagal → Dihitung untuk failure threshold
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* How They Work Together */}
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300 text-base">6. Cara Kerja Bersama-Sama</strong>
                      <p className="mt-1 mb-2">Semua parameter ini bekerja bersama untuk melindungi database dengan cara yang terkoordinasi.</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <div className="text-xs space-y-2">
                          <div>
                            <strong>Alur Lengkap:</strong>
                            <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                              <li>Request masuk → Sistem cek <strong>Request Timeout</strong> (max {(config.timeout / 1000).toFixed(0)}s)</li>
                              <li>Request dieksekusi → Jika melebihi timeout → Dianggap gagal</li>
                              <li>Kegagalan dicatat dalam <strong>Monitoring Period</strong> ({(config.monitoringPeriod / 1000).toFixed(0)}s terakhir)</li>
                              <li>Sistem hitung total kegagalan dalam jendela waktu</li>
                              <li>Jika mencapai <strong>Failure Threshold</strong> ({config.failureThreshold} kegagalan) → Circuit OPEN</li>
                              <li>Tunggu <strong>Reset Timeout</strong> ({(config.resetTimeout / 1000).toFixed(0)}s) → Transisi ke HALF_OPEN</li>
                              <li>Uji dengan beberapa request → Jika <strong>Success Threshold</strong> ({config.successThreshold} sukses) tercapai → CLOSED</li>
                              <li>Jika gagal dalam HALF_OPEN → Kembali OPEN, tunggu reset timeout lagi</li>
                            </ol>
                          </div>
                          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2 mt-2">
                            <p className="text-green-700 dark:text-green-300">
                              <strong>✅ Contoh Skenario:</strong>
                              <br />1. 5 request gagal (timeout) dalam 10 detik → Threshold tercapai ({config.failureThreshold})
                              <br />2. Circuit OPEN → Semua request diblokir
                              <br />3. Tunggu {config.resetTimeout / 1000} detik → Database punya waktu recovery
                              <br />4. Circuit HALF_OPEN → Uji dengan 2 request
                              <br />5. Kedua request sukses ({config.successThreshold}) → Circuit CLOSED → Kembali normal
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                      <li>Terlalu banyak request bersamaan (adaptive rate limiter sedang mengurangi limit)</li>
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

            {/* Adaptive Rate Limiter */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600" />
                Adaptive Rate Limiter: Menangani Traffic Spike
              </h3>
              <div className="space-y-4">
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-purple-800 dark:text-purple-200">Apa itu Adaptive Rate Limiter?</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong>Adaptive Rate Limiter</strong> adalah sistem pembatas kecepatan yang secara otomatis menyesuaikan limit berdasarkan kondisi sistem database. 
                    Berbeda dengan rate limiter statis yang memiliki limit tetap, adaptive rate limiter akan:
                  </p>
                  <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>Meningkatkan limit</strong> saat sistem dalam kondisi sehat (response time rendah, error rate rendah)</li>
                    <li><strong>Menurunkan limit</strong> saat sistem dalam kondisi stres (response time tinggi, error rate tinggi)</li>
                    <li><strong>Melindungi database</strong> dari traffic spike dan overload dengan penyesuaian otomatis</li>
                    <li><strong>Mengurangi false positives</strong> dengan memberikan waktu recovery sebelum circuit breaker terbuka</li>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-green-800 dark:text-green-200">Bagaimana Menangani Traffic Spike?</h4>
                  <div className="text-sm space-y-3">
                    <div>
                      <strong className="text-green-700 dark:text-green-300">1. Deteksi Traffic Spike</strong>
                      <p className="text-muted-foreground mt-1">
                        Saat traffic spike terjadi, database mulai lambat (response time meningkat) atau terjadi error rate tinggi. 
                        Adaptive rate limiter memantau metrik ini setiap {adaptiveConfig.adjustmentInterval / 1000} detik dari tabel <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">circuit_breaker_metrics</code> di Supabase.
                      </p>
                    </div>
                    <div>
                      <strong className="text-green-700 dark:text-green-300">2. Penyesuaian Otomatis</strong>
                      <div className="mt-2 space-y-2">
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <strong className="text-xs">Sistem Sehat (Response Time &lt; {adaptiveConfig.healthyLatencyThreshold}ms, Error &lt; 5%):</strong>
                          <p className="text-xs text-muted-foreground mt-1">
                            → Limit meningkat hingga {(adaptiveConfig.maxMultiplier * 100).toFixed(0)}% dari base limit
                            <br />
                            → Contoh: Reads base {adaptiveConfig.baseConfig.read.limit}/min dapat naik hingga {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.maxMultiplier)}/min
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <strong className="text-xs">Sistem Stres (Response Time &gt; {adaptiveConfig.stressLatencyThreshold}ms atau Error &gt; 20%):</strong>
                          <p className="text-xs text-muted-foreground mt-1">
                            → Limit menurun hingga {(adaptiveConfig.minMultiplier * 100).toFixed(0)}% dari base limit
                            <br />
                            → Contoh: Reads base {adaptiveConfig.baseConfig.read.limit}/min dapat turun hingga {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.minMultiplier)}/min
                            <br />
                            → Memberi waktu recovery untuk database tanpa langsung memicu circuit breaker OPEN
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <strong className="text-green-700 dark:text-green-300">3. Skenario Traffic Spike</strong>
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">A.</span>
                          <div>
                            <strong>Spike Normal (Dapat Dihandle):</strong>
                            <p className="text-muted-foreground mt-1">
                              Request melonjak → Rate limiter dengan limit adaptif menangani sebagian request → 
                              Jika masih dalam batas, semua diizinkan → Jika melebihi, request diblokir dengan HTTP 429
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">B.</span>
                          <div>
                            <strong>Spike Besar (Database Mulai Lambat):</strong>
                            <p className="text-muted-foreground mt-1">
                              Response time naik di atas {adaptiveConfig.stressLatencyThreshold}ms → 
                              Adaptive limiter turunkan limit secara bertahap → 
                              Memberi waktu database pulih → Mencegah circuit breaker langsung OPEN
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">C.</span>
                          <div>
                            <strong>DDoS/Attack:</strong>
                            <p className="text-muted-foreground mt-1">
                              Ribuan request masuk → Adaptive limiter turunkan limit drastis (hingga {(adaptiveConfig.minMultiplier * 100).toFixed(0)}%) → 
                              Sebagian besar request diblokir → Database terlindungi → Circuit breaker OPEN sebagai last resort jika masih gagal
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DDoS and Traffic Spike Protection Guide */}
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3 text-red-800 dark:text-red-200">🛡️ Input Konfigurasi untuk Traffic Spike & DDoS Protection</h4>
                  <div className="text-sm space-y-3 text-muted-foreground">
                    <div>
                      <strong className="text-red-700 dark:text-red-300 text-base">Input Utama untuk Perlindungan:</strong>
                      <div className="mt-2 space-y-3">
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border-l-4 border-red-500">
                          <strong className="text-sm text-red-700 dark:text-red-300">1. Min Multiplier (PALING PENTING untuk DDoS)</strong>
                          <p className="text-xs mt-1">
                            • <strong>Input ini:</strong> Min Multiplier = {(adaptiveConfig.minMultiplier * 100).toFixed(0)}% (range: 0.1 - 1.0)
                            <br />• <strong>Fungsi:</strong> Menentukan seberapa rendah limit dapat turun saat sistem diserang
                            <br />• <strong>Untuk DDoS:</strong> 
                            <br />&nbsp;&nbsp;- Nilai rendah (0.1-0.3) = Limit turun drastis → 90-70% request diblokir → <strong>SANGAT EFEKTIF</strong>
                            <br />&nbsp;&nbsp;- Nilai sedang (0.4-0.6) = Limit turun sedang → 60-40% request diblokir → <strong>EFEKTIF</strong>
                            <br />&nbsp;&nbsp;- Nilai tinggi (0.7-1.0) = Limit turun sedikit → 30-0% request diblokir → <strong>KURANG EFEKTIF</strong>
                            <br />• <strong>Rekomendasi DDoS:</strong> 0.1 - 0.3 (10-30% dari base limit)
                            <br />• <strong>Contoh:</strong> Base Reads = {adaptiveConfig.baseConfig.read.limit}/min, Min Multiplier = {adaptiveConfig.minMultiplier} → Limit minimum = {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.minMultiplier)}/min saat diserang
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border-l-4 border-orange-500">
                          <strong className="text-sm text-orange-700 dark:text-orange-300">2. Stress Latency Threshold (Deteksi Serangan)</strong>
                          <p className="text-xs mt-1">
                            • <strong>Input ini:</strong> Stress Latency Threshold = {adaptiveConfig.stressLatencyThreshold}ms (range: 500ms - 10000ms)
                            <br />• <strong>Fungsi:</strong> Mendeteksi kapan sistem mulai stres/overload akibat traffic spike
                            <br />• <strong>Untuk DDoS:</strong>
                            <br />&nbsp;&nbsp;- Nilai rendah (500-1000ms) = Deteksi cepat saat serangan → Limit turun cepat → <strong>EFEKTIF</strong>
                            <br />&nbsp;&nbsp;- Nilai sedang (1000-2000ms) = Deteksi sedang → <strong>SEIMBANG</strong>
                            <br />&nbsp;&nbsp;- Nilai tinggi (3000ms+) = Deteksi lambat → Database bisa crash dulu → <strong>KURANG EFEKTIF</strong>
                            <br />• <strong>Rekomendasi DDoS:</strong> 500-1000ms (deteksi cepat)
                            <br />• <strong>Contoh:</strong> Saat DDoS, response time naik cepat → Jika {'>'} {adaptiveConfig.stressLatencyThreshold}ms → Sistem langsung turunkan limit
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border-l-4 border-yellow-500">
                          <strong className="text-sm text-yellow-700 dark:text-yellow-300">3. Base Limits (Garis Pertahanan Awal)</strong>
                          <p className="text-xs mt-1">
                            • <strong>Input ini:</strong> Base Limits untuk Reads/Writes/RPC/Auth
                            <br />• <strong>Fungsi:</strong> Limit dasar sebelum penyesuaian adaptif
                            <br />• <strong>Untuk DDoS:</strong>
                            <br />&nbsp;&nbsp;- Base limit rendah = Kurang request yang diizinkan → Lebih aman tapi bisa blokir user normal
                            <br />&nbsp;&nbsp;- Base limit tinggi = Lebih banyak request diizinkan → Lebih toleran tapi kurang proteksi
                            <br />• <strong>Rekomendasi DDoS:</strong> 
                            <br />&nbsp;&nbsp;- Reads: 50-100/min (default: {adaptiveConfig.baseConfig.read.limit}/min)
                            <br />&nbsp;&nbsp;- Writes: 20-30/min (default: {adaptiveConfig.baseConfig.write.limit}/min)
                            <br />&nbsp;&nbsp;- RPC: 10-20/min (default: {adaptiveConfig.baseConfig.rpc.limit}/min)
                            <br />&nbsp;&nbsp;- Auth: 5-10/min (default: {adaptiveConfig.baseConfig.auth.limit}/min)
                            <br />• <strong>Penting:</strong> Base limit ini akan dikalikan dengan min multiplier saat serangan, jadi limit efektif minimum = base × min multiplier
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border-l-4 border-blue-500">
                          <strong className="text-sm text-blue-700 dark:text-blue-300">4. Adjustment Interval (Kecepatan Respons)</strong>
                          <p className="text-xs mt-1">
                            • <strong>Input ini:</strong> Adjustment Interval = {adaptiveConfig.adjustmentInterval / 1000}s (range: 10s - 600s)
                            <br />• <strong>Fungsi:</strong> Seberapa sering sistem memeriksa kondisi dan menyesuaikan limit
                            <br />• <strong>Untuk DDoS:</strong>
                            <br />&nbsp;&nbsp;- Interval pendek (10-30s) = Respons cepat → Limit turun cepat saat serangan → <strong>SANGAT EFEKTIF</strong>
                            <br />&nbsp;&nbsp;- Interval sedang (30-60s) = Respons seimbang → <strong>EFEKTIF</strong>
                            <br />&nbsp;&nbsp;- Interval panjang (60s+) = Respons lambat → Serangan bisa damage dulu → <strong>KURANG EFEKTIF</strong>
                            <br />• <strong>Rekomendasi DDoS:</strong> 10-30 detik (respons cepat)
                            <br />• <strong>Catatan:</strong> Interval terlalu pendek ({'<'} 10s) bisa menyebabkan limit berubah-ubah terlalu sering
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border-l-4 border-purple-500">
                          <strong className="text-sm text-purple-700 dark:text-purple-300">5. Circuit Breaker Failure Threshold (Last Resort)</strong>
                          <p className="text-xs mt-1">
                            • <strong>Input ini:</strong> Failure Threshold = {config.failureThreshold} (range: 1-100)
                            <br />• <strong>Fungsi:</strong> Jika adaptive rate limiter tidak cukup, circuit breaker akan OPEN dan blokir SEMUA request
                            <br />• <strong>Untuk DDoS:</strong>
                            <br />&nbsp;&nbsp;- Nilai rendah (3-5) = Circuit terbuka cepat → Semua request diblokir → <strong>SANGAT PROTEKTIF</strong>
                            <br />&nbsp;&nbsp;- Nilai sedang (5-10) = Balance → <strong>SEIMBANG</strong>
                            <br />&nbsp;&nbsp;- Nilai tinggi (10+) = Circuit lambat terbuka → Database bisa crash dulu → <strong>KURANG PROTEKTIF</strong>
                            <br />• <strong>Rekomendasi DDoS:</strong> 3-5 kegagalan dalam monitoring period
                            <br />• <strong>Penting:</strong> Ini adalah lapisan terakhir - gunakan jika rate limiter tidak cukup
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded p-3 mt-3">
                      <strong className="text-sm text-red-800 dark:text-red-200">⚡ Konfigurasi Optimal untuk DDoS Protection:</strong>
                      <div className="text-xs mt-2 space-y-1 text-red-700 dark:text-red-300">
                        <p>Untuk perlindungan maksimal terhadap DDoS attack, gunakan konfigurasi berikut:</p>
                        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                          <li><strong>Min Multiplier:</strong> 0.1 - 0.3 (limit turun hingga 10-30% dari base)</li>
                          <li><strong>Stress Latency Threshold:</strong> 500 - 1000ms (deteksi cepat)</li>
                          <li><strong>Adjustment Interval:</strong> 10 - 30 detik (respons cepat)</li>
                          <li><strong>Base Limits:</strong> Konservatif (Reads: 50-100, Writes: 20-30, RPC: 10-20, Auth: 5-10)</li>
                          <li><strong>Circuit Breaker Failure Threshold:</strong> 3-5 (last resort protection)</li>
                        </ul>
                        <p className="mt-2 font-semibold">Dengan konfigurasi ini, saat DDoS attack terjadi:</p>
                        <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                          <li>Response time naik {'>'} {adaptiveConfig.stressLatencyThreshold}ms (dalam 10-30 detik)</li>
                          <li>Adaptive limiter turunkan limit ke {(adaptiveConfig.minMultiplier * 100).toFixed(0)}% (minimal)</li>
                          <li>70-90% request diblokir dengan HTTP 429</li>
                          <li>Jika masih gagal, circuit breaker OPEN → 100% request diblokir</li>
                          <li>Database terlindungi dari crash</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-yellow-800 dark:text-yellow-200">Lapisan Perlindungan Berlapis</h4>
                  <div className="text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">1</span>
                      <div>
                        <strong>Adaptive Rate Limiter (Lapisan Pertama):</strong>
                        <p className="text-muted-foreground mt-1">
                          Membatasi jumlah request per menit dengan limit yang dinamis. Mencegah database overload dengan menyesuaikan limit berdasarkan kondisi sistem.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">2</span>
                      <div>
                        <strong>Request Timeout (Lapisan Kedua):</strong>
                        <p className="text-muted-foreground mt-1">
                          Setiap request memiliki timeout maksimal {config.timeout / 1000} detik. Request yang terlalu lama dianggap gagal dan tidak menumpuk di database.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">3</span>
                      <div>
                        <strong>Circuit Breaker (Lapisan Ketiga):</strong>
                        <p className="text-muted-foreground mt-1">
                          Jika tetap terjadi {config.failureThreshold} kegagalan dalam {(config.monitoringPeriod / 1000).toFixed(0)} detik, 
                          circuit breaker akan OPEN dan memblokir semua request untuk melindungi database sepenuhnya.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-blue-800 dark:text-blue-200">Penjelasan Detail Setiap Input Konfigurasi</h4>
                  <div className="text-sm space-y-4 text-muted-foreground">
                    {/* Base Limits */}
                    <div>
                      <strong className="text-blue-700 dark:text-blue-300 text-base">1. Base Limits (Limit Dasar)</strong>
                      <p className="mt-1 mb-2">Limit dasar adalah jumlah maksimal request per menit yang diizinkan saat sistem dalam kondisi normal. Limit aktual akan disesuaikan otomatis berdasarkan kondisi sistem (dikalikan dengan multiplier).</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 space-y-2">
                        <div>
                          <strong className="text-sm">Reads Base Limit: {adaptiveConfig.baseConfig.read.limit}/min</strong>
                          <p className="text-xs mt-1">
                            Limit dasar untuk operasi <strong>READ</strong> (membaca data dari database). Operasi ini termasuk SELECT queries, fetching data, dll.
                            <br />• Operasi read biasanya lebih aman dan lebih cepat dibanding write
                            <br />• Limit default: 100 request/menit (dapat disesuaikan 10-1000)
                            <br />• Saat sistem sehat: Dapat naik hingga {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.maxMultiplier)}/min
                            <br />• Saat sistem stres: Dapat turun hingga {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.minMultiplier)}/min
                          </p>
                        </div>
                        <div>
                          <strong className="text-sm">Writes Base Limit: {adaptiveConfig.baseConfig.write.limit}/min</strong>
                          <p className="text-xs mt-1">
                            Limit dasar untuk operasi <strong>WRITE</strong> (menulis/mengubah data di database). Operasi ini termasuk INSERT, UPDATE, DELETE, UPSERT.
                            <br />• Operasi write lebih berisiko dan lebih lambat dibanding read
                            <br />• Limit default: 30 request/menit (dapat disesuaikan 5-500)
                            <br />• Lebih ketat dari reads karena dapat menyebabkan race condition atau data corruption jika terlalu banyak
                            <br />• Saat sistem sehat: Dapat naik hingga {Math.round(adaptiveConfig.baseConfig.write.limit * adaptiveConfig.maxMultiplier)}/min
                            <br />• Saat sistem stres: Dapat turun hingga {Math.round(adaptiveConfig.baseConfig.write.limit * adaptiveConfig.minMultiplier)}/min
                          </p>
                        </div>
                        <div>
                          <strong className="text-sm">RPC Base Limit: {adaptiveConfig.baseConfig.rpc.limit}/min</strong>
                          <p className="text-xs mt-1">
                            Limit dasar untuk operasi <strong>RPC</strong> (Remote Procedure Call / fungsi database). Operasi ini termasuk panggilan fungsi PostgreSQL, stored procedures, dll.
                            <br />• RPC biasanya lebih kompleks dan lebih berat dibanding query biasa
                            <br />• Limit default: 20 request/menit (dapat disesuaikan 5-200)
                            <br />• RPC sering digunakan untuk operasi batch atau analytics, jadi perlu lebih ketat
                            <br />• Saat sistem sehat: Dapat naik hingga {Math.round(adaptiveConfig.baseConfig.rpc.limit * adaptiveConfig.maxMultiplier)}/min
                            <br />• Saat sistem stres: Dapat turun hingga {Math.round(adaptiveConfig.baseConfig.rpc.limit * adaptiveConfig.minMultiplier)}/min
                          </p>
                        </div>
                        <div>
                          <strong className="text-sm">Auth Base Limit: {adaptiveConfig.baseConfig.auth.limit}/min</strong>
                          <p className="text-xs mt-1">
                            Limit dasar untuk operasi <strong>AUTH</strong> (autentikasi dan otorisasi). Operasi ini termasuk login, logout, refresh token, verifikasi session.
                            <br />• Operasi auth sangat penting untuk keamanan, jadi perlu dibatasi
                            <br />• Limit default: 10 request/menit (dapat disesuaikan 2-100)
                            <br />• Mencegah brute force attack dan credential stuffing
                            <br />• Saat sistem sehat: Dapat naik hingga {Math.round(adaptiveConfig.baseConfig.auth.limit * adaptiveConfig.maxMultiplier)}/min
                            <br />• Saat sistem stres: Dapat turun hingga {Math.round(adaptiveConfig.baseConfig.auth.limit * adaptiveConfig.minMultiplier)}/min
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Multiplier Range */}
                    <div>
                      <strong className="text-blue-700 dark:text-blue-300 text-base">2. Multiplier Range (Rentang Pengali)</strong>
                      <p className="mt-1 mb-2">Multiplier menentukan seberapa banyak limit base dapat berubah. Sistem akan mengalikan base limit dengan multiplier saat ini untuk mendapatkan limit efektif.</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 space-y-2">
                        <div>
                          <strong className="text-sm">Min Multiplier: {(adaptiveConfig.minMultiplier * 100).toFixed(0)}%</strong>
                          <p className="text-xs mt-1">
                            Multiplier <strong>minimum</strong> yang akan digunakan saat sistem dalam kondisi <strong>stres</strong>.
                            <br />• Nilai: 0.5 = 50% dari base limit (default: 0.5, range: 0.1 - 1.0)
                            <br />• Digunakan ketika: Response time &gt; {adaptiveConfig.stressLatencyThreshold}ms ATAU error rate &gt; 20%
                            <br />• Contoh: Jika Reads base = {adaptiveConfig.baseConfig.read.limit}, min multiplier = {adaptiveConfig.minMultiplier}, maka limit efektif minimum = {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.minMultiplier)}/min
                            <br />• <strong>Mengapa penting?</strong> Memberi waktu recovery untuk database dengan mengurangi beban saat sistem stres, mencegah overload total
                          </p>
                        </div>
                        <div>
                          <strong className="text-sm">Max Multiplier: {(adaptiveConfig.maxMultiplier * 100).toFixed(0)}%</strong>
                          <p className="text-xs mt-1">
                            Multiplier <strong>maksimum</strong> yang akan digunakan saat sistem dalam kondisi <strong>sehat</strong>.
                            <br />• Nilai: 2.0 = 200% dari base limit (default: 2.0, range: 1.0 - 5.0)
                            <br />• Digunakan ketika: Response time &lt; {adaptiveConfig.healthyLatencyThreshold}ms DAN error rate &lt; 5%
                            <br />• Contoh: Jika Reads base = {adaptiveConfig.baseConfig.read.limit}, max multiplier = {adaptiveConfig.maxMultiplier}, maka limit efektif maksimum = {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.maxMultiplier)}/min
                            <br />• <strong>Mengapa penting?</strong> Memanfaatkan kapasitas database saat kondisi optimal, meningkatkan throughput aplikasi
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Thresholds */}
                    <div>
                      <strong className="text-blue-700 dark:text-blue-300 text-base">3. Latency Thresholds (Ambang Waktu Respons)</strong>
                      <p className="mt-1 mb-2">Threshold menentukan kapan sistem dianggap "sehat" atau "stres" berdasarkan waktu respons database. Sistem menggunakan threshold ini untuk memutuskan apakah harus meningkatkan atau menurunkan limit.</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 space-y-2">
                        <div>
                          <strong className="text-sm">Healthy Latency Threshold: {adaptiveConfig.healthyLatencyThreshold}ms</strong>
                          <p className="text-xs mt-1">
                            Batas atas response time yang dianggap <strong>sehat</strong>. Jika response time database di bawah nilai ini, sistem akan meningkatkan limit.
                            <br />• Default: 200ms (range: 50ms - 1000ms)
                            <br />• Kondisi: Response time &lt; {adaptiveConfig.healthyLatencyThreshold}ms DAN error rate &lt; 5%
                            <br />• Aksi: Limit akan <strong>naik secara bertahap</strong> (maks 10% per adjustment) hingga mencapai max multiplier
                            <br />• <strong>Mengapa penting?</strong> Mengidentifikasi saat database dapat menangani lebih banyak request, memaksimalkan throughput
                            <br />• <strong>Tips:</strong> Jika database Anda biasanya sangat cepat (&lt; 50ms), turunkan nilai ini. Jika database lambat, naikkan.
                          </p>
                        </div>
                        <div>
                          <strong className="text-sm">Stress Latency Threshold: {adaptiveConfig.stressLatencyThreshold}ms</strong>
                          <p className="text-xs mt-1">
                            Batas bawah response time yang dianggap <strong>stres</strong>. Jika response time database di atas nilai ini, sistem akan menurunkan limit.
                            <br />• Default: 1000ms (range: 500ms - 10000ms)
                            <br />• Kondisi: Response time &gt; {adaptiveConfig.stressLatencyThreshold}ms ATAU error rate &gt; 20%
                            <br />• Aksi: Limit akan <strong>turun secara bertahap</strong> (maks 20% per adjustment) hingga mencapai min multiplier
                            <br />• <strong>Mengapa penting?</strong> Mengidentifikasi saat database mulai overload, mengurangi beban sebelum database benar-benar crash
                            <br />• <strong>Tips:</strong> Jika database Anda dapat menangani response time tinggi (&gt; 2s), naikkan nilai ini. Jika database sensitif, turunkan.
                          </p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 mt-2">
                          <p className="text-xs text-yellow-700 dark:text-yellow-300">
                            <strong>💡 Catatan:</strong> Jika response time di antara {adaptiveConfig.healthyLatencyThreshold}ms dan {adaptiveConfig.stressLatencyThreshold}ms, 
                            sistem akan perlahan mengembalikan multiplier ke 1.0 (100% dari base limit).
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Adjustment Interval */}
                    <div>
                      <strong className="text-blue-700 dark:text-blue-300 text-base">4. Adjustment Interval (Interval Penyesuaian)</strong>
                      <p className="mt-1 mb-2">Interval menentukan seberapa sering sistem memeriksa metrik dan menyesuaikan limit. Sistem akan query metrik dari Supabase dan menghitung response time serta error rate untuk memutuskan apakah perlu mengubah multiplier.</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <div>
                          <strong className="text-sm">Adjustment Interval: {adaptiveConfig.adjustmentInterval / 1000} detik ({adaptiveConfig.adjustmentInterval}ms)</strong>
                          <p className="text-xs mt-1">
                            Frekuensi pengecekan dan penyesuaian limit oleh sistem.
                            <br />• Default: 60 detik (60000ms, range: 10s - 600s)
                            <br />• Setiap interval, sistem akan:
                            <br />&nbsp;&nbsp;1. Query metrik dari tabel <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">circuit_breaker_metrics</code> di Supabase (5 menit terakhir)
                            <br />&nbsp;&nbsp;2. Hitung rata-rata response time dan error rate
                            <br />&nbsp;&nbsp;3. Bandingkan dengan threshold (healthy/stress)
                            <br />&nbsp;&nbsp;4. Sesuaikan multiplier untuk setiap operasi (read/write/rpc/auth)
                            <br />&nbsp;&nbsp;5. Simpan multiplier baru ke localStorage dan update limit efektif
                            <br />• <strong>Mengapa penting?</strong> 
                            <br />&nbsp;&nbsp;- Interval terlalu pendek: Sistem terlalu reaktif, limit berubah-ubah terlalu sering (tidak stabil)
                            <br />&nbsp;&nbsp;- Interval terlalu panjang: Sistem lambat merespons perubahan kondisi (tidak efektif)
                            <br />• <strong>Tips:</strong> 
                            <br />&nbsp;&nbsp;- Untuk aplikasi dengan traffic stabil: Gunakan 60-120 detik
                            <br />&nbsp;&nbsp;- Untuk aplikasi dengan traffic volatile: Gunakan 30-60 detik
                            <br />&nbsp;&nbsp;- Jangan kurang dari 10 detik (terlalu agresif)
                            <br />&nbsp;&nbsp;- Jangan lebih dari 600 detik (terlalu lambat)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* How It All Works Together */}
                    <div>
                      <strong className="text-blue-700 dark:text-blue-300 text-base">5. Cara Kerja Bersama-Sama</strong>
                      <p className="mt-1 mb-2">Semua parameter ini bekerja bersama untuk menciptakan sistem perlindungan yang adaptif dan responsif.</p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 space-y-2">
                        <div className="text-xs">
                          <strong>Alur Kerja:</strong>
                          <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                            <li>Sistem memantau setiap request database dan mencatat metrik (response time, success/failure) ke <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">circuit_breaker_metrics</code></li>
                            <li>Setiap {adaptiveConfig.adjustmentInterval / 1000} detik, adaptive rate limiter memeriksa metrik 5 menit terakhir</li>
                            <li>Menghitung rata-rata response time dan error rate</li>
                            <li>Membandingkan dengan threshold:
                              <ul className="list-disc list-inside ml-4 mt-1">
                                <li>Jika response time &lt; {adaptiveConfig.healthyLatencyThreshold}ms DAN error &lt; 5% → <strong>Naikkan limit</strong> (max {(adaptiveConfig.maxMultiplier * 100).toFixed(0)}%)</li>
                                <li>Jika response time &gt; {adaptiveConfig.stressLatencyThreshold}ms ATAU error &gt; 20% → <strong>Turunkan limit</strong> (min {(adaptiveConfig.minMultiplier * 100).toFixed(0)}%)</li>
                                <li>Jika di antara keduanya → <strong>Kembalikan limit</strong> perlahan ke 100%</li>
                              </ul>
                            </li>
                            <li>Update multiplier dan hitung limit efektif baru (base limit × multiplier saat ini)</li>
                            <li>Limit efektif baru diterapkan untuk semua request berikutnya</li>
                            <li>Proses ini berulang setiap {adaptiveConfig.adjustmentInterval / 1000} detik</li>
                          </ol>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2 mt-2">
                          <p className="text-xs text-green-700 dark:text-green-300">
                            <strong>✅ Contoh Praktis:</strong>
                            <br />Base Reads Limit = {adaptiveConfig.baseConfig.read.limit}/min
                            <br />Sistem sehat (response &lt; {adaptiveConfig.healthyLatencyThreshold}ms) → Multiplier = {adaptiveConfig.maxMultiplier} → Effective Limit = {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.maxMultiplier)}/min
                            <br />Sistem stres (response &gt; {adaptiveConfig.stressLatencyThreshold}ms) → Multiplier = {adaptiveConfig.minMultiplier} → Effective Limit = {Math.round(adaptiveConfig.baseConfig.read.limit * adaptiveConfig.minMultiplier)}/min
                            <br />Sistem normal → Multiplier = 1.0 → Effective Limit = {adaptiveConfig.baseConfig.read.limit}/min (base)
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs mt-3 pt-2 border-t">
                      💡 <strong>Tip Penting:</strong> Limit efektif saat ini dapat dilihat di bagian "Adaptive Rate Limiter Configuration" di atas. 
                      Limit akan berubah secara real-time berdasarkan kondisi sistem. Perhatikan perubahan multiplier - jika terus turun, 
                      itu berarti sistem sedang stres dan perlu perhatian.
                    </p>
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
                  <li>Biarkan adaptive rate limiter bekerja otomatis - jangan sering reset manual kecuali benar-benar diperlukan</li>
                  <li>Jika circuit sering terbuka, pertimbangkan untuk optimasi query atau scaling database</li>
                  <li>Gunakan cache untuk mengurangi beban database pada query yang sering digunakan</li>
                  <li>Review dan sesuaikan threshold jika circuit breaker terlalu sensitif atau tidak sensitif</li>
                  <li>Perhatikan perubahan limit adaptive rate limiter - penurunan drastis menunjukkan sistem sedang stres</li>
                  <li>Dokumentasikan setiap insiden circuit breaker dan traffic spike untuk analisis tren</li>
                  <li>Trust the adaptive system - limit akan menyesuaikan otomatis berdasarkan kondisi sistem</li>
                </ul>
              </div>
            </div>

            {/* Configuration Reference */}
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Referensi Konfigurasi
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Circuit Breaker Configuration</h4>
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
                <div className="pt-3 border-t">
                  <h4 className="font-semibold text-sm mb-2">Adaptive Rate Limiter Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <strong>Reads Base Limit:</strong> {adaptiveConfig.baseConfig.read.limit}/min
                      <p className="text-xs text-muted-foreground">Effective: {defaultAdaptiveRateLimiter.getEffectiveLimit('read')}/min ({(adaptiveMultipliers.read * 100).toFixed(0)}%)</p>
                    </div>
                    <div>
                      <strong>Writes Base Limit:</strong> {adaptiveConfig.baseConfig.write.limit}/min
                      <p className="text-xs text-muted-foreground">Effective: {defaultAdaptiveRateLimiter.getEffectiveLimit('write')}/min ({(adaptiveMultipliers.write * 100).toFixed(0)}%)</p>
                    </div>
                    <div>
                      <strong>RPC Base Limit:</strong> {adaptiveConfig.baseConfig.rpc.limit}/min
                      <p className="text-xs text-muted-foreground">Effective: {defaultAdaptiveRateLimiter.getEffectiveLimit('rpc')}/min ({(adaptiveMultipliers.rpc * 100).toFixed(0)}%)</p>
                    </div>
                    <div>
                      <strong>Auth Base Limit:</strong> {adaptiveConfig.baseConfig.auth.limit}/min
                      <p className="text-xs text-muted-foreground">Effective: {defaultAdaptiveRateLimiter.getEffectiveLimit('auth')}/min ({(adaptiveMultipliers.auth * 100).toFixed(0)}%)</p>
                    </div>
                    <div>
                      <strong>Multiplier Range:</strong> {(adaptiveConfig.minMultiplier * 100).toFixed(0)}% - {(adaptiveConfig.maxMultiplier * 100).toFixed(0)}%
                      <p className="text-xs text-muted-foreground">Range penyesuaian limit otomatis</p>
                    </div>
                    <div>
                      <strong>Adjustment Interval:</strong> {adaptiveConfig.adjustmentInterval / 1000}s
                      <p className="text-xs text-muted-foreground">Frekuensi penyesuaian limit</p>
                    </div>
                    <div>
                      <strong>Healthy Threshold:</strong> &lt; {adaptiveConfig.healthyLatencyThreshold}ms
                      <p className="text-xs text-muted-foreground">Response time untuk meningkatkan limit</p>
                    </div>
                    <div>
                      <strong>Stress Threshold:</strong> &gt; {adaptiveConfig.stressLatencyThreshold}ms
                      <p className="text-xs text-muted-foreground">Response time untuk menurunkan limit</p>
                    </div>
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

      {/* Edit Adaptive Rate Limiter Config Modal */}
      <Dialog open={showEditAdaptiveConfigModal} onOpenChange={setShowEditAdaptiveConfigModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-500" />
              Edit Adaptive Rate Limiter Configuration
            </DialogTitle>
            <DialogDescription>
              Ubah konfigurasi adaptive rate limiter. Limit akan secara otomatis menyesuaikan berdasarkan kondisi sistem.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div>
              <h4 className="font-semibold text-sm mb-3">Base Limits (per menit)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="readLimit">
                    Reads Base Limit
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Limit dasar untuk operasi read (min: 10, max: 1000)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="readLimit"
                    type="number"
                    min={10}
                    max={1000}
                    value={editAdaptiveConfig.baseConfig.read.limit}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      baseConfig: {
                        ...editAdaptiveConfig.baseConfig,
                        read: { ...editAdaptiveConfig.baseConfig.read, limit: parseInt(e.target.value) || 100 }
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="writeLimit">
                    Writes Base Limit
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Limit dasar untuk operasi write (min: 5, max: 500)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="writeLimit"
                    type="number"
                    min={5}
                    max={500}
                    value={editAdaptiveConfig.baseConfig.write.limit}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      baseConfig: {
                        ...editAdaptiveConfig.baseConfig,
                        write: { ...editAdaptiveConfig.baseConfig.write, limit: parseInt(e.target.value) || 30 }
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rpcLimit">
                    RPC Base Limit
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Limit dasar untuk operasi RPC (min: 5, max: 200)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="rpcLimit"
                    type="number"
                    min={5}
                    max={200}
                    value={editAdaptiveConfig.baseConfig.rpc.limit}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      baseConfig: {
                        ...editAdaptiveConfig.baseConfig,
                        rpc: { ...editAdaptiveConfig.baseConfig.rpc, limit: parseInt(e.target.value) || 20 }
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authLimit">
                    Auth Base Limit
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Limit dasar untuk operasi autentikasi (min: 2, max: 100)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="authLimit"
                    type="number"
                    min={2}
                    max={100}
                    value={editAdaptiveConfig.baseConfig.auth.limit}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      baseConfig: {
                        ...editAdaptiveConfig.baseConfig,
                        auth: { ...editAdaptiveConfig.baseConfig.auth, limit: parseInt(e.target.value) || 10 }
                      }
                    })}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3">Adjustment Parameters</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minMultiplier">
                    Min Multiplier
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Multiplier minimum (misal: 0.5 = 50%). Digunakan saat sistem stres (min: 0.1, max: 1.0)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="minMultiplier"
                    type="number"
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    value={editAdaptiveConfig.minMultiplier}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      minMultiplier: parseFloat(e.target.value) || 0.5
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: {(editAdaptiveConfig.minMultiplier * 100).toFixed(0)}% dari base limit
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxMultiplier">
                    Max Multiplier
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Multiplier maksimum (misal: 2.0 = 200%). Digunakan saat sistem sehat (min: 1.0, max: 5.0)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="maxMultiplier"
                    type="number"
                    min={1.0}
                    max={5.0}
                    step={0.1}
                    value={editAdaptiveConfig.maxMultiplier}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      maxMultiplier: parseFloat(e.target.value) || 2.0
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum: {(editAdaptiveConfig.maxMultiplier * 100).toFixed(0)}% dari base limit
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="healthyLatency">
                    Healthy Latency Threshold (ms)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Response time di bawah ini dianggap sehat. Sistem akan meningkatkan limit (min: 50ms, max: 1000ms)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="healthyLatency"
                    type="number"
                    min={50}
                    max={1000}
                    step={50}
                    value={editAdaptiveConfig.healthyLatencyThreshold}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      healthyLatencyThreshold: parseInt(e.target.value) || 200
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stressLatency">
                    Stress Latency Threshold (ms)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Response time di atas ini dianggap stres. Sistem akan menurunkan limit (min: 500ms, max: 10000ms)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="stressLatency"
                    type="number"
                    min={500}
                    max={10000}
                    step={100}
                    value={editAdaptiveConfig.stressLatencyThreshold}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      stressLatencyThreshold: parseInt(e.target.value) || 1000
                    })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adjustmentInterval">
                    Adjustment Interval (ms)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Frekuensi pengecekan dan penyesuaian limit (min: 10000ms, max: 600000ms)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="adjustmentInterval"
                    type="number"
                    min={10000}
                    max={600000}
                    step={10000}
                    value={editAdaptiveConfig.adjustmentInterval}
                    onChange={(e) => setEditAdaptiveConfig({
                      ...editAdaptiveConfig,
                      adjustmentInterval: parseInt(e.target.value) || 60000
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Setiap {(editAdaptiveConfig.adjustmentInterval / 1000).toFixed(0)} detik
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Tips:</strong> Adaptive rate limiter secara otomatis menyesuaikan limit berdasarkan metrik sistem (response time, error rate). Saat sistem sehat, limit akan naik. Saat sistem stres, limit akan turun untuk melindungi database dari overload.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAdaptiveConfigModal(false)}>
              Batal
            </Button>
            <Button variant="default" onClick={confirmEditAdaptiveConfig}>
              Simpan Perubahan
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

