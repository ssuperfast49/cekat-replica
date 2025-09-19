import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function Otp() {
  const navigate = useNavigate();
  const { user, session, otpRequired, setOtpVerified } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(user?.email ?? null);
    if (!user || !otpRequired) {
      navigate("/", { replace: true });
    }
  }, [user, otpRequired, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const email = user?.email!;
      const { data, error } = await supabase.rpc('verify_email_2fa', {
        p_code: code,
        p_session_minutes: 10, // or whatever session duration you want
        p_user: user?.id
      });
      if (error) throw error;
      if (!data) throw new Error('Invalid code');
      setOtpVerified(true);
      toast.success("Verification successful");
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Verification failed");
      toast.error("Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await supabase.functions.invoke('send-2fa-email', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      toast.success("A new code was sent");
    } catch (err) {
      toast.error("Could not resend code");
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem('otpVerified');
      localStorage.removeItem('otpRequired');
    } catch {}
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Enter verification code</CardTitle>
          <CardDescription>
            We sent a 6-digit code to {email ? <span className="font-medium">{email}</span> : "your email"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Didn't get the code?</span>
              <Button type="button" variant="link" className="px-0" onClick={handleResend} disabled={resending}>
                {resending ? "Resending..." : "Resend code"}
              </Button>
            </div>
            <div className="flex items-center justify-center">
              <Button type="button" variant="ghost" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


