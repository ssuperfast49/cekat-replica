import { useMemo, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatFilter } from "./ChatFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Clock, 
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
  CheckCircle
} from "lucide-react";
import { useConversations, ConversationWithDetails, MessageWithDetails } from "@/hooks/useConversations";
import { useContacts } from "@/hooks/useContacts";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

interface MessageBubbleProps {
  message: MessageWithDetails;
  isLastMessage: boolean;
  highlighted?: boolean;
}

const MessageBubble = ({ message, isLastMessage, highlighted = false }: MessageBubbleProps) => {
  const isAgent = message.role === 'assistant' || message.role === 'agent' || message.direction === 'out';
  const isSystem = message.role === 'system' || message.type === 'event' || message.type === 'note';
  
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
            isAgent
              ? "bg-blue-100 text-blue-900"
              : "bg-muted text-foreground"
          } ${highlighted ? 'ring-2 ring-yellow-300' : ''}`}
        >
          <p className="whitespace-pre-wrap">{message.body}</p>
          <div className={`mt-1 flex items-center gap-1 text-[10px] ${
            isAgent ? "text-blue-700" : "text-muted-foreground"
          }`}>
            <Clock className="h-3 w-3" />
            <span>{new Date(message.created_at).toLocaleTimeString([], { 
              hour: "2-digit", 
              minute: "2-digit" 
            })}</span>
            {isAgent && isLastMessage && (
              <CheckCheck className="h-3 w-3" aria-label="delivered" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ConversationPage() {
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
  } = useConversations();

  // Use the contacts and human agents hooks
  const { createContact } = useContacts();
  const { agents: humanAgents } = useHumanAgents();
  const { user } = useAuth();
  const [assignOpen, setAssignOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(false);

  // Filter conversations based on search query
  const [filters, setFilters] = useState<any>({});
  const filteredConversations = useMemo(() => {
    let list = conversations.filter((conv) =>
      `${conv.contact_name} ${conv.last_message_preview}`.toLowerCase().includes(query.toLowerCase())
    );
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
    // Date range filter
    if (filters.dateRange?.from || filters.dateRange?.to) {
      const from = filters.dateRange.from ? new Date(filters.dateRange.from).getTime() : -Infinity;
      const to = filters.dateRange.to ? new Date(filters.dateRange.to).getTime() : Infinity;
      list = list.filter(c => {
        const ts = new Date(c.created_at).getTime();
        return ts >= from && ts <= to;
      });
    }
    return list;
  }, [conversations, query, filters]);

  // Get selected conversation
  const selectedConversation = useMemo(() => {
    if (!selectedThreadId) {
      return null; // Do not auto-pick any thread on first load
    }
    return filteredConversations.find(c => c.id === selectedThreadId) || null;
  }, [selectedThreadId, filteredConversations]);

  const handleTakeoverChat = async () => {
    if (!selectedConversation) return;
    if (!user?.id) {
      toast.error('You must be signed in to take over');
      return;
    }
    try {
      await assignThread(selectedConversation.id, user.id);
      toast.success('You are now assigned to this chat');
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
    setSelectedThreadId(threadId);
    await fetchMessages(threadId);
  };

  // Send message
  const handleSendMessage = async () => {
    const text = draft.trim();
    if (!text || !selectedThreadId) return;
    
    try {
      await sendMessage(selectedThreadId, text);
      setDraft("");
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
    <div className="grid w-full grid-cols-[300px_1fr_320px] h-[calc(100vh-120px)] gap-4">
      {/* Left sidebar styled like ChatMock */}
      <aside className="rounded-lg border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Conversations</h2>
          <div className="flex items-center gap-1">
            <ChatFilter onFilterChange={setFilters} />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={query} onChange={(e)=>setQuery(e.target.value)} className="pl-10 h-8 text-sm" />
        </div>
        <Tabs value={activeTab} onValueChange={(v)=>setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-[1fr_1fr_auto] mb-3 bg-white">
            <TabsTrigger
              value="assigned"
              className="text-xs border-b-2 border-transparent data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:border-blue-500"
            >
              Assigned
              <Badge variant="secondary" className="ml-2 h-5 text-xs">{filteredConversations.filter(c=>c.status !== 'closed' && c.assigned).length}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="unassigned"
              className="text-xs border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:border-red-500"
            >
              Unassigned
              <Badge variant="secondary" className="ml-2 h-5 text-xs">{filteredConversations.filter(c=>c.status !== 'closed' && !c.assigned).length}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="resolved"
              className="justify-self-end w-8 h-8 p-0 rounded-full border-b-2 border-transparent data-[state=active]:bg-green-50 data-[state=active]:text-green-600 data-[state=active]:border-green-500"
              aria-label="Resolved"
            >
              <CheckCircle className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="assigned" className="mt-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-1">
                {filteredConversations.filter(c=>c.status !== 'closed' && c.assigned).map(conv => (
                  <button key={conv.id} type="button" onClick={()=>handleConversationSelect(conv.id)} className={`w-full p-3 text-left transition-colors rounded-lg ${selectedThreadId===conv.id?'bg-blue-50 border border-blue-200':'hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium truncate">{conv.contact_name}</h3>
                          <span className="text-xs text-gray-500 ml-2">{new Date(conv.last_msg_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{conv.last_message_preview}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-blue-100 text-blue-600 text-xs">Assigned</Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="unassigned" className="mt-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-1">
                {filteredConversations.filter(c=>c.status !== 'closed' && !c.assigned).map(conv => (
                  <button key={conv.id} type="button" onClick={()=>handleConversationSelect(conv.id)} className={`w-full p-3 text-left transition-colors rounded-lg ${selectedThreadId===conv.id?'bg-blue-50 border border-blue-200':'hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium truncate">{conv.contact_name}</h3>
                          <span className="text-xs text-gray-500 ml-2">{new Date(conv.last_msg_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{conv.last_message_preview}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">Unassigned</Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="resolved" className="mt-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-1">
                {filteredConversations.filter(c=>c.status === 'closed').map(conv => (
                  <button key={conv.id} type="button" onClick={()=>handleConversationSelect(conv.id)} className={`w-full p-3 text-left transition-colors rounded-lg ${selectedThreadId===conv.id?'bg-blue-50 border border-blue-200':'hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium truncate">{conv.contact_name}</h3>
                          <span className="text-xs text-gray-500 ml-2">{new Date(conv.last_msg_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{conv.last_message_preview}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-green-100 text-green-700 text-xs">Resolved</Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {selectedConversation.channel_type}
                      </Badge>
                      {selectedConversation.contact_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedConversation.contact_phone}
                        </span>
                      )}
                      {selectedConversation.contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedConversation.contact_email}
                        </span>
                      )}
                    </div>
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
                      onClick={async()=>{ if(selectedConversation.status==='closed') return; const { error } = await supabase.from('threads').update({ status:'closed', resolved_at: new Date().toISOString(), resolved_by_user_id: user?.id ?? null }).eq('id', selectedConversation.id); if(error){ toast.error('Failed to resolve'); } else { toast.success('Conversation resolved'); await fetchConversations(); setActiveTab('resolved'); }} }
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

            {/* Message Input or Takeover */}
            <div className="border-t p-3">
              {selectedConversation.assigned ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={`Message ${selectedConversation.contact_name}...`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={!draft.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleTakeoverChat} disabled={!user?.id}>
                  Click to Takeover Chat
                </Button>
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
                <span className="text-sm text-muted-foreground">{selectedConversation.channel_type}</span>
              </div>
            </div>

            {/* Labels */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Labels</h3>
              <Button variant="outline" size="sm" className="h-8">
                <Tag className="h-4 w-4 mr-2" /> Add Label
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">No labels yet</div>

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
                <Button variant="outline" size="icon" className="h-9 w-9"> 
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* AI Summary */}
            <div>
              <h3 className="text-sm font-medium mb-2">AI Summary</h3>
              <Button variant="outline" className="w-full h-10" onClick={()=>toast.message('AI summary generation coming soon')}>Generate AI Summary</Button>
            </div>

            {/* Additional Data */}
            <div>
              <h3 className="text-sm font-medium mb-2">Additional Data</h3>
              <Button variant="outline" className="w-full h-10">Add New Additional Info</Button>
            </div>

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
