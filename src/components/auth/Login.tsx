import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Lock, Eye, EyeOff, User, ArrowLeft } from "lucide-react";
import { HCaptcha } from "@/components/ui/hcaptcha";
import { supabase } from "@/lib/supabase";
import pkg from "../../../package.json";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";

const stripSpaces = (value: string) => value.replace(/\s/g, "");
const sanitizeEmailInput = (value: string) => stripSpaces(value).toLowerCase();

interface LoginProps {
  onBack?: () => void;
}

export default function Login({ onBack }: LoginProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // CAPTCHA
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const HCAPTCHA_SITEKEY = (import.meta as any).env?.VITE_HCAPTCHA_SITEKEY || '';
  const CAPTCHA_ENABLED = !!HCAPTCHA_SITEKEY;
  // Expose a reset helper from the HCaptcha widget
  const resetCaptcha = () => {
    try { (window as any)?.hcaptcha?.reset?.(); } catch {}
  };

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCaptchaError(null);

    // Require CAPTCHA token only when configured; Supabase validates server-side
    if (CAPTCHA_ENABLED && !captchaToken) {
      setCaptchaError('Please complete the CAPTCHA');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(CAPTCHA_ENABLED && captchaToken ? { options: { captchaToken } } : {}),
      });

      if (error) throw error;

      // Check account status immediately after successful authentication
      const userId = data.user?.id;
      if (userId) {
        try {
          const { data: profile, error: profErr } = await supabase
            .from('users_profile')
            .select('is_active, is_2fa_email_enabled')
            .eq('user_id', userId)
            .maybeSingle();

          if (profErr) {
            console.error('Profile fetch error:', profErr);
            throw profErr;
          }

          // Check if account is deactivated or missing profile
          if (!profile) {
            await supabase.auth.signOut();
            setError('Your account profile is missing. Please contact your Master Agent.');
            setLoading(false);
            return;
          }

          if (profile.is_active === false) {
            // Account is deactivated, redirect to warning page
            navigate('/account-deactivated', { replace: true });
            return;
          }

          const requiresOtp = (profile as any)?.is_2fa_email_enabled === true;
          // Defer to global guard to prevent double redirects / flicker
          toast.success("Login successful!");
          navigate("/", { replace: true });
          return;
        } catch (profileError) {
          // If profile fetch fails, fall back to ProtectedRoute guard
          console.warn('Profile fetch failed:', profileError);
          toast.success("Login successful!");
        }
      } else {
        toast.success("Login successful!");
      }

      navigate("/", { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      setError(error instanceof Error ? error.message : "Failed to login");
      toast.error("Login failed");
      if (CAPTCHA_ENABLED) resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  // const handleSignUp = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   setError(null);

  //   if (password !== confirmPassword) {
  //     setError("Passwords do not match");
  //     setLoading(false);
  //     return;
  //   }

  //   try {
  //     const { data, error } = await supabase.auth.signUp({
  //       email,
  //       password,
  //       options: {
  //         data: {
  //           full_name: fullName,
  //         },
  //       },
  //     });

  //     if (error) throw error;

  //     setSuccess("Account created successfully! Please check your email to verify your account.");
  //     toast.success("Account created! Check your email to verify.");
      
  //     // Clear form
  //     setEmail("");
  //     setPassword("");
  //     setConfirmPassword("");
  //     setFullName("");
  //   } catch (error) {
  //     console.error("Sign up error:", error);
  //     setError(error instanceof Error ? error.message : "Failed to create account");
  //     toast.error("Failed to create account");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess("Password reset email sent! Please check your inbox.");
      toast.success("Password reset email sent!");
    } catch (error) {
      console.error("Password reset error:", error);
      setError(error instanceof Error ? error.message : "Failed to send reset email");
      toast.error("Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="absolute top-4 left-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>Sign in to continue to Chatflow</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            clearMessages();
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              {/* <TabsTrigger value="signup">Sign Up</TabsTrigger> */}
              <TabsTrigger value="reset">Reset</TabsTrigger>
            </TabsList>

            {/* Error/Success Messages */}
            {error && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mt-4 border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(sanitizeEmailInput(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">We’ll send a one-time code after login.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                     <Input
                       id="login-password"
                       type={showPassword ? "text" : "password"}
                       placeholder="Enter your password"
                       value={password}
                      onChange={(e) => setPassword(stripSpaces(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                       className="pl-10 pr-10"
                       required
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
                  <div className="flex items-center justify-end text-xs">
                    <Link to="/reset-password" className="hover:underline">Forgot password?</Link>
                  </div>
                </div>
                {/* CAPTCHA */}
                {CAPTCHA_ENABLED ? (
                  <div className="flex flex-col items-center gap-2">
                    <HCaptcha
                      sitekey={HCAPTCHA_SITEKEY}
                      onVerify={(t:string)=>setCaptchaToken(t)}
                      onExpire={()=>{ setCaptchaToken(null); }}
                    />
                    {captchaError && (<p className="text-xs text-red-600 mt-1">{captchaError}</p>)}
                  </div>
                ) : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  <Link to="/changelog" className="hover:underline">v{(pkg as any)?.version}</Link>
                </p>
              </form>
            </TabsContent>

            {/* Sign Up Tab
            <TabsContent value="signup" className="space-y-4 mt-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(sanitizeEmailInput(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(stripSpaces(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                      className="pl-10 pr-10"
                      required
                      minLength={6}
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(stripSpaces(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </TabsContent> */}

            {/* Password Reset Tab */}
            <TabsContent value="reset" className="space-y-4 mt-4">
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(sanitizeEmailInput(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset email...
                    </>
                  ) : (
                    "Send Reset Email"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
