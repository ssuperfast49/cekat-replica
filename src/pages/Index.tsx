import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Ticket, BarChart2, Users, Megaphone, PlugZap, Bot, ShieldCheck, Settings, CreditCard, UserRound } from "lucide-react";

const NavItem = ({ icon: Icon, label, active = false }: { icon: any; label: string; active?: boolean }) => (
  <a
    href="#"
    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    }`}
    aria-current={active ? "page" : undefined}
  >
    <Icon className="h-4 w-4" />
    <span>{label}</span>
  </a>
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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-screen-2xl">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar p-4 md:block">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand to-primary" aria-hidden />
            <span className="text-lg font-semibold">Cekat AI</span>
          </div>
          <Separator className="my-4" />
          <nav className="flex flex-col gap-1">
            <NavItem icon={MessageSquare} label="Chat" active />
            <NavItem icon={Ticket} label="Tickets" />
            <NavItem icon={BarChart2} label="Analytics" />
            <NavItem icon={Users} label="Contacts" />
            <NavItem icon={Megaphone} label="Broadcasts" />
            <NavItem icon={PlugZap} label="Connected Platforms" />
            <NavItem icon={Bot} label="AI Agents" />
            <NavItem icon={ShieldCheck} label="Human Agents" />
          </nav>
          <div className="mt-auto hidden flex-col gap-1 pt-6 md:flex">
            <Separator className="mb-3" />
            <NavItem icon={Settings} label="Settings" />
            <NavItem icon={CreditCard} label="Billings" />
            <NavItem icon={UserRound} label="Profile" />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
              <div className="flex items-center gap-2 md:gap-3">
                <Button variant="secondary" className="hidden md:inline-flex">Help Center</Button>
                <Button variant="secondary">WA Support</Button>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="hidden sm:inline-flex bg-success text-success-foreground">Online</Badge>
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium">Audit 4</div>
                  <div className="text-xs text-muted-foreground">audit4@gmail.com</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">D</div>
              </div>
            </div>
          </header>

          {/* Content */}
          <section className="px-4 py-8 md:px-8">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Selamat datang kembali di Cekat AI!</h1>
            <div className="mt-6 grid gap-4 md:max-w-2xl">
              <StepCard step={1} title="Hubungkan Platform" description="Mulai terima pesan dari Whatsapp, IG, dan FB Anda!" emoji="📨" />
              <StepCard step={2} title="Buat AI Agent" description="Jawab pesan masuk dengan Agent AI Anda." emoji="🤖" />
              <StepCard step={3} title="Undang Agen Manusia" description="Undang tim Anda untuk membantu menjawab chat." emoji="🧑‍💼" />
              <StepCard step={4} title="Konek AI Agent ke Inbox" description="Hubungkan AI Agent dan Human Agent ke platform." emoji="🔗" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Butuh bantuan lebih? <a className="text-brand underline underline-offset-4" href="#">Lihat Tutorial Youtube kami</a></p>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Index;
