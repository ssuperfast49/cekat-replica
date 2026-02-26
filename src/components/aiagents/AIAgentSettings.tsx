import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { Checkbox } from "@/components/ui/checkbox";

import { ArrowLeft, Settings, BookOpen, Zap, Users, BarChart3, Bot, Send, Loader2, RotateCcw, RefreshCw, FileText, Globe, File as FileIcon, HelpCircle, Package, Edit3, Undo, Redo, Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify, Trash2, ChevronDown, Plus, Save } from "lucide-react";
import useAIProfiles, { AIProfile } from "@/hooks/useAIProfiles";
import { toast } from "@/components/ui/sonner";
import WEBHOOK_CONFIG from "@/config/webhook";
import { callWebhook } from "@/lib/webhookClient";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/contexts/RBACContext";
import { useAuth } from "@/contexts/AuthContext";
import { getTemperatureValue } from '@/lib/temperatureUtils';
import { SUPABASE_URL } from '@/config/supabase';
import { FileUploadButton, AttachmentRenderer, StagedFilePreview, uploadFileToStorage, type UploadedFile, type StagedFile } from '@/components/chat/FileUploadButton';

interface AIAgentSettingsProps {
  agentName: string;
  onBack: () => void;
  profileId?: string; // Optional profile ID to load specific profile
  initialModelId?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'text' | 'image' | 'video' | 'file' | 'voice';
}

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

