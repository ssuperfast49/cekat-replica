import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Ticket, BarChart2, Users, Megaphone, PlugZap, Bot, ShieldCheck, Settings as SettingsIcon, CreditCard, UserRound, LogOut, User, ChevronDown, HelpCircle, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ConversationPage from "@/components/chat/ConversationPage";
import Analytics from "@/components/analytics/Analytics";
import Contacts from "@/components/contacts/Contacts";
import ConnectedPlatforms from "@/components/platforms/ConnectedPlatforms";
import AIAgents from "@/components/aiagents/AIAgents";
import Settings from "@/components/settings/Settings";
import HumanAgents from "@/components/humanagents/HumanAgents";
import ProfilePopover from "@/components/auth/ProfileDialog";
import { cn } from "@/lib/utils";

type NavKey =
  | "chat"
  // | "tickets"
  | "analytics"
  | "contacts"
  // | "broadcasts"
  | "platforms"
  | "aiagents"
  | "humanagents"
  | "settings"
  // | "billings"
  | "profile"
  | "home";

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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen">
        {/* Sidebar */}
        <aside 
          className={`shrink-0 border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out ${
            sidebarExpanded ? 'w-64' : 'w-20'
          } md:flex md:flex-col p-4`}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          <div className="flex items-center gap-2 px-2 py-1 transition-all duration-200">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-brand to-primary" aria-hidden />
            <span className={`text-lg font-semibold transition-opacity duration-200 whitespace-nowrap ${
              sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}>
              Cekat AI
            </span>
          </div>
          <Separator className="my-4" />
          
          <nav className="flex flex-col gap-1 flex-1">
            <NavItem icon={MessageSquare} label="Chat" active={active === "chat"} onClick={() => setActive("chat")} collapsed={!sidebarExpanded} />
            {/* <NavItem icon={Ticket} label="Tickets" active={active === "tickets"} onClick={() => setActive("tickets")} collapsed={!sidebarExpanded} /> */}
            <NavItem icon={BarChart2} label="Analytics" active={active === "analytics"} onClick={() => setActive("analytics")} collapsed={!sidebarExpanded} />
            <NavItem icon={Users} label="Contacts" active={active === "contacts"} onClick={() => setActive("contacts")} collapsed={!sidebarExpanded} />
            {/* <NavItem icon={Megaphone} label="Broadcasts" active={active === "broadcasts"} onClick={() => setActive("broadcasts")} collapsed={!sidebarExpanded} /> */}
            <NavItem icon={PlugZap} label="Connected Platforms" active={active === "platforms"} onClick={() => setActive("platforms")} collapsed={!sidebarExpanded} />
            <NavItem icon={Bot} label="AI Agents" active={active === "aiagents"} onClick={() => setActive("aiagents")} collapsed={!sidebarExpanded} />
            <NavItem icon={ShieldCheck} label="Human Agents" active={active === "humanagents"} onClick={() => setActive("humanagents")} collapsed={!sidebarExpanded} />
          </nav>
          
          {/* Footer Navigation - Always Visible */}
          <div className="mt-auto flex flex-col gap-1 pt-6">
            <Separator className="mb-3" />
            <NavItem icon={SettingsIcon} label="Settings" active={active === "settings"} onClick={() => setActive("settings")} collapsed={!sidebarExpanded} />
            {/* <NavItem icon={CreditCard} label="Billings" active={active === "billings"} onClick={() => setActive("billings")} collapsed={!sidebarExpanded} /> */}
            <ProfilePopover>
              <button
                type="button"
                className={cn(
                  "group grid h-10 w-full grid-cols-[1.125rem,1fr] items-center rounded-md px-3 text-left text-sm transition-all duration-200 gap-2",
                  active === "profile"
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : "text-muted-foreground hover:bg-blue-50 hover:text-blue-600 hover:border hover:border-blue-100",
                  !sidebarExpanded && "grid-cols-[1.125rem,0fr]"
                )}
                title={!sidebarExpanded ? "Profile" : undefined}
              >
                <UserRound className={`h-4 w-4 shrink-0 transition-colors ${active === "profile" ? "text-blue-600" : "group-hover:text-blue-600"}`} />
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
            <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
              <div className="flex items-center gap-2 md:gap-3">
                <Button variant="outline" className="hidden md:inline-flex gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                  <HelpCircle className="h-4 w-4" />
                  Help Center
                </Button>
                <Button variant="outline" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                  <MessageCircle className="h-4 w-4" />
                  WA Support
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="hidden sm:inline-flex bg-success text-success-foreground">Online</Badge>
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium">{user?.user_metadata?.full_name || 'User'}</div>
                  <div className="text-xs text-muted-foreground">{user?.email}</div>
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
                <Analytics />
              </>
            ) : active === "contacts" ? (
              <>
                <h1 className="sr-only">Contacts Management</h1>
                <Contacts />
              </>
            ) : active === "platforms" ? (
              <>
                <h1 className="sr-only">Connected Platforms</h1>
                <ConnectedPlatforms />
              </>
            ) : active === "aiagents" ? (
              <>
                <h1 className="sr-only">AI Agents</h1>
                <AIAgents />
              </>
            ) : active === "settings" ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl mb-6">Settings</h1>
                <Settings />
              </>
            ) : active === "humanagents" ? (
              <>
                <h1 className="sr-only">Human Agents</h1>
                <HumanAgents />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Selamat datang kembali di Cekat AI!</h1>
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
