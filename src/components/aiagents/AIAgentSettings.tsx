import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Settings, BookOpen, Zap, Users, BarChart3, Bot, Send, FileText, Globe, File, HelpCircle, Package, Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo, Redo, Edit3, Trash2, ChevronDown, Plus } from "lucide-react";

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
  const [followups, setFollowups] = useState([
    {
      id: 1,
      prompt: "BTW, lagi ada promo gokil buat kamu ni kak 🔥 Jangan sampai kelewatan. Klik Infonyq Disini 👈 https://imageshack.com/img922/6196/DvdgVP.png",
      delay: 2,
      optionsExpanded: false
    },
    {
      id: 2,
      prompt: "Terakbir nih, jujur aja... pelayanan kita udah kece belum kak? atau Ada yang bisa kita upgrade biar makin mantul? 🤔 Kalau sudah oke Hanya izin tutup percakapan kita dalam 3 menit kedepan ya, Salam JP 🙏",
      delay: 5,
      optionsExpanded: false
    }
  ]);

  const addFollowup = () => {
    const newFollowup = {
      id: Date.now(),
      prompt: "",
      delay: 1,
      optionsExpanded: false
    };
    setFollowups([...followups, newFollowup]);
  };

  const deleteFollowup = (id: number) => {
    setFollowups(followups.filter(f => f.id !== id));
  };

  const updateFollowup = (id: number, field: string, value: any) => {
    setFollowups(followups.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const toggleOptions = (id: number) => {
    setFollowups(followups.map(f => 
      f.id === id ? { ...f, optionsExpanded: !f.optionsExpanded } : f
    ));
  };

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

        <TabsContent value="knowledge" className="space-y-6">
          <Card className="p-6">
            {/* Knowledge Source Type Tabs */}
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="text" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="website" className="gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </TabsTrigger>
                <TabsTrigger value="file" className="gap-2">
                  <File className="w-4 h-4" />
                  File
                </TabsTrigger>
                <TabsTrigger value="qa" className="gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Q&A
                </TabsTrigger>
                <TabsTrigger value="product" className="gap-2">
                  <Package className="w-4 h-4" />
                  Product
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                {/* Add Button and Default Button */}
                <div className="flex gap-2 items-center">
                  <Button size="sm" className="gap-2">
                    <Edit3 className="w-4 h-4" />
                    Add
                  </Button>
                  <Button variant="outline" size="sm">
                    Default
                  </Button>
                </div>

                {/* Text Formatting Toolbar */}
                <div className="flex items-center gap-1 p-2 border rounded-md bg-muted/30">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Undo className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Redo className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Italic className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <AlignLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <AlignCenter className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <AlignRight className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <AlignJustify className="w-4 h-4" />
                  </Button>
                </div>

                {/* Content Areas */}
                <div className="space-y-4">
                  {/* Panduan Umum Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs">📖</span>
                      </div>
                      <span>Panduan Umum: Deposit, Withdraw & Tambah Rekening</span>
                    </div>
                    <div className="pl-6 space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-orange-500">⚠️</span>
                        <div>
                          <p className="font-medium">Cara Isi Saldo / Deposit</p>
                          <p className="text-muted-foreground">Lakukan transfer ke rekening tujuan yang tertera di menu DEPOSIT &gt; REKENING TUJUAN.</p>
                          <p className="text-muted-foreground">Gunakan metode ATM atau M-Banking (tidak tersedia autodebet).</p>
                          <p className="text-muted-foreground">Setelah transfer, wajib upload bukti transfer agar diproses lebih cepat.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Khusus Bank BCA Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs">🏦</span>
                      </div>
                      <span>Khusus Bank BCA</span>
                    </div>
                    <div className="pl-6 text-sm text-muted-foreground">
                      <p>Wajib menggunakan rekening BCA atas nama yang terdaftar di website.</p>
                      <p>Tidak bisa menggunakan rekening BCA milik orang lain.</p>
                    </div>
                  </div>

                  {/* Tambah Rekening Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs">💳</span>
                      </div>
                      <span>Tambah Rekening / E-Wallet</span>
                    </div>
                    <div className="pl-6 text-sm text-muted-foreground">
                      <p>Bisa menambahkan rekening atau e-wallet selama nama pemiliknya sama dengan yang sudah terdaftar.</p>
                      <p>Akses dari halaman utama &gt; klik menu REKENING &gt; TAMBAH REKENING.</p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Minimal deposit Via Bank BCA, MANDIRI, BRI, BNI, CIMB, OCBC, BANK JAGO, & Dan Semua Jenis E-wallet adalah 5.000</p>
                    <p>Minimal deposit QRIS = 10.000</p>
                    <p>Minimal withdraw Bank & E-wallet = 50.000</p>
                    <p>Jika menggunakan pulsa, akan dikenakan potongan 20%</p>
                  </div>

                  {/* Lupa User ID Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs">🔐</span>
                      </div>
                      <span>Lupa User ID atau Password?</span>
                    </div>
                    <div className="pl-6 text-sm text-muted-foreground">
                      <p>Format reset:</p>
                      <p>Nama Rekening :</p>
                      <p>Nomor Rekening :</p>
                      <p>Bank / E-wallet :</p>
                    </div>
                  </div>
                </div>

                {/* Character Count */}
                <div className="text-right text-xs text-muted-foreground">
                  10931 Characters
                </div>
              </TabsContent>

              <TabsContent value="website" className="space-y-6">
                {/* Provide Link Section */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Provide Link</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Provide a link to the page you want the AI to learn from.
                    </p>
                  </div>

                  {/* Batch/Single Link Toggle */}
                  <div className="flex gap-2">
                    <Button variant="default" size="sm" className="bg-muted text-foreground hover:bg-muted/80">
                      Batch Link
                    </Button>
                    <Button variant="outline" size="sm">
                      Single Link
                    </Button>
                  </div>
                </div>

                {/* Web Link Collector Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Web Link Collector</h3>
                  
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Link URL" 
                      className="flex-1"
                    />
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      Collect Link
                    </Button>
                  </div>

                  {/* Info Text */}
                  <div className="flex items-start gap-2 text-sm text-blue-600">
                    <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs">!</span>
                    </div>
                    <p>
                      Start with URL and this tool will gather up to <strong>30 unique</strong> links from the site, excluding any files
                    </p>
                  </div>
                </div>

                {/* Trained Link Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Trained Link</h3>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="select-all" className="rounded" />
                      <label htmlFor="select-all" className="text-sm text-blue-600 cursor-pointer">
                        Select
                      </label>
                    </div>
                    <Input 
                      placeholder="Search Links" 
                      className="flex-1"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="file">
                <div className="text-center py-12 text-muted-foreground">
                  <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>File uploads and document management</p>
                </div>
              </TabsContent>

              <TabsContent value="qa">
                <div className="text-center py-12 text-muted-foreground">
                  <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Question & Answer pairs configuration</p>
                </div>
              </TabsContent>

              <TabsContent value="product">
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Product knowledge and catalog integration</p>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Integrations</h3>
            <p className="text-muted-foreground">Set up integrations with external services.</p>
          </Card>
        </TabsContent>

        <TabsContent value="followups" className="space-y-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Followups</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Tambahkan pesan Followup yang akan dikirim kepada <span className="text-blue-600">pelanggan setelah jeda waktu tertentu</span>.</p>
                <p>Isi dengan prompt. Prompt adalah arahan yang AI akan pakai untuk menulis Followup sesuai dengan history chat dan knowledge anda.</p>
                <p>Anda juga bisa menulis kondisi Handoff to Agent anda di Prompt</p>
                <p className="text-blue-600">Anda bisa mengirim gambar di followup. Klik disini untuk Upload gambar.</p>
              </div>
            </div>

            {/* Followup Messages */}
            <div className="space-y-4">
              {followups.map((followup, index) => (
                <Card key={followup.id} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Prompt:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFollowup(followup.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <Textarea
                      value={followup.prompt}
                      onChange={(e) => updateFollowup(followup.id, 'prompt', e.target.value)}
                      className="min-h-[80px]"
                      placeholder="Enter followup message..."
                    />

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Delay (min):</span>
                        <Input
                          type="number"
                          value={followup.delay}
                          onChange={(e) => updateFollowup(followup.id, 'delay', parseInt(e.target.value) || 1)}
                          className="w-20"
                          min="1"
                        />
                      </div>
                    </div>

                    <Collapsible>
                      <CollapsibleTrigger
                        onClick={() => toggleOptions(followup.id)}
                        className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${followup.optionsExpanded ? 'rotate-180' : ''}`} />
                        Options
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="text-sm text-muted-foreground">
                          Additional options for this followup message can be configured here.
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </Card>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button onClick={addFollowup} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Followup
              </Button>
              <Button className="bg-green-600 hover:bg-green-700">
                Save Followups
              </Button>
            </div>
          </div>
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