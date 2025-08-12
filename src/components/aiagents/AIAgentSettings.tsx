import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings, BookOpen, Zap, Users, BarChart3, Bot, Send } from "lucide-react";

interface AIAgentSettingsProps {
  agentName: string;
  onBack: () => void;
}

const ChatPreview = () => (
  <Card className="flex flex-col h-full">
    <div className="flex items-center gap-3 p-4 border-b">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Bot className="w-4 h-4" />
      </div>
      <span className="font-medium">OKBANG AI</span>
    </div>
    
    <div className="flex-1 p-4 space-y-4 overflow-auto">
      <div className="bg-muted p-3 rounded-lg max-w-[80%]">
        Halo! 👋 Selamat datang di Okbang Top Up Center~
        Aku Cathlyn, asisten kamu di sini. Siap bantuin semua pertanyaan seputar top up, layanan, dan info lainnya 🌟
        Langsung aja tanya yaa, biar aku bisa bantuin secepatnya! 😊
      </div>
    </div>
    
    <div className="p-4 border-t">
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Type your message..." 
          className="flex-1 p-2 border rounded-lg text-sm"
        />
        <Button size="sm">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  </Card>
);

const AIAgentSettings = ({ agentName, onBack }: AIAgentSettingsProps) => {
  const [activeTab, setActiveTab] = useState("general");
  const [stopAfterHandoff, setStopAfterHandoff] = useState(true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">{agentName}</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Knowledge Sources
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Zap className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="followups" className="gap-2">
            <Users className="w-4 h-4" />
            Followups
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Evaluation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Settings */}
            <div className="lg:col-span-2 space-y-6">
              {/* Agent Info */}
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                    OA
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{agentName}</h2>
                    <p className="text-muted-foreground">Cathlyn</p>
                    <p className="text-sm text-muted-foreground">Last Trained: Yesterday 18:23</p>
                  </div>
                </div>
              </Card>

              {/* AI Agent Behavior */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-primary">AI Agent Behavior</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ini adalah Prompt AI yang akan mengatur gaya bicara dan identitas AI nya.
                </p>
                
                <Textarea 
                  className="min-h-[200px] mb-4" 
                  defaultValue={`Nama: Cathlyn
Umur: 25-35 tahun
Peran: Customer Service Okbang Top Up Center

Gaya Bicara: Ramah, semi-formal ala Gen Z, komunikatif, responsif, dan pakai emoji buat memperiuas ekspresi.
Tugas Utama: Menjawab pertanyaan seputar layanan Okbang Top Up Center dengan jelas, singkat, dan membantu.

Metode Pembayaran VIA QRIS, DJ OKBANG Top Up Center - HSPAY, LNPAY, , POPAY, & VTPAY (Berikan 5 Macam QRIS yang tersedia kepada customer yang bertanya perihal Qris atau aja kamu sedang menjelaskan tentang apapun yang berkaitan dengan QRIS).

Bank / E-Wallet Status
BCA 24 Jam ✅
BNI 24 Jam ✅
CIMB 24 Jam ✅`}
                />
                
                <div className="text-right text-xs text-muted-foreground">
                  1656/15000
                </div>
              </Card>

              {/* Welcome Message */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2 text-primary">Welcome Message</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Pesan pertama yang akan dikirim AI kepada user.
                </p>
                <Button variant="outline" size="sm" className="mb-4">
                  Upload gambar untuk Welcome Message
                </Button>
                
                <Textarea 
                  className="min-h-[100px] mb-4" 
                  defaultValue={`Halo! 👋 Selamat datang di Okbang Top Up Center~
Aku Cathlyn, asisten kamu di sini. Siap bantuin semua pertanyaan seputar top up, layanan, dan info lainnya 🌟
Langsung aja tanya yaa, biar aku bisa bantuin secepatnya! 😊`}
                />
                
                <div className="text-right text-xs text-muted-foreground">
                  218/5000
                </div>
              </Card>

              {/* Agent Transfer Conditions */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-primary">Agent Transfer Conditions</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Tentukan kondisi yang akan memicu AI untuk mentransfer chat ke agen manusia. Status chat akan menjadi Pending dan akan muncul di tab Chat Assigned.
                </p>
                
                <div className="space-y-4">
                  <Textarea 
                    className="min-h-[80px]" 
                    defaultValue="Jika customer mengirimkan gambar, termasuk tangkapan layar atau foto lainnya, chat otomatis dialihkan ke agent manusia untuk penanganan lebih lanjut, pastikan selalu di tempat atau di oper ke human agent."
                  />
                  <div className="text-right text-xs text-muted-foreground">632/750</div>
                  
                  <Textarea 
                    className="min-h-[60px]" 
                    defaultValue="Jika terdeteksi kata-kata tidak sopan, kasar, atau spam, Cathlyn akan mengalihkan chat ke agent manusia untuk ditindaklanjuti lebih lanjut."
                  />
                </div>
              </Card>

              {/* Stop AI after Handoff */}
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Stop AI after Handoff</h3>
                    <p className="text-sm text-muted-foreground">
                      Hentikan AI mengirim pesan setelah status chat berubah menjadi Pending.
                    </p>
                  </div>
                  <Switch checked={stopAfterHandoff} onCheckedChange={setStopAfterHandoff} />
                </div>
              </Card>

              {/* Additional Settings */}
              <Card className="p-6">
                <Button variant="ghost" className="text-primary p-0 h-auto font-semibold">
                  Additional Settings ↓
                </Button>
              </Card>

              {/* Save Button */}
              <Button className="w-full">Save AI Settings</Button>
            </div>

            {/* Chat Preview */}
            <div className="lg:col-span-1">
              <ChatPreview />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Knowledge Sources</h3>
            <p className="text-muted-foreground">Configure knowledge sources for your AI agent.</p>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Integrations</h3>
            <p className="text-muted-foreground">Set up integrations with external services.</p>
          </Card>
        </TabsContent>

        <TabsContent value="followups">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Followups</h3>
            <p className="text-muted-foreground">Configure automated followup messages.</p>
          </Card>
        </TabsContent>

        <TabsContent value="evaluation">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Evaluation</h3>
            <p className="text-muted-foreground">Review AI agent performance metrics.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIAgentSettings;