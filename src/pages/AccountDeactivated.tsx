import { AlertTriangle, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function AccountDeactivated() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleBackToLogin = async () => {
    if (isNavigating) { return; }
    
    setIsNavigating(true);
    
    try {
      // Clear localStorage first
      localStorage.clear();
      
      // Try to sign out, but don't wait for it
      signOut().catch(() => {});
      
      // Force navigation immediately
      navigate('/', { replace: true });
    } catch (error) {
      console.error('AccountDeactivated: Error in handleBackToLogin:', error);
      // Force navigation even on error
      navigate('/', { replace: true });
    } finally {
      setIsNavigating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-800">
              Akun Dinonaktifkan
            </CardTitle>
          </div>
          <CardDescription className="text-gray-600 text-base">
            Akun Anda telah dinonaktifkan dan tidak dapat mengakses sistem.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-800 mb-2">
                  Hubungi Master Agent
                </h4>
                <p className="text-sm text-red-700">
                  Untuk mengaktifkan kembali akun Anda, silakan hubungi Master Agent 
                  di organisasi Anda. Mereka dapat mengaktifkan akun Anda kembali.
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>
              Jika Anda yakin ini adalah kesalahan, silakan hubungi administrator 
              sistem untuk bantuan lebih lanjut.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleBackToLogin}
              variant="outline"
              className="w-full"
              disabled={isNavigating}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isNavigating ? 'Memproses...' : 'Kembali ke Halaman Login'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
