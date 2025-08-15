import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings, BookOpen, Zap, Users, BarChart3, Bot, Send, Loader2, RotateCcw, RefreshCw } from "lucide-react";
import { useAIProfiles, AIProfile } from "@/hooks/useAIProfiles";
import { toast } from "@/components/ui/sonner";

interface AIAgentSettingsProps {
  agentName: string;
  onBack: () => void;
  profileId?: string; // Optional profile ID to load specific profile
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const ChatPreview = ({ 
  welcomeMessage, 
  systemPrompt, 
  model, 
  temperature,
  transfer_conditions
}: { 
  welcomeMessage: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  transfer_conditions: string;
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: welcomeMessage || "Halo! 👋 Selamat datang di Okbang Top Up Center~",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate session ID on component mount
  useEffect(() => {
    const generateSessionId = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      const sessionId = `session_${timestamp}_${random}`;
      setSessionId(sessionId);
      console.log('Generated session ID:', sessionId);
    };
    
    generateSessionId();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Validate required fields
    if (!systemPrompt.trim()) {
      toast.error('Please configure the AI Agent Behavior first');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const requestBody = {
        message: inputMessage,
        system_prompt: systemPrompt + welcomeMessage + transfer_conditions,
        model: model,
        temperature: temperature,
        session_id: sessionId,
        timestamp: new Date().toISOString()
      };

      console.log('Sending request to API:', requestBody);

      const response = await fetch('https://primary-production-376c.up.railway.app/webhook/chat-ai-agent-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: data.output || "Sorry, I couldn't process your message.",
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      toast.success('Message sent successfully!');
      setIsConnected(true);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setIsConnected(false);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I'm having trouble connecting right now. Please try again later.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        content: welcomeMessage || "Halo! 👋 Selamat datang di Okbang Top Up Center~",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
    toast.info('Chat history cleared');
  };

  const refreshSession = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const newSessionId = `session_${timestamp}_${random}`;
    setSessionId(newSessionId);
    
    // Clear chat and reset to welcome message
    setMessages([
      {
        id: '1',
        content: welcomeMessage || "Halo! 👋 Selamat datang di Okbang Top Up Center~",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
    
    toast.success('Session refreshed! New session ID: ' + newSessionId);
    console.log('New session ID:', newSessionId);
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <span className="font-medium">AI Agent Chat</span>
          <div className="text-xs text-muted-foreground">
            Model: {model} • Temp: {temperature}
            <span className={`ml-2 px-1 rounded text-xs ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {sessionId && (
            <div className="text-xs text-muted-foreground mt-1">
              Session: {sessionId.substring(0, 20)}...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshSession}
            title="Refresh session"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            title="Clear chat history"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-4 overflow-auto max-h-96">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI is typing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded-lg text-sm resize-none"
            rows={2}
            disabled={isLoading}
          />
          <Button 
            size="sm" 
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </Card>
  );
};

const AIAgentSettings = ({ agentName, onBack, profileId }: AIAgentSettingsProps) => {
  const [activeTab, setActiveTab] = useState("general");
  
  // Use the custom hook for AI profile management
  const { profile, loading, saving, error, saveProfile } = useAIProfiles(profileId);
  
  // Form state - initialize with profile data or defaults
  const [systemPrompt, setSystemPrompt] = useState(profile?.system_prompt || "");
  const [welcomeMessage, setWelcomeMessage] = useState(profile?.welcome_message || "");
  const [transferConditions, setTransferConditions] = useState(profile?.transfer_conditions || "");
  const [stopAfterHandoff, setStopAfterHandoff] = useState(profile?.stop_ai_after_handoff ?? true);
  const [model, setModel] = useState(profile?.model || "gpt-4o-mini");
  const [temperature, setTemperature] = useState(profile?.temperature || 0.3);

  // Update form state when profile data loads
  useEffect(() => {
    if (profile) {
      setSystemPrompt(profile.system_prompt || "");
      setWelcomeMessage(profile.welcome_message || "");
      setTransferConditions(profile.transfer_conditions || "");
      setStopAfterHandoff(profile.stop_ai_after_handoff);
      setModel(profile.model || "gpt-4o-mini");
      setTemperature(profile.temperature || 0.3);
    }
  }, [profile]);

  // Save AI profile
  const handleSave = async () => {
    const updateData = {
      system_prompt: systemPrompt,
      welcome_message: welcomeMessage,
      transfer_conditions: transferConditions,
      stop_ai_after_handoff: stopAfterHandoff,
      model: model,
      temperature: temperature,
      name: agentName,
    };

    try {
      await saveProfile(updateData);
      toast.success('AI agent settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save AI agent settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading AI profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">{agentName}</h1>
        {profile && (
          <Badge variant="secondary">
            Last Updated: {new Date(profile.created_at).toLocaleDateString()}
          </Badge>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">Error: {error}</p>
        </div>
      )}

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
                    {profile?.name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{profile?.name || agentName}</h2>
                    <p className="text-muted-foreground">{profile?.description || 'AI Agent'}</p>
                    <p className="text-sm text-muted-foreground">
                      Last Updated: {profile ? new Date(profile.created_at).toLocaleString() : 'Never'}
                    </p>
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
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter system prompt..."
                />
                
                <div className="text-right text-xs text-muted-foreground">
                  {systemPrompt.length}/15000
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
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="Enter welcome message..."
                />
                
                <div className="text-right text-xs text-muted-foreground">
                  {welcomeMessage.length}/5000
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
                    value={transferConditions}
                    onChange={(e) => setTransferConditions(e.target.value)}
                    placeholder="Enter transfer conditions..."
                  />
                  <div className="text-right text-xs text-muted-foreground">
                    {transferConditions.length}/750
                  </div>
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

              {/* Model Settings */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-primary">Model Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Model</label>
                    <select 
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full p-2 border rounded-lg mt-1"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Temperature</label>
                    <input 
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full p-2 border rounded-lg mt-1"
                    />
                  </div>
                </div>
              </Card>

              {/* Additional Settings */}
              <Card className="p-6">
                <Button variant="ghost" className="text-primary p-0 h-auto font-semibold">
                  Additional Settings ↓
                </Button>
              </Card>

              {/* Save Button */}
              <Button 
                className="w-full" 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save AI Settings'
                )}
              </Button>
            </div>

            {/* Chat Preview */}
            <div className="lg:col-span-1">
              <ChatPreview 
                welcomeMessage={welcomeMessage} 
                systemPrompt={systemPrompt} 
                model={model} 
                temperature={temperature} 
                transfer_conditions={transferConditions}
              />
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