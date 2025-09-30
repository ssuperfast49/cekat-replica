import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Settings, BookOpen, Zap, Users, BarChart3, Bot, Send, Loader2, RotateCcw, RefreshCw, FileText, Globe, File as FileIcon, HelpCircle, Package, Edit3, Undo, Redo, Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify, Trash2, ChevronDown, Plus } from "lucide-react";
import { useAIProfiles, AIProfile } from "@/hooks/useAIProfiles";
import { toast } from "@/components/ui/sonner";
import WEBHOOK_CONFIG from "@/config/webhook";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/contexts/RBACContext";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Initialize messages with welcome message
  useEffect(() => {
    setMessages([
      {
        id: '1',
        content: welcomeMessage || "Halo! 👋 Selamat datang di Okbang Top Up Center~",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
  }, [welcomeMessage]);


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

      const response = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.AI_AGENT.CHAT_SETTINGS), {
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
  const [knowledgeTab, setKnowledgeTab] = useState("text");
  const isNewAgent = !profileId;
  const { hasPermission } = useRBAC();
  const UPLOAD_PERMISSION = "ai_agent_files.manage";
  const canUploadAgentFiles = hasPermission(UPLOAD_PERMISSION);
  
  // Use the custom hook for AI profile management
  const { profile, loading, saving, error, saveProfile } = useAIProfiles(profileId);
  
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
  const [model, setModel] = useState(profile?.model || "gpt-4o-mini");
  const [temperature, setTemperature] = useState(profile?.temperature || 0.3);
  
  // Knowledge: Files
  type KnowledgeFileStatus = 'uploading' | 'ready' | 'processing' | 'failed';
  interface KnowledgeFile {
    id: number;
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
  const uploadFileToSupabase = async (file: File, fileId: number): Promise<{ url: string; filePath: string; documentId?: string }> => {
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
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contentHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      // Build storage key using content hash and original base name
      const originalSafe = (file?.name || 'file.pdf').replace(/[^a-zA-Z0-9_.-]/g, '');
      const baseNoExt = originalSafe.replace(/\.pdf$/i, '');
      const generatedName = `${contentHash}_${baseNoExt}.pdf`;
      const fileKey = `org_${orgId}/profile_${resolvedProfileId}/${generatedName}`;

      // 1) Send to webhook for hashing, extraction, and knowledgebase indexing (include hash)
      const form = new FormData();
      form.append('file', file);
      form.append('file_name', file.name || 'file.pdf');
      form.append('org_id', orgId);
      form.append('profile_id', resolvedProfileId);
      form.append('hashFile', contentHash);

      const resp = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.KNOWLEDGE.FILE_UPLOAD), {
        method: 'POST',
        body: form,
      });
      if (!resp.ok) {
        let message = `Upload failed (${resp.status})`;
        try { const j = await resp.json(); message = j?.message || message; } catch {}
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

      return { url: uploadedUrl || '', filePath: fileKey, documentId };
    } catch (error: any) {
      console.error('Error uploading file to Supabase:', error);
      throw new Error(`Failed to upload ${file.name}: ${error?.message || 'Unknown error'}`);
    }
  };

  // Load existing files from storage for this agent
  const loadExistingKnowledgeFiles = async () => {
    try {
      setLoadingFiles(true);
      const { orgId, profileId: resolvedProfileId } = await getUploadContext();
      const primaryPrefix = `org_${orgId}/profile_${resolvedProfileId}`;
      const fallbackPrefix = `profile_${resolvedProfileId}`; // legacy path fallback

      const listPrefix = async (prefix: string) => {
        const { data, error } = await supabase.storage
          .from('ai-agent-files')
          .list(prefix, { limit: 100 });
        if (error) return [] as any[];
        return (data || []).map((f: any) => ({ ...f, __prefix: prefix }));
      };

      const [primary, fallback] = await Promise.all([
        listPrefix(primaryPrefix),
        listPrefix(fallbackPrefix),
      ]);

      const objects = [...primary, ...fallback];
      if (objects.length === 0) {
        setKnowledgeFiles([]);
        return;
      }

      const items: KnowledgeFile[] = [];
      for (const obj of objects) {
        // Skip invalid entries, folder placeholders, and storage placeholders
        if (!obj || !obj.name) continue;
        const nameStr = String(obj.name);
        if (nameStr.endsWith('/')) continue;
        if (nameStr === '.emptyFolderPlaceholder' || nameStr === '.emptyfolderplaceholder') continue;
        const fileKey = `${obj.__prefix}/${obj.name}`;
        const sizeVal = (obj.metadata && (typeof obj.metadata.size !== 'undefined')) ? obj.metadata.size : 0;
        const sizeBytes = typeof sizeVal === 'number' ? sizeVal : Number(sizeVal || 0);
        let signedUrl = '';
        const { data: signedData } = await supabase.storage
          .from('ai-agent-files')
          .createSignedUrl(fileKey, 60 * 60 * 24 * 7);
        signedUrl = signedData?.signedUrl || '';

        items.push({
          id: Date.now() + Math.random(),
          name: obj.name,
          size: sizeBytes,
          uploadedAt: (obj.updated_at || obj.created_at || new Date().toISOString()),
          status: 'ready',
          url: signedUrl,
          filePath: fileKey,
        });
      }

      // Sort latest first
      items.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      setKnowledgeFiles(items);
    } catch (e: any) {
      console.error('Failed to load knowledge files:', e);
      // Do not toast here to avoid noise on tab switch without access
    } finally {
      setLoadingFiles(false);
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
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
        const { url, filePath } = await uploadFileToSupabase(file, fileItem.id);

        // Update file status to ready with URL
        setKnowledgeFiles((prev) => prev.map((f) => 
          f.id === fileItem.id 
            ? { ...f, status: 'ready' as KnowledgeFileStatus, url, filePath }
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
          setTimeout(() => { (loadExistingKnowledgeFiles() as any)?.catch?.(() => {}); }, 0);
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
    
    // Ensure IDs are available for pathing
    try {
      await getUploadContext();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to upload at this time');
      return;
    }
    
    const now = new Date().toISOString();
    
    // Add files with uploading status first
    const newItems: KnowledgeFile[] = dtFiles.map((f) => ({
      id: Date.now() + Math.random(),
      name: f.name,
      size: f.size,
      uploadedAt: now,
      status: 'uploading' as KnowledgeFileStatus,
    }));
    
    setKnowledgeFiles((prev) => [...newItems, ...prev]);
    
    // Upload each file
    for (let i = 0; i < dtFiles.length; i++) {
      const file = dtFiles[i];
      const fileItem = newItems[i];
      
      try {
        const { url, filePath } = await uploadFileToSupabase(file, fileItem.id);
        
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
  const removeKnowledgeFile = async (id: number) => {
    const file = knowledgeFiles.find(f => f.id === id);
    try {
      const { orgId, profileId: resolvedProfileId } = await getUploadContext();
      // Call delete webhook if we have a filePath (storage key)
      if (file?.filePath) {
        const resp = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.KNOWLEDGE.FILE_DELETE), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: orgId, profile_id: resolvedProfileId, file_key: file.filePath, document_id: (file as any)?.documentId || undefined }),
        });
        if (!resp.ok) {
          let message = `Delete failed (${resp.status})`;
          try { const j = await resp.json(); message = j?.message || message; } catch {}
          throw new Error(message);
        }
        // Require explicit confirmation from webhook
        let payload: any = {};
        try { payload = await resp.json(); } catch {}
        const st = String(payload?.status || '').toLowerCase();
        if (st !== 'deleted') {
          throw new Error(payload?.message || 'Delete not confirmed by webhook');
        }
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
            const resp = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.KNOWLEDGE.FILE_DELETE), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ org_id: orgId, profile_id: resolvedProfileId, file_key: f.filePath, document_id: (f as any)?.documentId || undefined })
            });
            if (!resp.ok) {
              let message = `Delete failed (${resp.status})`;
              try { const j = await resp.json(); message = j?.message || message; } catch {}
              console.warn('Delete webhook failed for', f.filePath, message);
            } else {
              // Confirm webhook success status
              let payload: any = {};
              try { payload = await resp.json(); } catch {}
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

  // Update form state when profile data loads (only for existing agents)
  useEffect(() => {
    if (profile && !isNewAgent) {
      setSystemPrompt(profile.system_prompt || "");
      setWelcomeMessage(profile.welcome_message || "");
      setTransferConditions(profile.transfer_conditions || "");
      setStopAfterHandoff(profile.stop_ai_after_handoff);
      setModel(profile.model || "gpt-4o-mini");
      setTemperature(profile.temperature || 0.3);
      const qna = (profile as any)?.qna as ( { q: string; a: string } | { question: string; answer: string } )[] | null | undefined;
      if (qna && Array.isArray(qna)) {
        const pairs = qna.map((item, idx) => ({ id: Date.now() + idx, question: (item as any).q ?? (item as any).question ?? '', answer: (item as any).a ?? (item as any).answer ?? '' }));
        setQaPairs(pairs);
        setInitialQaPairs(JSON.parse(JSON.stringify(pairs)));
      }
    }
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
    const updateData = {
      system_prompt: systemPrompt,
      welcome_message: welcomeMessage,
      transfer_conditions: transferConditions,
      stop_ai_after_handoff: stopAfterHandoff,
      model: model,
      temperature: temperature,
      name: agentName,
      // Persist Q&A pairs into ai_profiles.qna JSONB
      // Store compact q/a pairs for space efficiency
      qna: qaPairs
        .filter((p) => (p.question?.trim() || p.answer?.trim()))
        .map(({ question, answer }) => ({ q: question.trim(), a: answer.trim() })),
    };

    try {
      await saveProfile(updateData);
      toast.success(isNewAgent ? 'AI agent created successfully!' : 'AI agent settings saved successfully!');
    } catch (error) {
      toast.error(isNewAgent ? 'Failed to create AI agent' : 'Failed to save AI agent settings');
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
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
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
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">Error: {error}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Knowledge Sources
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Settings */}
            <div className="lg:col-span-2 space-y-6">
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
                  placeholder={isNewAgent ? 
                    "Define your AI's personality, behavior, and capabilities here. For example:\n\nYou are a helpful customer service AI assistant. Be friendly, professional, and always respond in Indonesian unless the customer speaks in another language. Help customers with their inquiries about products, services, and support." : 
                    "Enter system prompt..."
                  }
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
                  placeholder={isNewAgent ? 
                    "This is the first message your AI will send to customers when they start a conversation. Make it welcoming and helpful!" : 
                    "Enter welcome message..."
                  }
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
                    placeholder={isNewAgent ? 
                      "Define when your AI should transfer the conversation to a human agent. For example:\n- Customer requests to speak with a human\n- Complex technical issues\n- Payment or billing problems\n- Customer is angry or dissatisfied" : 
                      "Enter transfer conditions..."
                    }
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
                    {isNewAgent ? 'Creating...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    {isNewAgent ? 'Create AI Agent' : 'Save AI Settings'}
                  </>
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

              <TabsContent value="file" className="space-y-6">
                <div
                  onDrop={canUploadAgentFiles ? handleDrop : undefined}
                  onDragOver={canUploadAgentFiles ? handleDragOver : undefined}
                  className={`border border-dashed rounded-lg p-6 text-center ${canUploadAgentFiles ? 'bg-muted/30' : 'bg-muted/50 opacity-70'}`}
                >
                  <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileSelect} disabled={!canUploadAgentFiles} />
                  <FileIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  {canUploadAgentFiles ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">Drag & drop documents here, or</p>
                      <Button size="sm" onClick={() => fileInputRef.current?.click()}>Browse Files</Button>
                      <p className="text-xs text-muted-foreground mt-2">Supported: PDF</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">You don't have permission to upload files.</p>
                      <p className="text-xs text-muted-foreground mt-1">Requires permission: {UPLOAD_PERMISSION}</p>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Uploaded Files ({knowledgeFiles.length})</h3>
                    {knowledgeFiles.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearKnowledgeFiles} className="text-red-600 hover:text-red-700">Clear All</Button>
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
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><FileIcon className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{f.name}</div>
                              <div className="text-xs text-muted-foreground">{(f.size/1024).toFixed(1)} KB • {new Date(f.uploadedAt).toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              f.status==='ready'?'bg-green-100 text-green-700':
                              f.status==='uploading'?'bg-blue-100 text-blue-700':
                              f.status==='processing'?'bg-amber-100 text-amber-700':
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
                              disabled={f.status==='uploading'}
                            >
                              Download
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-red-600 hover:text-red-700" 
                              onClick={() => removeKnowledgeFile(f.id)}
                              disabled={f.status==='uploading'}
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
                  <Button size="sm" onClick={()=>{ setKnowledgeTab('qa'); addQaPair(); }} className="gap-2"><Plus className="w-4 h-4" />Add Pair</Button>
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
                              onChange={(e)=>updateQaPair(pair.id,'question', e.target.value)}
                            />
                            <Textarea
                              placeholder="Answer"
                              className="min-h-[80px]"
                              value={pair.answer}
                              onChange={(e)=>updateQaPair(pair.id,'answer', e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            {isPairDirty(pair) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async (e)=>{
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Ensure we stay on the QA tab after saving
                                  setKnowledgeTab('qa');
                                  try {
                                    await saveProfile({
                                      qna: qaPairs
                                        .filter((p) => (p.question?.trim() || p.answer?.trim()))
                                        .map(({ question, answer }) => ({ q: question.trim(), a: answer.trim() })),
                                    });
                                    // Sync baseline to latest saved values
                                    setInitialQaPairs(JSON.parse(JSON.stringify(qaPairs)));
                                    toast.success('Q&A saved');
                                  } catch (e:any) {
                                    toast.error(e?.message || 'Failed to save Q&A');
                                  }
                                }}
                              >
                                Save
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={()=>removeQaPair(pair.id)}>
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
                        <ChevronDown className={`w-4 h-4 transition-transform ${followup.expanded ? 'rotate-180' : ''}`} />
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