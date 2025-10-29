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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { databaseCircuitBreaker, CircuitState } from '@/lib/circuitBreaker';
import { defaultMetricsCollector, getMetricsStats } from '@/lib/metrics';
import { defaultRateLimiter } from '@/lib/rateLimiter';
import { defaultRequestQueue } from '@/lib/requestQueue';
import { defaultFallbackHandler } from '@/lib/fallbackHandler';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, CartesianGrid } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Zap, Shield, Database, HelpCircle } from 'lucide-react';
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const isAdmin = hasPermission('access_rules.configure'); // Using same permission as permissions page

  useEffect(() => {
    // Update stats periodically
    const interval = setInterval(() => {
      setStats(databaseCircuitBreaker.getStats());
      setQueueStats(defaultRequestQueue.getStats());
      setCacheStats(defaultFallbackHandler.getStats());
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <LabelWithHelp 
                label="Admin Controls" 
                description="Kontrol manual untuk admin: Reset (reset semua statistik), Manually Open (paksa buka circuit breaker untuk menghentikan semua request), Flush Metrics (kirim semua metrik yang tertunda ke database)"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset}>
                Reset Circuit Breaker
              </Button>
              <Button variant="destructive" onClick={handleOpen}>
                Manually Open Circuit
              </Button>
              <Button variant="outline" onClick={handleFlushMetrics}>
                Flush Metrics
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ <strong>PERINGATAN:</strong> Gunakan kontrol ini dengan hati-hati. Mereka mempengaruhi semua operasi database dan dapat menghentikan aplikasi.
            </p>
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

