import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserRound, LogOut, User, ChevronDown, HelpCircle, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ConversationPage from "@/components/chat/ConversationPage";
import Contacts from "@/components/contacts/Contacts";
import ConnectedPlatforms from "@/components/platforms/ConnectedPlatforms";
import Analytics from "@/components/analytics/Analytics";
import AIAgents from "@/components/aiagents/AIAgents";
import Settings from "@/components/settings/Settings";
import HumanAgents from "@/components/humanagents/HumanAgents";
import PermissionsPage from "@/components/permissions/PermissionsPage";
import Logs from "./Logs";
import ProfilePopover from "@/components/auth/ProfileDialog";
import PermissionNavItem from "@/components/navigation/PermissionNavItem";
import PermissionGate from "@/components/rbac/PermissionGate";
import { useNavigation } from "@/hooks/useNavigation";
import { useRBAC } from "@/contexts/RBACContext";
import { NAVIGATION_ORDER, NavKey } from "@/config/navigation";
import { cn } from "@/lib/utils";

// NavKey is now imported from navigation config

const NavItem = ({
  icon: Icon,
  label,
  active = false,
  onClick,
  collapsed,
}: {
  icon: LucideIcon; label: string; active?: boolean; onClick?: () => void; collapsed?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      // fixed row height + grid for icon/label
      "group grid h-10 w-full grid-cols-[1.125rem,1fr] items-center rounded-md px-3 text-left text-sm transition-all duration-200 gap-2",
      active
        ? "bg-blue-100 text-blue-700 border border-blue-200"
        : "text-muted-foreground hover:bg-blue-50 hover:text-blue-600 hover:border hover:border-blue-100",
      collapsed && "grid-cols-[1.125rem,0fr]" // squeeze label column to zero
    )}
    aria-current={active ? "page" : undefined}
    title={collapsed ? label : undefined}
  >
    <Icon className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-blue-600" : "group-hover:text-blue-600"}`} />
    <span
      className={cn(
        "overflow-hidden whitespace-nowrap text-ellipsis transition-opacity duration-200",
        collapsed && "opacity-0 pointer-events-none",
      )}
    >
      {label}
    </span>
  </button>
);


