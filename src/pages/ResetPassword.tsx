import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';

const stripSpaces = (value: string) => value.replace(/\s/g, '');

type PasswordRequirement = {
  id: string;
  test: (value: string) => boolean;
  message: string;
};

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: 'lowercase',
    test: (value) => /[a-z]/.test(value),
    message: 'Minimal 1 huruf kecil (a-z)',
  },
  {
    id: 'uppercase',
    test: (value) => /[A-Z]/.test(value),
    message: 'Minimal 1 huruf besar (A-Z)',
  },
  {
    id: 'number',
    test: (value) => /[0-9]/.test(value),
    message: 'Minimal 1 angka (0-9)',
  },
  {
    id: 'symbol',
    test: (value) => /[^A-Za-z0-9]/.test(value),
    message: 'Minimal 1 simbol (contoh: !@#$)',
  },
  {
    id: 'length',
    test: (value) => value.length >= 8,
    message: 'Minimal 8 karakter',
  },
];

const getUnmetPasswordRequirements = (value: string) =>
  PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(value)).map(
    (requirement) => requirement.message,
  );

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      try {
        // Handle email confirmation PKCE code (?code=...)
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
        // If we hit this page without a valid recovery context, redirect home
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Invalid or expired reset link. Please request a new password reset.');
        }
      } catch (e) {
        console.warn('Password setup init failed', e);
      }
    };
    init();
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!password) {
      setError('Kata sandi baru belum diisi.');
      setPasswordTouched(true);
      setLoading(false);
      return;
    }

    const unmetRequirements = getUnmetPasswordRequirements(password);
    if (unmetRequirements.length > 0) {
      setError('Pastikan kata sandi memenuhi semua persyaratan.');
      setPasswordTouched(true);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak sama.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      // Update the password_set flag in users_profile
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('users_profile')
            .update({ password_set: true })
            .eq('user_id', user.id);
        }
      } catch (profileError) {
        console.warn('Failed to update password_set flag:', profileError);
      }

      setSuccess(true);
      toast.success('Password updated successfully!');

      // Ensure the recovery session is fully cleared so refresh does not auto-login
      try {
        await supabase.auth.signOut();
      } catch { }
      try {
        localStorage.removeItem('otpVerified');
        localStorage.removeItem('otpRequired');
        localStorage.removeItem('app.lastAuthEvent');
        localStorage.removeItem('auth.intent');
      } catch { }

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Password reset error:', error);
      setError(error instanceof Error ? error.message : 'Gagal memperbarui kata sandi.');
      toast.error('Gagal memperbarui kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  const shouldShowPasswordHints = passwordTouched && password.length > 0;
  const passwordHintMessages = useMemo(() => {
    if (!shouldShowPasswordHints) {
      return [];
    }
    return getUnmetPasswordRequirements(password);
  }, [password, shouldShowPasswordHints]);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-green-600">Success!</CardTitle>
            <CardDescription>
              Your password has been updated successfully. You will be redirected to the login page shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="absolute top-4 left-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => {
                    if (!passwordTouched) {
                      setPasswordTouched(true);
                    }
                    setPassword(stripSpaces(e.target.value));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ') {
                      e.preventDefault();
                    }
                  }}
                  className="pl-10 pr-10"
                  required
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {passwordHintMessages.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passwordHintMessages.map((message) => (
                    <p key={message} className="flex items-center gap-2 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      {message}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(stripSpaces(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === ' ') {
                      e.preventDefault();
                    }
                  }}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