const ChatPreview = ({
  welcomeMessage,
  systemPrompt,
  modelDisplay,
  profile,
  profileId,
  modelName,
  temperature: legacyTemperature,
  transfer_conditions
}: {
  welcomeMessage: string;
  systemPrompt: string;
  modelDisplay: string;
  modelName: string;
  temperature: number;
  transfer_conditions: string;
  profile: any;
  profileId?: string;
}) => {
  // Get the actual temperature value from response_temperature preset
  // Use the mapped value from response_temperature if available, otherwise fallback to legacy temperature
  const responseTemperature = (profile as any)?.response_temperature;
  const actualTemperature = responseTemperature
    ? getTemperatureValue(responseTemperature, legacyTemperature || 0.5)
    : (legacyTemperature || 0.5);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Initialize messages with welcome message
  useEffect(() => {
    setMessages([
      {
        id: '1',
        content: welcomeMessage || profile?.welcome_message || "Halo! 👋 Selamat datang! Ada yang bisa saya bantu hari ini?",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
  }, [welcomeMessage]);


  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    if (scrollContainerRef.current) {
      // Scroll the container to the bottom instead of the entire page
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    // Allow sending if there's text OR a staged file
    if ((!inputMessage.trim() && !stagedFile) || isLoading) return;

    // Upload staged file first if present
    let uploadedFile: UploadedFile | null = null;
    if (stagedFile) {
      setIsUploadingFile(true);
      try {
        uploadedFile = await uploadFileToStorage(stagedFile.file);
      } catch (error: any) {
        console.error('File upload error:', error);
        toast.error(`Upload failed: ${error.message}`);
        setIsUploadingFile(false);
        return;
      }
      setIsUploadingFile(false);
      setStagedFile(null);
    }

    const displayContent = uploadedFile
      ? (inputMessage.trim() ? inputMessage : `📎 ${uploadedFile.fileName}`)
      : inputMessage;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: uploadedFile ? uploadedFile.url : inputMessage,
      sender: 'user',
      timestamp: new Date(),
      type: uploadedFile?.type || 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const requestBody = {
        message: inputMessage.trim() || (uploadedFile ? `[${uploadedFile.type === 'image' ? 'Image' : 'File'}: ${uploadedFile.fileName}]` : ''),
        model: modelName,
        temperature: actualTemperature, // Use the mapped temperature value from response_temperature preset
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        ai_profile_id: profile?.id || profileId,
        // Attachment fields (optional)
        ...(uploadedFile && {
          type: uploadedFile.type,
          file_name: uploadedFile.fileName,
          mime_type: uploadedFile.mimeType,
        }),
      };

      console.log('Sending request to API:', requestBody);

      const response = await callWebhook(WEBHOOK_CONFIG.ENDPOINTS.AI_AGENT.CHAT_TEST, {
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
        content: welcomeMessage || profile?.welcome_message || "Halo! 👋 Selamat datang! Ada yang bisa saya bantu hari ini?",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
    setStagedFile(null);
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
        content: welcomeMessage || profile?.welcome_message || "Halo! 👋 Selamat datang! Ada yang bisa saya bantu hari ini?",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);

    toast.success('Session refreshed! New session ID: ' + newSessionId);
    console.log('New session ID:', newSessionId);
  };

  return (
    <Card className="flex flex-col h-[600px] border-2 border-primary/20">
      <div className="flex items-center gap-3 p-4 border-b bg-primary/5">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <span className="font-medium">AI Agent Chat</span>
          <div className="text-xs text-muted-foreground">
            Model: {modelDisplay} • Temp: {responseTemperature || 'Legacy'} ({actualTemperature}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshSession}
                aria-label="Refresh session"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Segarkan sesi</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                aria-label="Clear chat history"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Hapus riwayat chat</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 p-4 space-y-4 overflow-auto max-h-[400px]">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${message.sender === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
                }`}
            >
              {/* Render attachment if present */}
              {message.type && message.type !== 'text' && (
                <div className="mb-2">
                  <AttachmentRenderer
                    fileLink={message.content}
                    type={message.type}
                  />
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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

      <div className="p-4 border-t bg-muted/30">
        {/* Staged file preview */}
        {stagedFile && (
          <div className="mb-2">
            <StagedFilePreview
              stagedFile={stagedFile}
              onRemove={() => setStagedFile(null)}
              isUploading={isUploadingFile}
            />
          </div>
        )}
        <div className="flex gap-2 items-start">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <FileUploadButton
                  onFileStaged={setStagedFile}
                  disabled={isLoading || isUploadingFile || !!stagedFile}
                  className="mt-2"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Lampirkan file</p>
            </TooltipContent>
          </Tooltip>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={stagedFile ? "Add a caption (optional)..." : "Type your message..."}
            className="flex-1 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary/20"
            rows={2}
            disabled={isLoading || isUploadingFile}
            title={isLoading ? 'Please wait…' : undefined}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={(!inputMessage.trim() && !stagedFile) || isLoading || isUploadingFile}
                className="px-4 mt-2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Kirim pesan ke agen AI</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </Card>
  );
};

// Local helpers for model UI
const formatProvider = (value: string | null | undefined) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown');

const formatCost = (value: number | null | undefined) => {
  if (value == null) return 'Pricing on request';
  return `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1 ? 2 : 3 }).format(value)} / 1M`;
};

const AIAgentSettings = ({ agentName, onBack, profileId, initialModelId }: AIAgentSettingsProps) => {
  const [activeTab, setActiveTab] = useState("general");
  const [knowledgeTab, setKnowledgeTab] = useState("text");
  const [expandedSections, setExpandedSections] = useState({
    behavior: true,
    welcome: true,
    transfer: false
  });
  const [isEditing, setIsEditing] = useState(profileId ? false : true);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isNewAgent = !profileId;
  const { hasPermission, hasRole } = useRBAC();
  const { user } = useAuth();
  const isMasterAgent = hasRole?.('master_agent');
  const isSuperAgent = hasRole?.('super_agent');
  const canUploadAgentFiles =
    hasPermission('ai_agent_files.manage') ||
    hasPermission('ai_agent_files.create') ||
    Boolean(isMasterAgent) ||
    Boolean(isSuperAgent);

  const clampNumber = (value: number, minVal: number, maxVal: number) => {
    if (Number.isNaN(value)) return minVal;
    return Math.min(maxVal, Math.max(minVal, value));
  };

  const HISTORY_PRACTICAL_MAX = 50;
  const HISTORY_HARD_MAX = 100;
  const CONTEXT_PRACTICAL_MAX = 40;
  const MESSAGE_PRACTICAL_MAX = 1000;
  const READ_FILE_HARD_MAX = 25;
  const AUTO_RESOLVE_MAX_MINUTES = 24 * 60; // 24 hours

  // Use the custom hook for AI profile management
  const { profile, loading, saving, error, saveProfile } = useAIProfiles(profileId);
  const [superAgentId, setSuperAgentId] = useState<string | null>(profile?.super_agent_id ?? null);
  const [superAgents, setSuperAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingSuperAgents, setLoadingSuperAgents] = useState(false);
  const [superAgentsError, setSuperAgentsError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.super_agent_id) {
      setSuperAgentId(profile.super_agent_id);
    } else if (isSuperAgent && user?.id) {
      setSuperAgentId(user.id);
    } else if (!profile?.super_agent_id) {
      setSuperAgentId(null);
    }
  }, [profile?.super_agent_id, isSuperAgent, user?.id]);

  // If creating a new agent and a super agent was chosen in the creation dialog, apply it
  useEffect(() => {
    if (isNewAgent && !superAgentId) {
      try {
        const fromCreate = localStorage.getItem('ai.new.super_agent_id');
        if (fromCreate) {
          setSuperAgentId(fromCreate);
          localStorage.removeItem('ai.new.super_agent_id');
        }
      } catch { }
    }
  }, [isNewAgent, superAgentId]);

  useEffect(() => {
    let isCancelled = false;
    const loadSuperAgents = async () => {
      try {
        setLoadingSuperAgents(true);
        setSuperAgentsError(null);
        const { data, error } = await supabase
          .from('v_human_agents' as any)
          .select('user_id, agent_name, email, role_name')
          .eq('org_id', profile?.org_id ?? DEFAULT_ORG_ID)
          .ilike('role_name', '%super%');

        if (error) throw error;
        if (isCancelled) return;

        const options = (data || []).map((row: any) => ({
          id: row.user_id as string,
          name: (row.agent_name as string) || (row.email as string) || String(row.user_id).slice(0, 8),
        }));
        setSuperAgents(options);

        if (!profile?.super_agent_id) {
          if (isSuperAgent && user?.id) {
            setSuperAgentId(user.id);
          } else if (options.length === 1 && !isSuperAgent && isMasterAgent) {
            setSuperAgentId(options[0].id);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setSuperAgentsError(err instanceof Error ? err.message : 'Failed to load super agents');
        }
      } finally {
        if (!isCancelled) {
          setLoadingSuperAgents(false);
        }
      }
    };
    loadSuperAgents();
    return () => {
      isCancelled = true;
    };
  }, [profile?.org_id, profile?.super_agent_id, isSuperAgent, isMasterAgent, user?.id]);

  // Form state - initialize with helpful placeholders for new agents or profile data
  const [systemPrompt, setSystemPrompt] = useState(
    isNewAgent
      ? "You are a helpful AI assistant for customer service. Be friendly, professional, and helpful. Always respond in Indonesian unless the customer speaks in another language."
      : profile?.system_prompt || ""
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    isNewAgent
      ? "Halo! 👋 Selamat datang! Ada yang bisa saya bantu hari ini?"
      : profile?.welcome_message || ""
  );
  const [transferConditions, setTransferConditions] = useState(
    isNewAgent
      ? "Transfer to human agent when:\n- Customer requests to speak with a human\n- Complex technical issues arise\n- Customer is dissatisfied or angry\n- Payment or billing issues\n- Escalation is needed"
      : profile?.transfer_conditions || ""
  );
  const [stopAfterHandoff, setStopAfterHandoff] = useState(profile?.stop_ai_after_handoff ?? true);
  // Model handling now uses ai_models (UUID) foreign key
  type AIModelOption = {
    id: string;
    model_name: string;
    display_name: string | null;
    provider: string;
    cost_per_1m_tokens?: number | null;
    description?: string | null;
    max_context_tokens?: number | null;
  };

  const [availableModels, setAvailableModels] = useState<AIModelOption[]>([]);
  const [fallbackModels, setFallbackModels] = useState<AIModelOption[]>([]);
  const [modelId, setModelId] = useState("");
  const [fallbackModelId, setFallbackModelId] = useState("");
  const [temperature, setTemperature] = useState(() => {
    const temp = (profile as any)?.temperature ?? 0.3;
    // Guard: ensure temperature is between 0-1
    return Math.max(0, Math.min(1, temp));
  });
  const [autoResolveMinutesInput, setAutoResolveMinutesInput] = useState<string>("");
  const [enableResolve, setEnableResolve] = useState<boolean>(Boolean((profile as any)?.enable_resolve ?? false));
  // Additional Settings
  const [historyLimitInput, setHistoryLimitInput] = useState<string>("");
  const [readFileLimit, setReadFileLimit] = useState<number>(() =>
    clampNumber((profile as any)?.read_file_limit ?? 3, 0, READ_FILE_HARD_MAX)
  );
  const [responseTemperature, setResponseTemperature] = useState<string>((profile as any)?.response_temperature ?? 'Balanced');
  const [messageAwait, setMessageAwait] = useState<number>((profile as any)?.message_await ?? 3);
  const [messageLimitInput, setMessageLimitInput] = useState<string>("");
  // Unassigned (open) follow-up settings
  const [enableFollowupUnassigned, setEnableFollowupUnassigned] = useState<boolean>(Boolean((profile as any)?.enable_followup_message ?? false));
  const [followupDelayUnassignedInput, setFollowupDelayUnassignedInput] = useState<string>("");
  // Assigned (pending) follow-up settings
  const [enableFollowupAssigned, setEnableFollowupAssigned] = useState<boolean>(Boolean((profile as any)?.enable_followup_assigned ?? false));
  const [followupDelayAssignedInput, setFollowupDelayAssignedInput] = useState<string>("");
  const [followupMessage, setFollowupMessage] = useState<string>(
    isNewAgent ? "" : (profile as any)?.followup_message || ""
  );
  const [guideContent, setGuideContent] = useState<string>(
    isNewAgent
      ? ""
      : (profile as any)?.guide_content || ""
  );

  const sanitizeNumericInput = (value: string) => value.replace(/[^0-9]/g, "");
  const parseNumericInput = (value: string) => {
    if (!value) return 0;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  // Load available AI models (separate regular and fallback)
  useEffect(() => {
    const loadModels = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('ai_models')
          .select('*')
          .eq('is_active', true)
          .order('display_name', { ascending: true });
        if (error) throw error;
        const allModels = (data || []) as any[];

        // Separate regular models from fallback models
        const regular = allModels.filter((m: any) => (m.display_name || '').toLowerCase() !== 'fallback');
        const fallback = allModels.filter((m: any) => (m.display_name || '').toLowerCase() === 'fallback');

        setAvailableModels(regular);
        setFallbackModels(fallback);

        // Initialize model IDs if not already set; prefer profile.model_id or initialModelId
        const preferredPrimary = (profile as any)?.model_id || initialModelId || '';
        if (!modelId) {
          if (preferredPrimary && regular.some((m: any) => m.id === preferredPrimary)) {
            setModelId(preferredPrimary);
          } else if (regular.length > 0) {
            setModelId(regular[0]?.id || "");
          }
        }
        if (!fallbackModelId && fallback.length > 0) {
          setFallbackModelId(fallback[0]?.id || "");
        }
      } catch (e) {
        console.error('Failed to load ai_models', e);
      }
    };
    loadModels();
  }, [profile?.id, initialModelId]);

  // If profile.model_id becomes available later and no selection yet, apply it
  useEffect(() => {
    if (!modelId && (profile as any)?.model_id && availableModels.some(m => m.id === (profile as any).model_id)) {
      setModelId((profile as any).model_id);
    }
  }, [availableModels]);

  useEffect(() => {
    if (!profile) return;
    const resolveMinutes = (profile as any)?.auto_resolve_after_minutes;
    setAutoResolveMinutesInput(
      typeof resolveMinutes === 'number' && !Number.isNaN(resolveMinutes)
        ? resolveMinutes.toString()
        : '0'
    );
    const history = clampNumber((profile as any)?.history_limit ?? HISTORY_PRACTICAL_MAX, 0, HISTORY_HARD_MAX);
    setHistoryLimitInput(history.toString());
    const message = clampNumber((profile as any)?.message_limit ?? MESSAGE_PRACTICAL_MAX, 0, MESSAGE_PRACTICAL_MAX);
    setMessageLimitInput(message.toString());

    const delayUnassigned = (profile as any)?.followup_message_delay ?? 60;
    setFollowupDelayUnassignedInput(delayUnassigned.toString());
    const delayAssigned = (profile as any)?.followup_delay_assigned ?? 60;
    setFollowupDelayAssignedInput(delayAssigned.toString());
  }, [profile?.id]);

  const selectedModel = availableModels.find(m => m.id === modelId) || null;

  const historyLimitMax = useMemo(() => {
    const tokens = selectedModel?.max_context_tokens;
    if (typeof tokens === 'number' && tokens > 0) {
      return clampNumber(tokens, 0, HISTORY_HARD_MAX);
    }
    return HISTORY_HARD_MAX;
  }, [selectedModel?.max_context_tokens]);

  useEffect(() => {
    if (!historyLimitInput) return;
    const numeric = parseInt(historyLimitInput, 10);
    if (Number.isNaN(numeric)) return;
    if (numeric > historyLimitMax) {
      setHistoryLimitInput(historyLimitMax.toString());
    }
  }, [historyLimitInput, historyLimitMax]);

  const handleAutoResolveChange = (raw: string) => {
    const sanitized = sanitizeNumericInput(raw);
    if (sanitized === "") {
      setAutoResolveMinutesInput("");
      return;
    }
    const clamped = clampNumber(parseInt(sanitized, 10), 0, AUTO_RESOLVE_MAX_MINUTES);
    setAutoResolveMinutesInput(clamped.toString());
  };

  const handleHistoryLimitChange = (raw: string) => {
    const sanitized = sanitizeNumericInput(raw);
    if (sanitized === "") {
      setHistoryLimitInput("");
      return;
    }
    const clamped = clampNumber(parseInt(sanitized, 10), 0, historyLimitMax);
    setHistoryLimitInput(clamped.toString());
  };

  const handleMessageLimitChange = (raw: string) => {
    const sanitized = sanitizeNumericInput(raw);
    if (sanitized === "") {
      setMessageLimitInput("");
      return;
    }
    const clamped = clampNumber(parseInt(sanitized, 10), 0, MESSAGE_PRACTICAL_MAX);
    setMessageLimitInput(clamped.toString());
  };

  // Knowledge: Files
  type KnowledgeFileStatus = 'uploading' | 'ready' | 'processing' | 'failed';
  interface KnowledgeFile {

    id: number | string;
    isEnabled?: boolean;
    name: string;
    size: number; // bytes
    uploadedAt: string; // ISO
    status: KnowledgeFileStatus;
    url?: string; // Supabase storage URL
    filePath?: string; // Storage path for deletion
  }
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);

  // Resolve org and profile IDs for storage pathing
  const getUploadContext = async (): Promise<{ orgId: string; profileId: string }> => {
    // Require an existing profile to ensure profile-scoped path
    const resolvedProfileId = profile?.id ?? profileId;
    if (!resolvedProfileId) {
      throw new Error('Please save the AI Agent first before uploading files.');
    }

    // Prefer org_id from loaded profile; fallback to first org membership of current user
    let resolvedOrgId: string | null = profile?.org_id ?? null;
    if (!resolvedOrgId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: membership } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        resolvedOrgId = membership?.org_id ?? null;
      }
    }

    if (!resolvedOrgId) {
      throw new Error('Could not determine your organization. Please re-login or contact support.');
    }

    return { orgId: resolvedOrgId, profileId: resolvedProfileId };
  };

  // Upload PDF to Supabase Storage after webhook processes/returns fileHash
  const uploadFileToSupabase = async (file: File, fileId: number): Promise<{ url: string; filePath: string; documentId?: string; fileId?: string }> => {
    try {
      if (!canUploadAgentFiles) {
        throw new Error('You do not have permission to upload agent files.');
      }
      // Enforce PDF-only uploads
      const isPdfMime = (file?.type || '').toLowerCase() === 'application/pdf';
      const isPdfExt = (file?.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdfMime && !isPdfExt) {
        throw new Error('Only PDF files are supported');
      }

      const { orgId, profileId: resolvedProfileId } = await getUploadContext();

      // Pre-compute content hash on the client to generate stable key and share with webhook
      let contentHash = '';
      try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
          const buffer = await file.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          contentHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        } else {
          // Fallback for environments where crypto.subtle is not available (e.g. non-secure contexts)
          console.warn('crypto.subtle not available, using fallback hash');
          const pseudoKey = `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`;
          // Simple DJB2-like hash for fallback uniqueness
          let hash = 5381;
          for (let i = 0; i < pseudoKey.length; i++) {
            hash = ((hash << 5) + hash) + pseudoKey.charCodeAt(i);
          }
          // Make it look somewhat like a hex hash using the number
          contentHash = (Math.abs(hash) + Date.now()).toString(16).padStart(64, '0');
        }
      } catch (err) {
        console.warn('Error computing hash, using standard fallback:', err);
        contentHash = `fallback-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      }

      // Build storage key using content hash and original base name
      const originalSafe = (file?.name || 'file.pdf').replace(/[^a-zA-Z0-9_.-]/g, '');
      const baseNoExt = originalSafe.replace(/\.pdf$/i, '');
      const generatedName = `${contentHash}_${baseNoExt}.pdf`;
      const fileKey = `org_${orgId}/profile_${resolvedProfileId}/${generatedName}`;

      const fileUrl = `${SUPABASE_URL}/storage/v1/object/ai-agent-files/${fileKey}`;

      // 0) Generate ID and insert into public.files to establish entity
      const fileIdUUID = crypto.randomUUID();
      const { error: dbErr } = await supabase.from('files').insert({
        id: fileIdUUID,
        org_id: orgId,
        ai_profile_id: resolvedProfileId,
        bucket: 'ai-agent-files',
        path: fileKey,
        filename: file.name,
        mime_type: file.type || 'application/pdf',
        byte_size: file.size,
        checksum: contentHash,
      });

      if (dbErr) {
        console.error('Error inserting into public.files:', dbErr);
        throw new Error('Failed to record file metadata');
      }

      // 1) Send to webhook for hashing, extraction, and knowledgebase indexing (include hash)
      // Moving metadata to Headers for higher reliability in n8n parsing
      const form = new FormData();
      form.append('file', file);

      const headers: Record<string, string> = {
        'x-file-name': file.name || 'file.pdf',
        'x-file-url': fileUrl,
        'x-org-id': orgId,
        'x-profile-id': resolvedProfileId,
        'x-file-hash': contentHash,
        'x-file-id': fileIdUUID
      };

      const resp = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.KNOWLEDGE.FILE_UPLOAD), {
        method: 'POST',
        headers: headers,
        body: form,
      });
      if (!resp.ok) {
        let message = `Upload failed (${resp.status})`;
        try { const j = await resp.json(); message = j?.message || message; } catch { }
        throw new Error(message);
      }
      const data = await resp.json().catch(() => ({} as any));

      const documentId = (data?.document_id || data?.documentId || undefined) as string | undefined;
      const status = String(data?.status || '').toLowerCase();
      if (status === 'duplicate') {
        // Don't upload; file already exists. Signal caller to skip
        const err: any = new Error('duplicate');
        err.code = 'DUPLICATE_CONTENT';
        throw err;
      }
      if (status !== 'success') {
        throw new Error(`Upload webhook returned unexpected status: ${status || 'unknown'}`);
      }
      // 2) Proceed to upload using our precomputed key

      // 3) Upload original PDF to private bucket 'ai-agent-files'
      let uploadedUrl: string | null = null;
      const { error: uploadErr } = await supabase.storage
        .from('ai-agent-files')
        .upload(fileKey, file, {
          cacheControl: '31536000',
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadErr) {
        // If object exists (duplicate via dedup hash), treat as success
        const alreadyExists = typeof uploadErr?.message === 'string' && /exists|duplicate|409/i.test(uploadErr.message);
        if (!alreadyExists) {
          throw uploadErr;
        }
      }

      // 4) Create a signed URL for UI preview/download
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('ai-agent-files')
        .createSignedUrl(fileKey, 60 * 60 * 24 * 7);
      if (!signedErr && signedData?.signedUrl) {
        uploadedUrl = signedData.signedUrl;
      }

      return { url: uploadedUrl || '', filePath: fileKey, documentId, fileId: fileIdUUID };
    } catch (error: any) {
      console.error('Error uploading file to Supabase:', error);
      throw new Error(`Failed to upload ${file.name}: ${error?.message || 'Unknown error'}`);
    }
  };

  // Load existing files from DB for this agent (formerly storage)
  const loadExistingKnowledgeFiles = async () => {
    try {
      setLoadingFiles(true);
      const { orgId, profileId: resolvedProfileId } = await getUploadContext();

      // Fetch from publicly tracking 'files' table which includes 'is_enabled' status
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('ai_profile_id', resolvedProfileId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items: KnowledgeFile[] = (data || []).map((f: any) => ({
        id: f.id,
        name: f.filename,
        size: f.byte_size || 0,
        uploadedAt: f.created_at,
        status: 'ready',
        url: '', // Signed URLs can be generated on demand or pre-fetched if needed for download
        filePath: f.path,
        isEnabled: f.is_enabled ?? true,
      }));

      // Generate signed URLs for them (optional, but good for 'Download' button)
      // We can do this in batch or just leave empty and let a download handler fetch it?
      // For now, let's keep it simple. If we need download, we need signed URL.
      // We can iterate and sign them.
      await Promise.all(items.map(async (item) => {
        if (item.filePath) {
          const { data: signedData } = await supabase.storage
            .from('ai-agent-files')
            .createSignedUrl(item.filePath, 60 * 60 * 24 * 7);
          if (signedData?.signedUrl) item.url = signedData.signedUrl;
        }
      }));

      setKnowledgeFiles(items);
    } catch (e: any) {
      console.error('Failed to load knowledge files:', e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleToggleFile = async (fileId: number | string, currentStatus: boolean) => {
    // Optimistic update
    setKnowledgeFiles(prev => prev.map(f => f.id === fileId ? { ...f, isEnabled: !currentStatus } : f));

    // Only update DB if it's a real persistent ID (UUID string)
    if (typeof fileId === 'string') {
      try {
        const { error } = await supabase
          .from('files')
          .update({ is_enabled: !currentStatus } as any)
          .eq('id', fileId);

        if (error) throw error;
      } catch (err: any) {
        toast.error('Failed to update status');
        // Revert
        setKnowledgeFiles(prev => prev.map(f => f.id === fileId ? { ...f, isEnabled: currentStatus } : f));
      }
    }
  };

  // Load files whenever the File tab is active (and when profile context changes)
  useEffect(() => {
    if (knowledgeTab === 'file') {
      loadExistingKnowledgeFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeTab, profile?.id, profileId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files || []);
    if (allFiles.length === 0) return;
    if (allFiles.length > 1) {
      toast.error('Please upload one file at a time.');
      return;
    }

    // Filter for PDF only
    const files = allFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (files.length < allFiles.length) {
      toast.error('Only PDF files are supported. Some files were skipped.');
    }

    if (files.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Ensure IDs are available for pathing
    try {
      await getUploadContext();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to upload at this time');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const now = new Date().toISOString();

    // Add files with uploading status first
    const newItems: KnowledgeFile[] = files.map((f) => ({
      id: Date.now() + Math.random(),
      name: f.name,
      size: f.size,
      uploadedAt: now,
      status: 'uploading' as KnowledgeFileStatus,
    }));

    setKnowledgeFiles((prev) => [...newItems, ...prev]);

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileItem = newItems[i];

      try {
        const { url, filePath, fileId: newDbId } = await uploadFileToSupabase(file, fileItem.id as any);

        // Update file status to ready with URL, swap to real DB ID, set enabled
        setKnowledgeFiles((prev) => prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: 'ready' as KnowledgeFileStatus, url, filePath, id: newDbId || f.id, isEnabled: true }
            : f
        ));

        toast.success(`${file.name} uploaded successfully!`);
      } catch (error: any) {
        // Special-case duplicate: mark as ready and refresh listing without creating new object
        if (String(error?.message || '').toLowerCase().includes('duplicate') || error?.code === 'DUPLICATE_CONTENT') {
          setKnowledgeFiles((prev) => prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'ready' as KnowledgeFileStatus }
              : f
          ));
          setTimeout(() => { (loadExistingKnowledgeFiles() as any)?.catch?.(() => { }); }, 0);
          toast.info(`${file.name} already exists. Skipped re-upload.`);
          continue;
        }
        // Update file status to failed
        setKnowledgeFiles((prev) => prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: 'failed' as KnowledgeFileStatus }
            : f
        ));

        toast.error(error.message || `Failed to upload ${file.name}`);
      }
    }

    // reset input so same files can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dtFiles = Array.from(e.dataTransfer.files || []);
    if (dtFiles.length === 0) return;
    if (dtFiles.length > 1) {
      toast.error('Please upload one file at a time.');
      return;
    }

    // Filter for PDF only
    const validFiles = dtFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (validFiles.length < dtFiles.length) {
      toast.error('Only PDF files are supported. Some files were skipped.');
    }

    if (validFiles.length === 0) return;

    // Ensure IDs are available for pathing
    try {
      await getUploadContext();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to upload at this time');
      return;
    }

    const now = new Date().toISOString();

    // Add files with uploading status first
    const newItems: KnowledgeFile[] = validFiles.map((f) => ({
      id: Date.now() + Math.random(),
      name: f.name,
      size: f.size,
      uploadedAt: now,
      status: 'uploading' as KnowledgeFileStatus,
    }));

    setKnowledgeFiles((prev) => [...newItems, ...prev]);

    // Upload each file
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const fileItem = newItems[i];

      try {
        const { url, filePath } = await uploadFileToSupabase(file, fileItem.id as any);

        // Update file status to ready with URL
        setKnowledgeFiles((prev) => prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: 'ready' as KnowledgeFileStatus, url, filePath }
            : f
        ));

        toast.success(`${file.name} uploaded successfully!`);
      } catch (error: any) {
        // Update file status to failed
        setKnowledgeFiles((prev) => prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: 'failed' as KnowledgeFileStatus }
            : f
        ));

        toast.error(error.message || `Failed to upload ${file.name}`);
      }
    }
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const removeKnowledgeFile = async (id: number | string) => {
    const file = knowledgeFiles.find(f => f.id === id);
    try {
      const { orgId, profileId: resolvedProfileId } = await getUploadContext();
      const params = new URLSearchParams({
        org_id: orgId,
        profile_id: resolvedProfileId,
        file_key: file?.filePath || '',
        file_id: String(file?.id || ''),
      });

      const resp = await fetch(`${WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.KNOWLEDGE.FILE_DELETE)}?${params.toString()}`, {
        method: 'POST'
      });

      if (!resp.ok) {
        let message = `Delete failed (${resp.status})`;
        try { const j = await resp.json(); message = j?.message || message; } catch { }
        throw new Error(message);
      }
      // Require explicit confirmation from webhook
      let payload: any = {};
      try { payload = await resp.json(); } catch { }
      const st = String(payload?.status || '').toLowerCase();
      if (st !== 'deleted') {
        throw new Error(payload?.message || 'Delete not confirmed by webhook');
      }
      setKnowledgeFiles((prev) => prev.filter((f) => f.id !== id));
      toast.info(`${file?.name || 'File'} removed`);
    } catch (err: any) {
      console.error('Error deleting file via webhook:', err);
      toast.error(err?.message || 'Failed to delete file');
    }
  };
  const processKnowledgeFile = (id: number) => {
    setKnowledgeFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'processing' } : f)));
    setTimeout(() => {
      setKnowledgeFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'ready' } : f)));
      toast.success('File processed');
    }, 900);
  };

  const downloadKnowledgeFile = async (file: KnowledgeFile) => {
    try {
      const path = file.filePath;
      if (!path) throw new Error('Missing file path');
      const { data, error } = await supabase.storage
        .from('ai-agent-files')
        .createSignedUrl(path, 60 * 60, { download: file.name || 'file.pdf' });
      if (error) throw error;
      const href = data?.signedUrl || file.url || '';
      if (!href) throw new Error('Unable to generate download link');
      const a = document.createElement('a');
      a.href = href;
      a.download = file.name || '';
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to download file');
    }
  };
  const clearKnowledgeFiles = async () => {
    const files = knowledgeFiles.filter(f => f.filePath);
    if (files.length > 0) {
      try {
        const { orgId, profileId: resolvedProfileId } = await getUploadContext();
        await Promise.all(files.map(async (f) => {
          try {
            const params = new URLSearchParams({
              org_id: orgId,
              profile_id: resolvedProfileId,
              file_key: f.filePath || '',
              file_id: String(f.id || ''),
              document_id: (f as any)?.documentId || ''
            });

            const resp = await fetch(`${WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.KNOWLEDGE.FILE_DELETE)}?${params.toString()}`, {
              method: 'POST'
            });

            if (!resp.ok) {
              let message = `Delete failed (${resp.status})`;
              try { const j = await resp.json(); message = j?.message || message; } catch { }
              console.warn('Delete webhook failed for', f.filePath, message);
            } else {
              // Confirm webhook success status
              let payload: any = {};
              try { payload = await resp.json(); } catch { }
              const st = String(payload?.status || '').toLowerCase();
              if (st !== 'deleted') {
                console.warn('Delete webhook did not confirm deletion for', f.filePath, st);
              }
            }
          } catch (e) {
            console.warn('Delete webhook error for', f.filePath, e);
          }
        }));
      } catch (e) {
        console.error('Error clearing files via webhook:', e);
      }
    }
    setKnowledgeFiles([]);
    toast.info('All files cleared');
  };

  // Knowledge: Q&A
  interface QAPair { id: number; question: string; answer: string; }
  const [qaPairs, setQaPairs] = useState<QAPair[]>([
    { id: Date.now(), question: '', answer: '' },
  ]);
  // Keep a baseline copy to detect changes per pair
  const [initialQaPairs, setInitialQaPairs] = useState<QAPair[]>([
    { id: Date.now(), question: '', answer: '' },
  ]);
  const addQaPair = () => {
    const newPair: QAPair = { id: Date.now() + Math.random(), question: '', answer: '' };
    setQaPairs((prev) => [newPair, ...prev]);
    // Add the same baseline so Save stays hidden until user types
    setInitialQaPairs((prev) => [JSON.parse(JSON.stringify(newPair)), ...prev]);
  };
  const removeQaPair = (id: number) => {
    setQaPairs((prev) => prev.filter((p) => p.id !== id));
    setInitialQaPairs((prev) => prev.filter((p) => p.id !== id));
  };
  const updateQaPair = (id: number, field: 'question' | 'answer', value: string) => {
    setQaPairs((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } as QAPair : p)));
  };
  const isPairDirty = (pair: QAPair) => {
    const base = initialQaPairs.find((p) => p.id === pair.id);
    const q = (pair.question || '').trim();
    const a = (pair.answer || '').trim();
    if (!base) {
      return q !== '' || a !== '';
    }
    return q !== (base.question || '').trim() || a !== (base.answer || '').trim();
  };

  // Followups state
  const [followups, setFollowups] = useState([
    { id: 1, prompt: "Hai! Ada yang bisa saya bantu lagi?", delay: 60, expanded: false },
    { id: 2, prompt: "Jika ada pertanyaan lain, jangan ragu untuk bertanya!", delay: 120, expanded: false }
  ]);

  // Followups functions
  const addFollowup = () => {
    const newFollowup = {
      id: Date.now(),
      prompt: "",
      delay: 60,
      expanded: false
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
      f.id === id ? { ...f, expanded: !f.expanded } : f
    ));
  };

  const resetForm = () => {
    if (profile && !isNewAgent) {
      setSystemPrompt(profile.system_prompt || "");
      setWelcomeMessage(profile.welcome_message || "");
      setTransferConditions(profile.transfer_conditions || "");
      setStopAfterHandoff(profile.stop_ai_after_handoff);
      setAutoResolveMinutesInput(String((profile as any)?.auto_resolve_after_minutes ?? 0));
      setEnableResolve(Boolean((profile as any)?.enable_resolve ?? false));
      setHistoryLimitInput(String(clampNumber((profile as any)?.history_limit ?? HISTORY_PRACTICAL_MAX, 0, HISTORY_HARD_MAX)));
      setReadFileLimit(clampNumber((profile as any)?.read_file_limit ?? 3, 0, READ_FILE_HARD_MAX));
      setResponseTemperature((profile as any)?.response_temperature ?? 'Balanced');
      setMessageAwait((profile as any)?.message_await ?? 3);
      setMessageLimitInput(String(clampNumber((profile as any)?.message_limit ?? MESSAGE_PRACTICAL_MAX, 0, MESSAGE_PRACTICAL_MAX)));
      setEnableFollowupUnassigned(Boolean((profile as any)?.enable_followup_message ?? false));
      setFollowupDelayUnassignedInput(String((profile as any)?.followup_message_delay ?? 60));
      setEnableFollowupAssigned(Boolean((profile as any)?.enable_followup_assigned ?? false));
      setFollowupDelayAssignedInput(String((profile as any)?.followup_delay_assigned ?? 60));
      setFollowupMessage(profile.followup_message || "");

      const qna = (profile as any)?.qna as ({ q: string; a: string } | { question: string; answer: string })[] | null | undefined;
      if (qna && Array.isArray(qna)) {
        const pairs = qna.map((item, idx) => ({ id: Date.now() + idx, question: (item as any).q ?? (item as any).question ?? '', answer: (item as any).a ?? (item as any).answer ?? '' }));
        setQaPairs(pairs);
        setInitialQaPairs(JSON.parse(JSON.stringify(pairs)));
      }
      setGuideContent((profile as any)?.guide_content || "");
    }
  };

  // Update form state when profile data loads (only for existing agents)
  useEffect(() => {
    resetForm();
  }, [profile, isNewAgent]);

  // For new agents, set initial baseline equal to the starter pair once at mount
  useEffect(() => {
    if (isNewAgent) {
      setInitialQaPairs(JSON.parse(JSON.stringify(qaPairs)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save AI profile
  const handleSave = async () => {
    if (!superAgentId) {
      toast.error('Please assign a super agent before saving this AI agent.');
      return;
    }

    const autoResolveMinutes = clampNumber(parseNumericInput(autoResolveMinutesInput), 0, AUTO_RESOLVE_MAX_MINUTES);
    const historyLimit = clampNumber(parseNumericInput(historyLimitInput), 0, historyLimitMax);
    const messageLimit = clampNumber(parseNumericInput(messageLimitInput), 0, MESSAGE_PRACTICAL_MAX);
    const followupDelayUnassigned = parseNumericInput(followupDelayUnassignedInput);
    const followupDelayAssigned = parseNumericInput(followupDelayAssignedInput);

    // Context window is no longer user-configurable in the UI.
    // Persist an existing value (or a sensible default) clamped to the selected model capability.
    const derivedContextLimitMaxK = (() => {
      const tokens = selectedModel?.max_context_tokens;
      if (typeof tokens === 'number' && tokens > 0) return Math.max(1, Math.floor(tokens / 1000));
      return CONTEXT_PRACTICAL_MAX;
    })();
    const contextLimit = clampNumber(
      clampNumber((profile as any)?.context_limit ?? 28, 0, CONTEXT_PRACTICAL_MAX),
      0,
      derivedContextLimitMaxK
    );

    const updateData = {
      system_prompt: systemPrompt,
      welcome_message: welcomeMessage,
      transfer_conditions: transferConditions,
      stop_ai_after_handoff: stopAfterHandoff,
      model_id: modelId || null,
      name: agentName,
      auto_resolve_after_minutes: autoResolveMinutes,
      enable_resolve: enableResolve,
      history_limit: historyLimit,
      read_file_limit: readFileLimit,
      context_limit: contextLimit,
      response_temperature: responseTemperature,
      message_await: messageAwait,
      message_limit: messageLimit,
      super_agent_id: superAgentId,
      enable_followup_message: enableFollowupUnassigned,
      followup_message_delay: followupDelayUnassigned,
      enable_followup_assigned: enableFollowupAssigned,
      followup_delay_assigned: followupDelayAssigned,
      followup_message: followupMessage,
      // Persist Q&A pairs into ai_profiles.qna JSONB
      // Store compact q/a pairs for space efficiency
      qna: qaPairs
        .filter((p) => (p.question?.trim() || p.answer?.trim()))
        .map(({ question, answer }) => ({ q: question.trim(), a: answer.trim() })),
      guide_content: guideContent,
    };

    try {
      await saveProfile(updateData);
      setIsEditing(false);
      toast.success(isNewAgent ? 'AI agent created successfully!' : 'AI agent settings saved successfully!');
    } catch (error) {
      toast.error(isNewAgent ? 'Failed to create AI agent' : 'Failed to save AI agent settings');
    }
  };

  const handleSaveText = async () => {
    try {
      await saveProfile({
        name: agentName,
        guide_content: guideContent,
      });
      toast.success('Knowledge text saved');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save knowledge text');
    }
  };

  const handleSaveQA = async () => {
    try {
      await saveProfile({
        name: agentName,
        qna: qaPairs
          .filter((p) => (p.question?.trim() || p.answer?.trim()))
          .map(({ question, answer }) => ({ q: question.trim(), a: answer.trim() })),
      });
      setInitialQaPairs(JSON.parse(JSON.stringify(qaPairs)));
      toast.success('Q&A saved');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save Q&A');
    }
  };

  if (loading && !isNewAgent) {
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Kembali ke daftar agen AI</p>
          </TooltipContent>
        </Tooltip>
        <h1 className="text-2xl font-bold">{agentName}</h1>
        {isNewAgent ? (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            New Agent
          </Badge>
        ) : profile && (
          <Badge variant="secondary">
            Last Updated: {new Date(profile.created_at).toLocaleDateString()}
          </Badge>
        )}

        {!loading && (
          <div className="ml-auto flex items-center gap-2">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Settings
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isNewAgent) {
                    onBack();
                  } else {
                    setIsEditing(false);
                    resetForm();
                  }
                }}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Cancel
              </Button>
            )}
          </div>
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
        <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 rounded-lg">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40 transition-colors"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>General</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Konfigurasi pengaturan umum agen AI</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40 transition-colors"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Knowledge Sources</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Kelola sumber pengetahuan dan pasangan T&J</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
          {/* <TabsTrigger value="integrations" className="gap-2">
            <Zap className="w-4 h-4" />
            Integrations
          </TabsTrigger> */}
          {/* <TabsTrigger value="followups" className="gap-2">
            <Users className="w-4 h-4" />
            Followups
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Evaluation
          </TabsTrigger> */}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Main Settings */}
            <div className="xl:col-span-3 space-y-4">
              {/* Agent Info */}
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                    {agentName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{agentName}</h2>
                    <p className="text-muted-foreground">
                      {isNewAgent ? 'New AI Agent - Configure your settings below' : profile?.description || 'AI Agent'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isNewAgent ? 'Not saved yet' : `Last Updated: ${profile ? new Date(profile.created_at).toLocaleString() : 'Never'}`}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 pt-4">
                  <span className="text-sm font-medium">Assigned Super Agent</span>
                  {loadingSuperAgents ? (
                    <div className="text-sm text-muted-foreground">Loading super agents...</div>
                  ) : superAgentsError ? (
                    <div className="text-sm text-destructive">{superAgentsError}</div>
                  ) : isSuperAgent && user?.id ? (
                    <div className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                      <span>👤 {superAgents.find((option) => option.id === user.id)?.name || user.email || 'You'}</span>
                      <Badge variant="secondary">Your account</Badge>
                    </div>
                  ) : superAgents.length === 0 ? (
                    <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      No super agents available. Create a super agent first before assigning this AI agent.
                    </div>
                  ) : (
                    <Select
                      value={superAgentId || ''}
                      onValueChange={(value) => setSuperAgentId(value)}
                      disabled={!isMasterAgent || !isEditing}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a super agent" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        {superAgents.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            👤 {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Only the assigned super agent and their human agents can view and use this AI agent.
                  </p>
                </div>
              </Card>

              {/* Model Selection */}
              <Card className="p-4">
                <div className="space-y-6">
                  {/* Primary AI Model */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-primary">AI Model</h3>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Pilih model AI yang menentukan kecepatan dan kualitas respons.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Choose the balance between speed and intelligence for this agent.
                        </p>
                      </div>
                      {selectedModel && (
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {formatProvider((selectedModel as any)?.provider)}
                        </Badge>
                      )}
                    </div>

                    <Select
                      value={modelId}
                      onValueChange={setModelId}
                      disabled={availableModels.length === 0 || !isEditing}
                    >
                      <SelectTrigger className="w-full py-3">
                        {selectedModel ? (
                          <span className="flex w-full items-center gap-2 text-sm font-medium truncate pr-2">
                            <span className="truncate">
                              {(selectedModel as any)?.display_name || 'Custom'} · {formatCost((selectedModel as any)?.cost_per_1m_tokens)} · {formatProvider((selectedModel as any)?.provider)}
                            </span>
                          </span>
                        ) : (
                          <SelectValue placeholder="Select an AI model" />
                        )}
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        {availableModels.map((model) => {
                          return (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex flex-col text-left">
                                <span className="font-semibold leading-tight">{(model as any)?.display_name || 'Custom'} · {formatCost((model as any)?.cost_per_1m_tokens)}</span>
                                <span className="text-xs text-muted-foreground leading-tight">
                                  {(model as any)?.description || 'No description available'}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {(model as any)?.model_name} · {formatProvider((model as any)?.provider)}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {availableModels.length === 0 && (
                      <p className="text-xs text-destructive mt-2">
                        No AI models available. Please contact your administrator.
                      </p>
                    )}
                  </div>

                  {/* Fallback Model */}
                  {fallbackModels.length > 0 && (
                    <div className="border-t pt-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-primary">Fallback Model</h3>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Model yang digunakan secara otomatis jika model utama tidak tersedia.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Automatic backup model used when primary model is unavailable.
                          </p>
                        </div>
                        {fallbackModels.find(m => m.id === fallbackModelId) && (
                          <Badge variant="secondary" className="whitespace-nowrap">
                            {formatProvider((fallbackModels.find(m => m.id === fallbackModelId) as any)?.provider)}
                          </Badge>
                        )}
                      </div>

                      <Select
                        value={fallbackModelId}
                        onValueChange={setFallbackModelId}
                        disabled={fallbackModels.length === 0 || !isEditing}
                      >
                        <SelectTrigger className="w-full py-3">
                          {fallbackModels.find(m => m.id === fallbackModelId) ? (
                            <span className="flex w-full items-center gap-2 text-sm font-medium truncate pr-2">
                              <span className="truncate">
                                {(fallbackModels.find(m => m.id === fallbackModelId) as any)?.display_name || 'Custom'} · {formatCost((fallbackModels.find(m => m.id === fallbackModelId) as any)?.cost_per_1m_tokens)} · {formatProvider((fallbackModels.find(m => m.id === fallbackModelId) as any)?.provider)}
                              </span>
                            </span>
                          ) : (
                            <SelectValue placeholder="Select a fallback model" />
                          )}
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          {fallbackModels.map((model) => {
                            return (
                              <SelectItem key={model.id} value={model.id}>
                                <div className="flex flex-col text-left">
                                  <span className="font-semibold leading-tight">{(model as any)?.display_name || 'Custom'} · {formatCost((model as any)?.cost_per_1m_tokens)}</span>
                                  <span className="text-xs text-muted-foreground leading-tight">
                                    {(model as any)?.description || 'No description available'}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    {(model as any)?.model_name} · {formatProvider((model as any)?.provider)}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>

              {/* AI Agent Behavior */}
              <Card className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('behavior')}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-primary">AI Agent Behavior</h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Konfigurasi kepribadian dan perilaku agen AI untuk menentukan cara berinteraksi dengan pelanggan</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure AI personality and behavior
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.behavior ? 'rotate-180' : ''}`} />
                </div>

                {expandedSections.behavior && (
                  <div className="mt-4 space-y-4">
                    <Textarea
                      className="min-h-[120px]"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      disabled={!isEditing}
                      placeholder={isNewAgent ?
                        "Define your AI's personality, behavior, and capabilities here..." :
                        "Enter system prompt..."
                      }
                    />

                    <div className="text-right text-xs text-muted-foreground">
                      {systemPrompt.length}/15000
                    </div>
                  </div>
                )}
              </Card>

              {/* Welcome Message */}
              <Card className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('welcome')}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-primary">Welcome Message</h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Pesan selamat datang yang dikirim otomatis kepada pelanggan saat memulai percakapan</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      First message sent to users
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.welcome ? 'rotate-180' : ''}`} />
                </div>

                {expandedSections.welcome && (
                  <div className="mt-4 space-y-4">
                    <Textarea
                      className="min-h-[80px]"
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      disabled={!isEditing}
                      placeholder={isNewAgent ?
                        "This is the first message your AI will send to customers..." :
                        "Enter welcome message..."
                      }
                    />

                    <div className="text-right text-xs text-muted-foreground">
                      {welcomeMessage.length}/5000
                    </div>

                    <div className="pt-4 border-t space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Auto Follow-up Message</label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Kirim pesan otomatis kedua jika tidak ada aktivitas lebih lanjut dari kedua pihak setelah waktu tertentu.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="text-xs text-muted-foreground">Automatically nudge users after inactivity (configure separately for Unassigned and Assigned threads)</p>
                        </div>
                      </div>

                      {/* Shared Follow-up Message Template */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-primary">Follow-up Template</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Contoh: "Halo, apakah ada yang bisa saya bantu lagi? Jika tidak ada, tiket ini akan saya tutup."</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Textarea
                          className="min-h-[80px]"
                          value={followupMessage}
                          onChange={(e) => setFollowupMessage(e.target.value)}
                          placeholder="Enter follow-up message (shared for both Unassigned and Assigned)..."
                          disabled={!isEditing}
                        />
                        <div className="text-right text-xs text-muted-foreground">
                          {followupMessage.length}/5000
                        </div>
                      </div>

                      {/* Unassigned Follow-up Settings */}
                      <div className="border rounded-lg p-4 space-y-4 bg-orange-50/30 dark:bg-orange-950/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium">Unassigned Threads</label>
                              <span className="text-xs px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300">AI Handling</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Trigger follow-up when AI is handling the conversation</p>
                          </div>
                          <Switch
                            checked={enableFollowupUnassigned}
                            onCheckedChange={setEnableFollowupUnassigned}
                            disabled={!isEditing}
                          />
                        </div>
                        {enableFollowupUnassigned && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium text-primary">Inactivity Timeout (seconds)</label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Waktu dalam detik sebelum pesan tindak lanjut dikirim untuk percakapan Unassigned.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="e.g. 120"
                              value={followupDelayUnassignedInput}
                              onChange={(e) => setFollowupDelayUnassignedInput(sanitizeNumericInput(e.target.value))}
                              disabled={!isEditing}
                              className="max-w-[200px]"
                            />
                          </div>
                        )}
                      </div>

                      {/* Assigned Follow-up Settings */}
                      <div className="border rounded-lg p-4 space-y-4 bg-blue-50/30 dark:bg-blue-950/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium">Assigned Threads</label>
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">Agent Handling</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Trigger follow-up when a human agent is handling the conversation</p>
                          </div>
                          <Switch
                            checked={enableFollowupAssigned}
                            onCheckedChange={setEnableFollowupAssigned}
                            disabled={!isEditing}
                          />
                        </div>
                        {enableFollowupAssigned && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium text-primary">Inactivity Timeout (seconds)</label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Waktu dalam detik sebelum pesan tindak lanjut dikirim untuk percakapan Assigned.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="e.g. 300"
                              value={followupDelayAssignedInput}
                              onChange={(e) => setFollowupDelayAssignedInput(sanitizeNumericInput(e.target.value))}
                              disabled={!isEditing}
                              className="max-w-[200px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Agent Transfer Conditions */}
              <Card className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('transfer')}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-primary">Agent Transfer Conditions</h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Kondisi yang menentukan kapan percakapan dialihkan dari agen AI ke agen manusia</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When to transfer to human agents
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.transfer ? 'rotate-180' : ''}`} />
                </div>

                {expandedSections.transfer && (
                  <div className="mt-4 space-y-4">
                    <Textarea
                      className="min-h-[80px]"
                      value={transferConditions}
                      onChange={(e) => setTransferConditions(e.target.value)}
                      disabled={!isEditing}
                      placeholder={isNewAgent ?
                        "Define when your AI should transfer the conversation to a human agent..." :
                        "Enter transfer conditions..."
                      }
                    />
                    <div className="text-right text-xs text-muted-foreground">
                      {transferConditions.length}/750
                    </div>
                  </div>
                )}
              </Card>

              {/* Stop AI after Handoff */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Stop AI after Handoff</h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Menghentikan agen AI mengirim pesan setelah percakapan dialihkan ke agen manusia</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stop AI from sending messages after handoff
                    </p>
                  </div>
                  <Switch checked={stopAfterHandoff} onCheckedChange={setStopAfterHandoff} disabled={!isEditing} />
                </div>
              </Card>

              {/* Model Settings merged into Additional Settings below */}

              {/* Additional Settings (collapsible) */}
              <Card className="p-6">
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between py-1 font-medium [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-primary">Additional Settings</h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Pengaturan tambahan untuk konfigurasi lanjutan agen AI seperti batas riwayat, konteks, dan resolusi otomatis</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <ChevronDown className="w-5 h-5 transition-transform" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Enable auto-resolve</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Mengaktifkan resolusi otomatis percakapan setelah waktu tertentu tanpa respons pelanggan</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="mt-2">
                          <Switch checked={enableResolve} onCheckedChange={setEnableResolve} disabled={!isEditing} />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Auto-resolve timeout (minutes)</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Waktu dalam menit sebelum percakapan secara otomatis diselesaikan (0 = nonaktif)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="e.g. 30"
                          value={autoResolveMinutesInput}
                          onChange={(e) => handleAutoResolveChange(e.target.value)}
                          disabled={!enableResolve || !isEditing}
                          className={`mt-1 ${(!enableResolve || !isEditing) ? 'opacity-60 cursor-not-allowed bg-muted/50' : ''}`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {enableResolve ? 'Set 0 to disable auto-resolve.' : 'Enable Auto-resolve to edit this value.'}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Conversation History (messages)</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Batas maksimal jumlah pesan riwayat percakapan yang dapat diingat AI</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={`Max ${historyLimitMax}`}
                          value={historyLimitInput}
                          onChange={(e) => handleHistoryLimitChange(e.target.value)}
                          disabled={!isEditing}
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {`Supports up to ${historyLimitMax} messages.`}
                        </p>
                      </div>
                      {/* <div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">AI Read File Limit</label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Batas maksimal jumlah file yang dapat dibaca AI dalam satu percakapan</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input type="number" min={0} value={readFileLimit} onChange={(e)=>setReadFileLimit(parseInt(e.target.value||'0')||0)} className="mt-1" />
                  </div> */}
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Creativity Preset</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Preset kreativitas AI: Conservative (akurat), Balanced (seimbang), Creative (kreatif)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <select value={responseTemperature} onChange={(e) => setResponseTemperature(e.target.value)} disabled={!isEditing} className="w-full p-2 border rounded-lg mt-1">
                          <option value="Conservative">Conservative</option>
                          <option value="Balanced">Balanced</option>
                          <option value="Creative">Creative</option>
                        </select>
                      </div>
                      {/* <div>
                    <label className="text-sm font-medium">Message Await (seconds)</label>
                    <Input type="number" min={0} value={messageAwait} onChange={(e)=>setMessageAwait(parseInt(e.target.value||'0')||0)} className="mt-1" />
                  </div> */}
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">AI Message Cap</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Batas maksimal jumlah pesan yang dapat dikirim AI dalam satu percakapan</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="e.g. 1000"
                          value={messageLimitInput}
                          onChange={(e) => handleMessageLimitChange(e.target.value)}
                          disabled={!isEditing}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Save Button */}
              {isEditing && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="w-full"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isNewAgent ? 'Creating...' : 'Saving...'}
                        </>
                      ) : (
                        <>
                          <Settings className="w-4 h-4 mr-2" />
                          {isNewAgent ? 'Create AI Agent' : 'Save AI Settings'}
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isNewAgent ? 'Buat agen AI baru dengan pengaturan ini' : 'Simpan semua pengaturan saat ini'}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Chat Preview */}
            <div className="xl:col-span-2">
              <ChatPreview
                welcomeMessage={welcomeMessage}
                systemPrompt={systemPrompt}
                modelDisplay={selectedModel?.display_name || selectedModel?.model_name || 'Not selected'}
                profile={profile}
                profileId={profileId}
                modelName={selectedModel?.model_name || ''}
                temperature={getTemperatureValue(responseTemperature)} // Use mapped value from response_temperature
                transfer_conditions={transferConditions}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          <Card className="p-6">
            {/* Knowledge Source Type Tabs */}
            <Tabs value={knowledgeTab} onValueChange={setKnowledgeTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="text" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Text
                </TabsTrigger>
                {/* <TabsTrigger value="website" className="gap-2">
                      <Globe className="w-4 h-4" />
                  Website
                </TabsTrigger> */}
                <TabsTrigger value="file" className="gap-2">
                  <FileIcon className="w-4 h-4" />
                  File
                </TabsTrigger>
                <TabsTrigger value="qa" className="gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Q&A
                </TabsTrigger>
                {/* <TabsTrigger value="product" className="gap-2">
                      <Package className="w-4 h-4" />
                  Product
                </TabsTrigger> */}
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                {/* Knowledge Text Content */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Knowledge Text Content</label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Add custom knowledge text that your AI agent can reference when responding to customers.
                    </p>
                    <Textarea
                      className="min-h-[300px] font-mono text-sm"
                      value={guideContent}
                      onChange={(e) => setGuideContent(e.target.value)}
                      placeholder="Enter your knowledge content here..."
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                {/* Character Count */}
                <div className="flex items-center justify-between mt-2">
                  <Button onClick={handleSaveText} disabled={saving} size="sm" className="gap-2">
                    <Save className="w-4 h-4" />
                    Save Text
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {guideContent.length} Characters
                  </div>
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

              <TabsContent value="file" className="space-y-6">



                <div
                  onDrop={(canUploadAgentFiles && isEditing) ? handleDrop : undefined}
                  onDragOver={(canUploadAgentFiles && isEditing) ? handleDragOver : undefined}
                  className={`border border-dashed rounded-lg p-6 text-center ${(canUploadAgentFiles && isEditing) ? 'bg-muted/30' : 'bg-muted/50 opacity-70 cursor-not-allowed'}`}
                >
                  <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} disabled={!canUploadAgentFiles || !isEditing} />
                  <FileIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  {(canUploadAgentFiles && isEditing) ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">Drag & drop a document here, or</p>
                      <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={!isEditing}>Browse Files</Button>
                      <p className="text-xs text-muted-foreground mt-2">Supported: PDF</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {!isEditing ? 'Enter edit mode to manage files.' : 'You don\'t have permission to upload files.'}
                      </p>
                      {isEditing && !canUploadAgentFiles && (
                        <p className="text-xs text-muted-foreground mt-1">Requires permission: ai_agent_files.create</p>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Uploaded Files ({knowledgeFiles.length})</h3>
                    {knowledgeFiles.length > 0 && isEditing && (
                      <Button variant="ghost" size="sm" onClick={clearKnowledgeFiles} className="text-red-600 hover:text-red-700" disabled={!isEditing}>Clear All</Button>
                    )}
                  </div>

                  {loadingFiles ? (
                    <div className="text-sm text-muted-foreground">Loading files...</div>
                  ) : knowledgeFiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No files uploaded yet.</div>
                  ) : (
                    <div className="border rounded-md divide-y">
                      {knowledgeFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox
                              checked={f.isEnabled ?? true}
                              onCheckedChange={() => handleToggleFile(f.id, f.isEnabled ?? true)}
                              disabled={!isEditing}
                            />
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><FileIcon className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{f.name}</div>
                              <div className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB • {new Date(f.uploadedAt).toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'ready' ? 'bg-green-100 text-green-700' :
                              f.status === 'uploading' ? 'bg-blue-100 text-blue-700' :
                                f.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                              }`}>
                              {f.status === 'uploading' ? (
                                <div className="flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  uploading
                                </div>
                              ) : f.status}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadKnowledgeFile(f)}
                              disabled={f.status === 'uploading'}
                            >
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeKnowledgeFile(f.id)}
                              disabled={f.status === 'uploading' || !isEditing}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="qa" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Q&A Knowledge</h3>
                    <p className="text-sm text-muted-foreground">Add question–answer pairs the AI can reference.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveQA}
                      disabled={saving || !isEditing}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Q&A
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setKnowledgeTab('qa'); addQaPair(); }}
                      className="gap-2"
                      disabled={!isEditing}
                    >
                      <Plus className="w-4 h-4" />
                      Add Pair
                    </Button>
                  </div>
                </div>

                {qaPairs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No Q&A pairs. Click Add Pair to create one.</div>
                ) : (
                  <div className="space-y-3">
                    {qaPairs.map((pair) => (
                      <Card key={pair.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Question"
                              value={pair.question}
                              onChange={(e) => updateQaPair(pair.id, 'question', e.target.value)}
                              disabled={!isEditing}
                            />
                            <Textarea
                              placeholder="Answer"
                              className="min-h-[80px]"
                              value={pair.answer}
                              onChange={(e) => updateQaPair(pair.id, 'answer', e.target.value)}
                              disabled={!isEditing}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            {isPairDirty(pair) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Ensure we stay on the QA tab after saving
                                  setKnowledgeTab('qa');
                                  try {
                                    await saveProfile({
                                      name: agentName,
                                      qna: qaPairs
                                        .filter((p) => (p.question?.trim() || p.answer?.trim()))
                                        .map(({ question, answer }) => ({ q: question.trim(), a: answer.trim() })),
                                    });
                                    // Sync baseline to latest saved values
                                    setInitialQaPairs(JSON.parse(JSON.stringify(qaPairs)));
                                    toast.success('Q&A saved');
                                  } catch (e: any) {
                                    toast.error(e?.message || 'Failed to save Q&A');
                                  }
                                }}
                              >
                                Save
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeQaPair(pair.id)}
                              disabled={!isEditing}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
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
                        disabled={!isEditing}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <Textarea
                      value={followup.prompt}
                      onChange={(e) => updateFollowup(followup.id, 'prompt', e.target.value)}
                      className="min-h-[80px]"
                      placeholder="Enter followup message..."
                      disabled={!isEditing}
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
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    <Collapsible>
                      <CollapsibleTrigger
                        onClick={() => toggleOptions(followup.id)}
                        className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${followup.expanded ? 'rotate-180' : ''}`} />
                        Options
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={addFollowup} className="gap-2" disabled={!isEditing}>
                    <Plus className="w-4 h-4" />
                    Add Followup
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tambah pesan tindak lanjut baru</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700" disabled={!isEditing}>
                    Save Followups
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Simpan semua pesan tindak lanjut</p>
                </TooltipContent>
              </Tooltip>
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
    </div >
  );
};

export default AIAgentSettings;