const StepCard = ({ step, title, description, emoji }: { step: number; title: string; description: string; emoji: string }) => (
  <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-transform hover:-translate-y-0.5">
    <div className="text-2xl animate-float" aria-hidden>{emoji}</div>
    <div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{step}.</Badge>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

const Index = () => {
  const [active, setActive] = useState<NavKey>("chat");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const { user, signOut, setAccountDeactivated, accountDeactivated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getDefaultNavItem, getNavItem, canAccessNavItem } = useNavigation();
  const { loading: rbacLoading } = useRBAC();

  const validMenus: NavKey[] = NAVIGATION_ORDER;

  const updateMenuParam = (menu: NavKey, options?: { replace?: boolean }) => {
    const next = new URLSearchParams(searchParams);
    next.set("menu", menu);
    setSearchParams(next, options);
  };

  // Sync active tab from URL on load and when the query changes, enforcing permission
  useEffect(() => {
    if (rbacLoading) return; // avoid redirects while RBAC is loading
    const menuParam = searchParams.get("menu");
    if (menuParam && (validMenus as string[]).includes(menuParam)) {
      const typedMenu = menuParam as NavKey;
      if (canAccessNavItem(typedMenu)) {
        if (typedMenu !== active) setActive(typedMenu);
      } else {
        const fallback = getDefaultNavItem();
        if (fallback && fallback !== active) {
          setActive(fallback);
          updateMenuParam(fallback, { replace: true });
        }
      }
    } else {
      // Ensure the URL always has a valid menu param
      if (!menuParam) updateMenuParam("chat", { replace: true });
    }
  }, [searchParams, canAccessNavItem, getDefaultNavItem, rbacLoading]);

  // Auto-redirect to first accessible navigation item if current one is not accessible
  useEffect(() => {
    if (rbacLoading) return;
    const defaultNav = getDefaultNavItem();
    if (!validMenus.includes(active) || !canAccessNavItem(active)) {
      if (defaultNav) {
        setActive(defaultNav);
        updateMenuParam(defaultNav, { replace: true });
      }
    }
  }, [getDefaultNavItem, canAccessNavItem, active, validMenus, rbacLoading]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.substring(0, 2).toUpperCase();
  };

  // If account is deactivated, don't render the main content to prevent API calls
  if (accountDeactivated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Akun Dinonaktifkan</h1>
            <p className="text-gray-600">Akun Anda telah dinonaktifkan dan tidak dapat mengakses sistem.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen">
        {/* Sidebar */}
        <aside 
          className={`shrink-0 border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out ${
            sidebarExpanded ? 'w-64' : 'w-[4.7rem]'
          } md:flex md:flex-col p-4 sticky top-0 h-screen overflow-y-auto`}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          <div className="flex items-center justify-center px-2 py-3 transition-all duration-200">
            {sidebarExpanded ? (
              <img src="/synka.png" alt="Synka" className="h-10 w-auto object-contain transition-all duration-300 scale-125" />
            ) : (
              <img src="/synka_logo.png" alt="Synka Logo" className="h-10 w-auto object-contain transition-all duration-300 scale-110" />
            )}
          </div>
          
          <Separator className="mb-4 mt-1"/>
          
          <nav className="flex flex-col gap-1 flex-1">
            {NAVIGATION_ORDER.map((navKey) => {
              const navItem = getNavItem(navKey);
              return (
                <PermissionNavItem
                  key={navKey}
                  icon={navItem.icon}
                  label={navItem.label}
                  active={active === navKey}
                  onClick={() => {
                    setActive(navKey);
                    updateMenuParam(navKey);
                  }}
                  collapsed={!sidebarExpanded}
                  permissions={navItem.permissions}
                  requireAll={navItem.requireAll}
                  resourceAny={navItem.resourceAny}
                />
              );
            })}
          </nav>
          
          {/* Footer Navigation - Always Visible */}
          <div className="mt-auto flex flex-col gap-1 pt-6">
            <Separator className="mb-3" />
            {/* <NavItem icon={CreditCard} label="Billings" active={active === "billings"} onClick={() => setActive("billings")} collapsed={!sidebarExpanded} /> */}
            <ProfilePopover>
              <button
                type="button"
                className={cn(
                  "group grid h-10 w-full grid-cols-[1.125rem,1fr] items-center rounded-md px-3 text-left text-sm transition-all duration-200 gap-2",
                  "text-muted-foreground hover:bg-blue-50 hover:text-blue-600 hover:border hover:border-blue-100",
                  !sidebarExpanded && "grid-cols-[1.125rem,0fr]"
                )}
                title={!sidebarExpanded ? "Profile" : undefined}
              >
                <UserRound className="h-4 w-4 shrink-0 transition-colors group-hover:text-blue-600" />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-ellipsis transition-opacity duration-200",
                    !sidebarExpanded && "opacity-0 pointer-events-none",
                  )}
                >
                  Profile
                </span>
              </button>
            </ProfilePopover>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
              <div className="flex items-center gap-2 md:gap-3">
              </div>
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="hidden sm:inline-flex bg-success text-success-foreground cursor-help">Online</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Status pengguna saat ini: Online</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-right hidden sm:block min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-sm font-medium max-w-[28ch] truncate cursor-help">{user?.user_metadata?.full_name || 'User'}</div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Nama lengkap pengguna</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-xs text-muted-foreground max-w-[32ch] truncate cursor-help">{user?.email}</div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Alamat email pengguna</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name || user?.email} />
                        <AvatarFallback className="text-sm">
                          {getUserInitials(user?.user_metadata?.full_name, user?.email || '')}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.user_metadata?.full_name || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <ProfilePopover>
                      <button className="flex items-center w-full px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground rounded-sm">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </button>
                    </ProfilePopover>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Content */}
          <section className="px-4 py-6 md:px-8">
            {active === "chat" ? (
              <>
                <h1 className="sr-only">Chat Inbox</h1>
                <ConversationPage />
              </>
            ) : active === "analytics" ? (
              <>
                <h1 className="sr-only">Analytics Dashboard</h1>
                <PermissionGate permission={'analytics.view_kpi'}>
                  <Analytics />
                </PermissionGate>
              </>
            ) : active === "contacts" ? (
              <>
                <h1 className="sr-only">Contacts Management</h1>
                <PermissionGate permission={'contacts.read'}>
                  <Contacts />
                </PermissionGate>
              </>
            ) : active === "platforms" ? (
              <>
                <h1 className="sr-only">Connected Platforms</h1>
                <PermissionGate permission={'channels.read'}>
                  <ConnectedPlatforms />
                </PermissionGate>
              </>
            ) : active === "aiagents" ? (
              <>
                <h1 className="sr-only">AI Agents</h1>
                <PermissionGate permission={'ai_profiles.read'}>
                  <AIAgents />
                </PermissionGate>
              </>
            ) : /* settings hidden */ false ? (
              <></>
            ) : active === "humanagents" ? (
              <PermissionGate permission={'super_agents.read'} fallback={<div className="text-sm text-muted-foreground">You do not have access to Human Agents.</div>}>
                <h1 className="sr-only">Human Agents</h1>
                <HumanAgents />
              </PermissionGate>
            ) : active === "permissions" ? (
              <PermissionGate permission={'access_rules.configure'} fallback={<div className="text-sm text-muted-foreground">You do not have access to Permissions.</div>}>
                <h1 className="sr-only">Permissions</h1>
                <PermissionsPage />
              </PermissionGate>
            ) : active === "logs" ? (
              <PermissionGate permission={'audit_logs.read'} fallback={<div className="text-sm text-muted-foreground">You do not have access to Logs.</div>}>
                <h1 className="sr-only">Logs</h1>
                <Logs />
              </PermissionGate>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Selamat datang kembali di Synka!</h1>
                <div className="mt-6 grid gap-4 md:max-w-2xl">
                  <StepCard step={1} title="Hubungkan Platform" description="Mulai terima pesan dari Whatsapp, IG, dan FB Anda!" emoji="📨" />
                  <StepCard step={2} title="Buat AI Agent" description="Jawab pesan masuk dengan Agent AI Anda." emoji="🤖" />
                  <StepCard step={3} title="Undang Agen Manusia" description="Undang tim Anda untuk membantu menjawab chat." emoji="🧑‍💼" />
                  <StepCard step={4} title="Konek AI Agent ke Inbox" description="Hubungkan AI Agent dan Human Agent ke platform." emoji="🔗" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Butuh bantuan lebih? <a className="text-brand underline underline-offset-4" href="#">Lihat Tutorial Youtube kami</a></p>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Index;
