import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatFilter } from "./ChatFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  CheckCheck, 
  Loader2, 
  RefreshCw, 
  Search, 
  Filter, 
  Plus, 
  List, 
  Users, 
  ChevronDown,
  Tag,
  UserPlus,
  UserMinus,
  Send,
  MoreVertical,
  CheckCircle,
  X,
  Trash2
} from "lucide-react";
import { useConversations, ConversationWithDetails, MessageWithDetails } from "@/hooks/useConversations";
import { useContacts } from "@/hooks/useContacts";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { toast } from "sonner";
import { supabase, protectedSupabase } from "@/lib/supabase";
import { useRBAC } from "@/contexts/RBACContext";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/types/rbac";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { setSendMessageProvider } from "@/config/webhook";
import { isDocumentHidden, onDocumentVisible } from "@/lib/utils";
import PermissionGate from "@/components/rbac/PermissionGate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MessageBubbleProps {
  message: MessageWithDetails;
  isLastMessage: boolean;
  highlighted?: boolean;
}

const MessageBubble = ({ message, isLastMessage, highlighted = false }: MessageBubbleProps) => {
  const isAgent = message.role === 'assistant' || message.role === 'agent' || message.direction === 'out';
  const isSystem = message.role === 'system' || message.type === 'event' || message.type === 'note';
  const isHumanAgent = message.role === 'assistant';
  const isAiAgent = message.role === 'agent';
  
  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            {message.body || 'System event'}
          </div>
          <div className="flex items-center justify-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{new Date(message.created_at).toLocaleTimeString([], { 
              hour: "2-digit", 
              minute: "2-digit" 
            })}</span>
            <span>•</span>
            <span>system</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isAgent ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`flex ${isAgent ? "flex-row-reverse" : "flex-row"} items-end gap-2 max-w-[75%]`}>
        <Avatar className="h-8 w-8">
          <AvatarImage src="" />
          <AvatarFallback className="text-xs">
            {isAgent ? 'A' : message.contact_avatar}
          </AvatarFallback>
        </Avatar>
        
        <div
          className={`rounded-lg px-3 py-2 text-sm shadow-sm ${
            isAiAgent
              ? "bg-blue-600 text-white"
              : isHumanAgent
                ? "bg-blue-100 text-blue-900"
                : "bg-muted text-foreground"
          } ${highlighted ? 'ring-2 ring-yellow-300' : ''}`}
        >
          <p className="whitespace-pre-wrap">{message.body}</p>
          <div className={`mt-1 flex items-center gap-1 text-[10px] ${
            isAiAgent ? "text-blue-100" : isHumanAgent ? "text-blue-700" : "text-muted-foreground"
          }`}>
            <span>{new Date(message.created_at).toLocaleTimeString([], { 
              hour: "2-digit", 
              minute: "2-digit" 
            })}</span>
            {isAgent && (
              message._status === 'pending' ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-label="pending" />
              ) : isLastMessage ? (
                <CheckCheck className="h-3 w-3" aria-label="sent" />
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ConversationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'assigned' | 'unassigned' | 'resolved'>("assigned");
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const searchTimeout = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Use the conversations hook
  const {
    conversations,
    messages,
    loading,
    error,
    fetchConversations,
    fetchMessages,
    sendMessage,
    createConversation,
    addThreadParticipant,
    removeThreadParticipant,
    addThreadLabel,
    removeThreadLabel,
    assignThread,
    deleteThread,
  } = useConversations();

  // Use the contacts and human agents hooks
  const { createContact } = useContacts();
  const { agents: humanAgents } = useHumanAgents();
  const { user } = useAuth();
  const { hasRole, hasPermission } = useRBAC();
  const [assignOpen, setAssignOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(false);
  const [isCollaborator, setIsCollaborator] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<ConversationWithDetails | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const canDeleteConversation = hasPermission('contacts.delete');

  // Filter conversations based on search query
  const [filters, setFilters] = useState<any>({});
  
  // Get contact ID and tab from URL parameters
  const contactId = searchParams.get('contact');
  const tabParam = searchParams.get('tab');

  // Bidirectional URL<->state sync with loop guard
  const isPushingTabRef = useRef(false);
  useEffect(() => {
    if (!tabParam) return;
    if (isPushingTabRef.current) return; // ignore echo from our own push
    if (tabParam === 'assigned' || tabParam === 'unassigned' || tabParam === 'resolved') {
      if (tabParam !== activeTab) setActiveTab(tabParam as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  
  const filteredConversations = useMemo(() => {
    let list = conversations.filter((conv) =>
      `${conv.contact_name} ${conv.last_message_preview}`.toLowerCase().includes(query.toLowerCase())
    );
    
    // Do not filter list by contactId; we only use it to auto-select
    
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'resolved') {
        list = list.filter(c => c.status === 'closed');
      } else {
        list = list.filter(c => c.status === filters.status);
      }
    }
    if (filters.agent && filters.agent !== 'all') {
      list = list.filter(c => c.assignee_user_id === filters.agent);
    }
    if (filters.resolvedBy && filters.resolvedBy !== 'all') {
      list = list.filter(c => (c as any).resolved_by_user_id === filters.resolvedBy);
    }
    if (filters.inbox && filters.inbox !== 'all') {
      list = list.filter(c => c.channel_type === filters.inbox);
    }
    if ((filters as any).channelType && (filters as any).channelType !== 'all') {
      const m: any = { whatsapp: 'whatsapp', telegram: 'telegram', web: 'web' };
      const wanted = m[(filters as any).channelType];
      if (wanted) list = list.filter(c => (c.channel?.provider || c.channel_type) === wanted);
    }
    // Date range filter
    if (filters.dateRange?.from || filters.dateRange?.to) {
      const from = filters.dateRange.from ? new Date(filters.dateRange.from).getTime() : -Infinity;
      const to = filters.dateRange.to ? new Date(filters.dateRange.to).getTime() : Infinity;
      list = list.filter(c => {
        const ts = new Date(c.created_at).getTime();
        return ts >= from && ts <= to;
      });
    }
    // Sort: unreplied first, then by last_msg_at desc
    list = [...list].sort((a, b) => {
      const aUn = (a as any).unreplied ? 1 : 0;
      const bUn = (b as any).unreplied ? 1 : 0;
      if (aUn !== bUn) return bUn - aUn; // true first
      return new Date(b.last_msg_at).getTime() - new Date(a.last_msg_at).getTime();
    });
    return list;
  }, [conversations, query, filters, contactId]);

  // If there are only resolved (closed) conversations, switch to the Resolved tab automatically
  useEffect(() => {
    const hasNonClosed = filteredConversations.some(c => c.status !== 'closed');
    const hasClosed = filteredConversations.some(c => c.status === 'closed');
    if (!hasNonClosed && hasClosed && activeTab !== 'resolved') {
      setActiveTab('resolved');
    }
  }, [filteredConversations, activeTab]);

  // Keep URL in sync with current tab for deep-linkability (write-only)
  useEffect(() => {
    const current = tabParam;
    if (current === activeTab) return;
    const next = new URLSearchParams(window.location.search);
    next.set('tab', activeTab);
    isPushingTabRef.current = true;
    setSearchParams(next, { replace: true });
    // clear the guard on the next tick after the router applies changes
    setTimeout(() => { isPushingTabRef.current = false; }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Auto-select by contactId only on first load for this navigation; do not override manual selection
  useEffect(() => {
    if (!contactId) return;
    if (selectedThreadId) return; // user has already selected a thread; don't override
    if (filteredConversations.length === 0) return;
      const target = filteredConversations.find(c => c.contact_id === contactId);
      if (!target) return;
        setSelectedThreadId(target.id);
      // Ensure tab reflects the selected conversation
      if (target.status === 'closed') {
        setActiveTab('resolved');
      } else {
        setActiveTab(target.assigned ? 'assigned' : 'unassigned');
      }
      // Fetch messages and set provider when auto-selecting
      void fetchMessages(target.id);
      if (target.channel?.provider) {
        setSendMessageProvider(target.channel.provider);
      }
  }, [contactId, filteredConversations]);

  // Get selected conversation
  const selectedConversation = useMemo(() => {
    if (!selectedThreadId) {
      return null; // Do not auto-pick any thread on first load
    }
    return filteredConversations.find(c => c.id === selectedThreadId) || null;
  }, [selectedThreadId, filteredConversations]);

  // Check if current user is a collaborator on selected thread
  useEffect(() => {
    const checkCollab = async () => {
      try {
        if (!selectedConversation?.id || !user?.id) {
          setIsCollaborator(false);
          return;
        }
        const { data, error } = await protectedSupabase
          .from('thread_collaborators')
          .select('user_id')
          .eq('thread_id', selectedConversation.id)
          .eq('user_id', user.id)
          .limit(1);
        if (error) throw error;
        setIsCollaborator(!!data && data.length > 0);
      } catch (e) {
        console.warn('Failed to check collaborator status', e);
        setIsCollaborator(false);
      }
    };
    checkCollab();
  }, [selectedConversation?.id, user?.id]);

  const handleTakeoverChat = async () => {
    if (!selectedConversation) return;
    if (!user?.id) {
      toast.error('You must be signed in to take over');
      return;
    }
    try {
      const isAdmin = hasRole(ROLES.MASTER_AGENT) || hasRole(ROLES.SUPER_AGENT);
      // Ensure collaborator status before takeover
      if (!isCollaborator) {
        if (isAdmin) {
          try {
            const { data: existing } = await protectedSupabase
              .from('thread_collaborators')
              .select('user_id')
              .eq('thread_id', selectedConversation.id)
              .eq('user_id', user.id)
              .limit(1);
            if (!existing || existing.length === 0) {
              await addThreadParticipant(selectedConversation.id, user.id);
            }
            setIsCollaborator(true);
          } catch (err) {
            console.warn('Failed to ensure collaborator before takeover', err);
            toast.error('Please join as collaborator before taking over');
            return; // Block takeover if collaborator insert/check failed
          }
        } else {
          toast.error('Please join as collaborator before taking over');
          return;
        }
      }

      await assignThread(selectedConversation.id, user.id);
      toast.success('You are now assigned to this chat');
      // Move UI to Assigned tab and enable composer immediately
      setActiveTab('assigned');
      await fetchConversations();
    } catch (e) {
      toast.error('Failed to take over chat');
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle conversation selection
  const handleConversationSelect = async (threadId: string) => {
    // Set provider based on the selected conversation's channel.provider
    const conv = filteredConversations.find(c => c.id === threadId);
    if (conv?.channel?.provider) {
      setSendMessageProvider(conv.channel.provider);
    }
    setSelectedThreadId(threadId);
    // Clear URL contact param to avoid auto-selection overriding manual changes
    try {
      const next = new URLSearchParams(window.location.search);
      if (next.has('contact')) {
        next.delete('contact');
        setSearchParams(next, { replace: true });
      }
    } catch {}
    await fetchMessages(threadId);
  };

  // Send message
  const handleSendMessage = async () => {
    const text = draft.trim();
    if (!text || !selectedThreadId) return;
    
    try {
      // Check AI message limit before sending (for AI responses)
      const { checkAIMessageLimit, autoAssignToSuperAgent } = await import('@/lib/aiMessageLimit');
      // @ts-ignore - protectedSupabase is compatible with the function signature
      const limitInfo = await checkAIMessageLimit(protectedSupabase as any, selectedThreadId);
      
      if (limitInfo.isExceeded && limitInfo.superAgentId) {
        // Auto-assign to super agent
        // @ts-ignore - protectedSupabase is compatible with the function signature
        const assignResult = await autoAssignToSuperAgent(protectedSupabase as any, selectedThreadId, limitInfo.superAgentId);
        
        if (assignResult.success) {
          toast.error(
            `Batas pesan AI telah tercapai (${limitInfo.currentCount}/${limitInfo.limit}). ` +
            `Percakapan telah dialihkan ke super agent dan AI access dinonaktifkan.`
          );
          // Refresh conversations to show updated assignment
          await fetchConversations();
          // Don't send message - let super agent handle it
          return;
        }
      } else if (limitInfo.isExceeded && !limitInfo.superAgentId) {
        toast.error(
          `Batas pesan AI telah tercapai (${limitInfo.currentCount}/${limitInfo.limit}). ` +
          `Tidak ada super agent yang tersedia untuk penanganan.`
        );
        return;
      }

      // Enforce token limit before sending AI message
      if (user?.id) {
        const { data: profile } = await supabase
          .from('users_profile')
          .select('token_limit_enabled, max_tokens_per_day, max_tokens_per_month')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.token_limit_enabled) {
          // Calculate consumed for today and this month
          const now = new Date();
          const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
          const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();

          const [{ data: dayRows }, { data: monthRows }] = await Promise.all([
            supabase
              .from('token_usage_logs')
              .select('total_tokens')
              .eq('user_id', user.id)
              .gte('made_at', startOfDay),
            supabase
              .from('token_usage_logs')
              .select('total_tokens')
              .eq('user_id', user.id)
              .gte('made_at', startOfMonth),
          ]);
          const usedToday = (dayRows || []).reduce((s: number, r: any) => s + Number(r.total_tokens || 0), 0);
          const usedMonth = (monthRows || []).reduce((s: number, r: any) => s + Number(r.total_tokens || 0), 0);

          if (profile.max_tokens_per_day && usedToday >= profile.max_tokens_per_day) {
            toast.error('Daily token limit reached');
            return;
          }
          if (profile.max_tokens_per_month && usedMonth >= profile.max_tokens_per_month) {
            toast.error('Monthly token limit reached');
            return;
          }
        }
      }

      // Clear input immediately and fire send without blocking UI
      setDraft("");
      void sendMessage(selectedThreadId, text, 'assistant');
      toast.success("Message sent successfully");
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  // Handle key press in message input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Debounced search over messages list
  useEffect(() => {
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current);
    }
    if (!messageSearch.trim()) {
      setHighlightMessageId(null);
      return;
    }
    searchTimeout.current = window.setTimeout(() => {
      const term = messageSearch.toLowerCase();
      const match = messages.find(m => (m.body || '').toLowerCase().includes(term));
      if (match) {
        setHighlightMessageId(match.id);
        const el = messageRefs.current[match.id];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setHighlightMessageId(null);
      }
    }, 500);
    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
      }
    };
  }, [messageSearch, messages]);

  // Update webhook provider whenever selected conversation changes
  useEffect(() => {
    if (selectedConversation?.channel?.provider) {
      setSendMessageProvider(selectedConversation.channel.provider);
    }
  }, [selectedConversation?.channel?.provider]);

  // Add participant to thread
  const handleAddParticipant = async (userId: string) => {
    if (!selectedThreadId) return;
    
    try {
      await addThreadParticipant(selectedThreadId, userId);
      toast.success("Participant added successfully");
    } catch (error) {
      toast.error("Failed to add participant");
    }
  };

  // Helpers for thread list UI
  const formatListTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays < 7) {
      return d.toLocaleDateString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    }
    // dd/MM/yy
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    return `${dd}/${mm}/${yy}`;
  };

  const renderStatus = (conv: ConversationWithDetails) => {
    if (conv.status === 'closed') {
      return <Badge className="bg-green-100 text-green-700 border-0">Resolved</Badge>;
    }
    return (
      <Badge className={conv.assigned ? 'bg-blue-100 text-blue-700 border-0' : 'bg-secondary text-secondary-foreground'}>
        {conv.assigned ? 'Assigned' : 'Unassigned'}
      </Badge>
    );
  };

  const getListTimestamp = (conv: any) => {
    const ts = (conv as any).last_msg_at || (conv as any).updated_at || (conv as any).created_at || '';
    return formatListTime(ts);
  };

  // Remove participant from thread
  const handleRemoveParticipant = async (userId: string) => {
    if (!selectedThreadId) return;
    
    try {
      await removeThreadParticipant(selectedThreadId, userId);
      toast.success("Participant removed successfully");
    } catch (error) {
      toast.error("Failed to remove participant");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!canDeleteConversation) {
      toast.error('You do not have permission to delete conversations');
      setDeleteTarget(null);
      return;
    }
    try {
      setDeleteLoading(true);
      await deleteThread(deleteTarget.id);
      toast.success('Conversation deleted');
      if (selectedThreadId === deleteTarget.id) {
        setSelectedThreadId(null);
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error('Failed to delete conversation');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenDelete = (conversation: ConversationWithDetails) => {
    if (!canDeleteConversation) {
      toast.error('You do not have permission to delete conversations');
      return;
    }
    setDeleteTarget(conversation);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading conversations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error: {error}</p>
          <Button onClick={fetchConversations} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-[360px_1fr_320px] h-[calc(100vh-120px)] gap-4">
      <aside className="rounded-lg border bg-card p-3">
        <div className="mb-3 pb-2 border-b flex items-center justify-between">
          <h2 className="text-sm font-medium">Conversations</h2>
          <div className="flex items-center gap-1">
            <ChatFilter onFilterChange={setFilters} />
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={query} onChange={(e)=>setQuery(e.target.value)} className="pl-10 h-8 text-sm" />
        </div>
        <Tabs value={activeTab} onValueChange={(v)=>{ if (v !== activeTab) setActiveTab(v as any); }} className="w-full">
          <TabsList className="grid w-full grid-cols-[1fr_1fr_auto] mb-3 bg-white">
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value="assigned"
                  className="text-xs border-b-2 border-transparent data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:border-blue-500"
                >
                  Assigned
                  <Badge variant="secondary" className="ml-2 h-5 text-xs" aria-live="polite" aria-atomic="true">
                    {filteredConversations.filter(c=>c.status !== 'closed' && c.assigned).length}
                  </Badge>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat percakapan yang ditugaskan ke agen</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value="unassigned"
                  className="text-xs border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:border-red-500"
                >
                  Unassigned
                  <Badge variant="secondary" className="ml-2 h-5 text-xs" aria-live="polite" aria-atomic="true">
                    {filteredConversations.filter(c=>c.status !== 'closed' && !c.assigned).length}
                  </Badge>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat percakapan yang menunggu penugasan</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value="resolved"
                  className="justify-self-end h-8 px-2 rounded-full border-b-2 border-transparent data-[state=active]:bg-green-50 data-[state=active]:text-green-600 data-[state=active]:border-green-500"
                  aria-label="Resolved"
                >
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    <Badge variant="secondary" className="h-5 text-xs" aria-live="polite" aria-atomic="true">
                      {filteredConversations.filter(c=>c.status === 'closed').length}
                    </Badge>
                  </div>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat percakapan yang telah diselesaikan</p>
              </TooltipContent>
            </Tooltip>
          </TabsList>
          <TabsContent value="assigned" className="mt-0">
            <div className="h-[calc(100vh-280px)] overflow-y-auto">
              <div className="space-y-1">
                {filteredConversations.filter(c=>c.status !== 'closed' && c.assigned).map(conv => (
                  <div key={conv.id} className="relative">
                    <button
                      type="button"
                      onClick={()=>handleConversationSelect(conv.id)}
                      className={`w-full p-3 pr-12 text-left transition-colors rounded-lg ${selectedThreadId===conv.id?'bg-blue-50 border border-blue-200':'hover:bg-gray-50'}`}
                    > 
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={conv.channel_logo_url || ''} />
                            <AvatarFallback className="text-[10px]">💬</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-medium truncate">{conv.contact_name}</h3>
                            <p className="text-xs text-gray-600 truncate mt-1">{conv.last_message_preview || '—'}</p>
                            <div className="mt-1 flex items-center gap-1.5 min-w-0">
                              <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span className="text-xs text-gray-600 truncate">
                                {conv.channel?.display_name || conv.channel?.provider || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 w-[120px]">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{getListTimestamp(conv)}</span>
                          <div className="mt-1">{renderStatus(conv)}</div>
                        </div>
                      </div>
                    </button>
                    {!conv.contact_id && canDeleteConversation && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-10 h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(event)=>{ event.stopPropagation(); handleOpenDelete(conv); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete conversation</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ))}
               </div>
            </div>
          </TabsContent>
          <TabsContent value="unassigned" className="mt-0">
            <div className="h-[calc(100vh-280px)] overflow-y-auto">
              <div className="space-y-1">
                {filteredConversations.filter(c=>c.status !== 'closed' && !c.assigned).map(conv => (
                  <div key={conv.id} className="relative">
                    <button
                      type="button"
                      onClick={()=>handleConversationSelect(conv.id)}
                      className={`w-full p-3 pr-12 text-left transition-colors rounded-lg ${selectedThreadId===conv.id?'bg-blue-50 border border-blue-200':'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src="" />
                            <AvatarFallback className="text-[10px]">💬</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold truncate">{conv.contact_name}</h3>
                            <p className="text-xs text-gray-600 truncate">{conv.last_message_preview}</p>
                            <div className="mt-1 flex items-center gap-1.5 min-w-0">
                              <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span className="text-xs text-gray-600 truncate">
                                {conv.channel?.display_name || conv.channel?.provider || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 w-[120px]">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{getListTimestamp(conv)}</span>
                          <div className="mt-1">{renderStatus(conv)}</div>
                        </div>
                      </div>
                    </button>
                    {!conv.contact_id && canDeleteConversation && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-10 h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(event)=>{ event.stopPropagation(); handleOpenDelete(conv); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete conversation</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ))}
               </div>
            </div>
          </TabsContent>

          <TabsContent value="resolved" className="mt-0">
            <div className="h-[calc(100vh-280px)] overflow-y-auto">
              <div className="space-y-1">
                {filteredConversations.filter(c=>c.status === 'closed').map(conv => (
                  <div key={conv.id} className="relative">
                    <button
                      type="button"
                      onClick={()=>handleConversationSelect(conv.id)}
                      className={`w-full p-3 pr-12 text-left transition-colors rounded-lg ${selectedThreadId===conv.id?'bg-blue-50 border border-blue-200':'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src="" />
                            <AvatarFallback className="text-[10px]">💬</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold truncate">{conv.contact_name}</h3>
                            <p className="text-xs text-gray-600 truncate">{conv.last_message_preview}</p>
                            <div className="mt-1 flex items-center gap-1.5 min-w-0">
                              <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span className="text-xs text-gray-600 truncate">
                                {conv.channel?.display_name ||  'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 w-[120px]">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{getListTimestamp(conv)}</span>
                          <div className="mt-1">{renderStatus(conv)}</div>
                        </div>
                      </div>
                    </button>
                    {!conv.contact_id && canDeleteConversation && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-10 h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(event)=>{ event.stopPropagation(); handleOpenDelete(conv); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete conversation</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ))}
               </div>
            </div>
          </TabsContent>
        </Tabs>
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This conversation is not linked to a saved contact. Deleting it will remove all associated messages permanently.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>

      {/* Main Content styled like ChatMock */}
      <article className="flex min-h-[70vh] flex-col rounded-lg border bg-card">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" />
                    <AvatarFallback className="text-sm">
                      {selectedConversation.contact_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-base font-semibold leading-tight">
                      {selectedConversation.contact_name}
                    </h2>
                    {selectedConversation.contact_phone && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedConversation.contact_phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={messageSearch} onChange={(e)=>setMessageSearch(e.target.value)} placeholder="Search messages" className="pl-7 h-8 w-44 text-xs" />
                  </div>
                  {selectedConversation.status !== 'closed' &&
                    <Button
                      size="sm"
                      className="h-8 bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
                      onClick={async()=>{ if(selectedConversation.status==='closed') return; const { error } = await protectedSupabase.from('threads').update({ status:'closed', resolved_at: new Date().toISOString(), resolved_by_user_id: user?.id ?? null, handover_reason: null }).eq('id', selectedConversation.id); if(error){ toast.error('Failed to resolve'); } else { toast.success('Conversation resolved'); await fetchConversations(); setActiveTab('resolved'); }} }
                    >
                      Resolve
                    </Button>
                  }
                  <Badge className={selectedConversation.assigned ? "bg-success text-success-foreground hover:bg-success" : "bg-secondary text-secondary-foreground hover:bg-secondary"}>
                    {selectedConversation.assigned ? 'Assigned' : 'Unassigned'}
                  </Badge>
                </div>
              </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={message.id} ref={el => { messageRefs.current[message.id] = el; }}>
                      <MessageBubble
                        message={message}
                        isLastMessage={index === messages.length - 1}
                        highlighted={highlightMessageId === message.id}
                      />
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input or Takeover / Join */}
            <div className="border-t p-3">
              {selectedConversation.assigned ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={`Message ${selectedConversation.contact_name}...`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1"
                    disabled={!hasPermission('messages.create')}
                  />
                  <Button 
                    type="button" 
                    onClick={handleSendMessage} 
                    disabled={!draft.trim() || !hasPermission('messages.create')} 
                    title={!hasPermission('messages.create') ? 'No permission to send messages' : 'Send message'}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <PermissionGate permission={'threads.update'}>
                  <Button 
                    type="button"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                    onClick={handleTakeoverChat} 
                    disabled={!user?.id}
                  >
                    Takeover Chat
                  </Button>
                </PermissionGate>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
              <p>Select a conversation from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </article>

      {/* Right sidebar - Conversation info */}
      <aside className="rounded-lg border bg-card p-4">
        {selectedConversation ? (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-lg font-semibold">{selectedConversation.contact_name || 'Unknown Contact'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {selectedConversation.channel?.display_name || selectedConversation.channel?.provider || 'Unknown'}
                  </Badge>
                  {selectedConversation.channel?.type && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedConversation.channel.type}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Labels */}
            {/* <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Labels</h3>
              <Button variant="outline" size="sm" className="h-8">
                <Tag className="h-4 w-4 mr-2" /> Add Label
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">No labels yet</div> */}

            {/* Handled By */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Handled By</h3>
              <Popover open={assignOpen} onOpenChange={setAssignOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <UserPlus className="h-4 w-4 mr-2" /> Assign Agent
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0">
                  <Command>
                    <CommandInput placeholder="Search agent" />
                    <CommandEmpty>No agent found.</CommandEmpty>
                    <CommandGroup>
                      {humanAgents.map((agent) => (
                        <CommandItem key={agent.user_id} onSelect={async()=>{ if(!selectedConversation) return; await assignThread(selectedConversation.id, agent.user_id); setAssignOpen(false); }}>
                          {agent.display_name || 'Agent'}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Collaborators */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Collaborators</h3>
              <Popover open={collabOpen} onOpenChange={setCollabOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <UserPlus className="h-4 w-4 mr-2" /> Add Collaborator
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0">
                  <Command>
                    <CommandInput placeholder="Search agent" />
                    <CommandEmpty>No agent found.</CommandEmpty>
                    <CommandGroup>
                      {humanAgents.map((agent) => (
                        <CommandItem key={agent.user_id} onSelect={async()=>{ if(!selectedConversation) return; await handleAddParticipant(agent.user_id); setCollabOpen(false); }}>
                          {agent.display_name || 'Agent'}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-sm font-medium mb-2">Notes</h3>
              <div className="flex items-center gap-2">
                <Input placeholder="Add a note..." />
              </div>
            </div>

            {/* AI Summary */}
            {/* <div>
              <h3 className="text-sm font-medium mb-2">AI Summary</h3>
              <Button variant="outline" className="w-full h-10" onClick={()=>toast.message('AI summary generation coming soon')}>Generate AI Summary</Button>
            </div> */}

            {/* Additional Data */}
            {/* <div>
              <h3 className="text-sm font-medium mb-2">Additional Data</h3>
              <Button variant="outline" className="w-full h-10">Add New Additional Info</Button>
            </div> */}

            {/* Conversation Details */}
            <div>
              <h3 className="text-sm font-medium mb-3">Conversation Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Assigned By</span><span>{(selectedConversation as any).assigned_by_name || '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Handled By</span><span>{(selectedConversation as any).assignee_name || '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Resolved By</span><span>{(selectedConversation as any).resolved_by_name || '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">AI Handoff At</span><span>{(selectedConversation as any).ai_handoff_at ? new Date((selectedConversation as any).ai_handoff_at).toLocaleString() : '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Assigned At</span><span>{(selectedConversation as any).assigned_at ? new Date((selectedConversation as any).assigned_at).toLocaleString() : '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Created At</span><span>{selectedConversation.created_at ? new Date(selectedConversation.created_at).toLocaleString() : '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Resolved At</span><span>{(selectedConversation as any).resolved_at ? new Date((selectedConversation as any).resolved_at).toLocaleString() : '—'}</span></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No conversation selected</div>
        )}
      </aside>
    </div>
  );
}
