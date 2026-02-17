import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RBACProvider } from "@/contexts/RBACContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { GlobalMessageListener } from "@/components/layout/GlobalMessageListener";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import Otp from "./pages/Otp";
import Logout from "./pages/Logout";
import NotFound from "./pages/NotFound";
import Changelog from "./pages/Changelog";
import LiveChat from "./pages/LiveChat";
import AccountDeactivated from "./pages/AccountDeactivated";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      gcTime: 5 * 60_000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    }
  }
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <RBACProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PresenceProvider>
                <GlobalMessageListener />
                <Routes>
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  } />
                  {/* Direct route to Chat inbox */}
                  <Route path="/chat" element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/invite" element={<ResetPassword />} />
                  <Route path="/account-deactivated" element={<AccountDeactivated />} />
                  <Route path="/otp" element={
                    <ProtectedRoute>
                      <Otp />
                    </ProtectedRoute>
                  } />
                  <Route path="/logout" element={<Logout />} />
                  <Route path="/changelog" element={<Changelog />} />
                  {/* Public, chat-only embed route */}
                  <Route path="/livechat/:platform_id" element={<LiveChat />} />
                  <Route path="/livechat/:platformId" element={<LiveChat />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PresenceProvider>
            </TooltipProvider>
          </RBACProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
