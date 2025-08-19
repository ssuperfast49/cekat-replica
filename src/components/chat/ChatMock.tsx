import { useMemo, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Phone, Mail, Clock, CheckCheck, Loader2, RefreshCw, Search, Filter, Plus, List, Users, ChevronDown } from "lucide-react";
import { useConversations, ConversationWithDetails, MessageWithDetails } from "@/hooks/useConversations";
import { toast } from "sonner";

// Legacy interfaces for backward compatibility
interface Conversation {
  id: string;
  name: string;
  preview: string;
  time: string;
  assigned: boolean;
}

interface Message {
  id: string;
  author: "customer" | "agent";
  text: string;
  time: string;
}

const Bubble = ({ m }: { m: Message }) => {
  const isAgent = m.author === "agent";
  return (
    <div className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
          isAgent
            ? "bg-brand text-brand-foreground"
            : "bg-secondary text-foreground"
        }`}
      >
        <p>{m.text}</p>
        <div className={`mt-1 flex items-center gap-1 text-[10px] ${isAgent ? "text-brand-foreground/80" : "text-muted-foreground"}`}>
          <Clock className="h-3 w-3" />
          <span>{m.time}</span>
          {isAgent && <CheckCheck className="h-3 w-3" aria-label="delivered" />}
        </div>
      </div>
    </div>
  );
};

export default function ChatMock() {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the conversations hook
  const {
    conversations,
    messages,
    loading,
    error,
    selectedThreadId,
    fetchConversations,
    fetchMessages,
    sendMessage,
  } = useConversations();

  // Transform conversations to match the expected format
  const transformedConversations: Conversation[] = useMemo(() => {
    return conversations.map((conv) => ({
      id: conv.id,
      name: conv.contact_name,
      preview: conv.last_message_preview || "No messages yet",
      time: new Date(conv.last_msg_at).toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit" 
      }),
      assigned: conv.assigned,
    }));
  }, [conversations]);

  // Transform messages to match the expected format
  const transformedMessages: Message[] = useMemo(() => {
    return messages.map((msg) => ({
      id: msg.id,
      author: msg.direction === 'in' ? 'customer' : 'agent',
      text: msg.body || '',
      time: new Date(msg.created_at).toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit" 
      }),
    }));
  }, [messages]);

  // Get selected conversation
  const selected = useMemo(() => {
    if (!selectedThreadId) {
      return transformedConversations[0] || {
        id: "",
        name: "No conversations",
        preview: "",
        time: "",
        assigned: false,
      };
    }
    return transformedConversations.find(c => c.id === selectedThreadId) || transformedConversations[0];
  }, [selectedThreadId, transformedConversations]);

  const filtered = useMemo(
    () =>
      transformedConversations.filter((c) =>
        `${c.name} ${c.preview}`.toLowerCase().includes(query.toLowerCase())
      ),
    [transformedConversations, query]
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || !selectedThreadId) return;
    
    try {
      await sendMessage(selectedThreadId, text);
      setDraft("");
      toast.success('Message sent successfully!');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    fetchMessages(conversation.id);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transformedMessages]);

  return (
    <section aria-label="Chat Inbox" className="grid gap-4 md:grid-cols-[300px_1fr_320px]">
      {/* Error Display */}
      {error && (
        <div className="col-span-full bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">Error: {error}</p>
        </div>
      )}

      {/* Conversations list */}
      <article className="rounded-lg border bg-card p-3">
        {/* Header with dropdown and actions */}
        <div className="mb-3 flex items-center justify-between">
          <Select defaultValue="all-agents">
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
              <ChevronDown className="h-4 w-4 opacity-50" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-agents">All Agent</SelectItem>
              <SelectItem value="agent-1">Agent 1</SelectItem>
              <SelectItem value="agent-2">Agent 2</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchConversations}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tabs for Assigned/Unassigned */}
        <Tabs defaultValue="assigned" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="assigned" className="text-xs">
              Assigned
              <Badge variant="secondary" className="ml-2 h-5 text-xs">
                {filtered.filter(c => c.assigned).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unassigned" className="text-xs">
              Unassigned
              <Badge variant="secondary" className="ml-2 h-5 text-xs">
                {filtered.filter(c => !c.assigned).length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assigned" className="mt-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.filter(c => c.assigned).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleConversationSelect(c)}
                      className={`w-full p-3 text-left transition-colors rounded-lg ${
                        selected.id === c.id
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 truncate">{c.name}</h3>
                            <span className="text-xs text-gray-500 ml-2">{c.time}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{c.preview}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3 text-blue-500" />
                              <span className="text-xs text-gray-400">OKBANG TOP UP CE...</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className="bg-blue-100 text-blue-600 text-xs">
                            Assigned
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unassigned" className="mt-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.filter(c => !c.assigned).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleConversationSelect(c)}
                      className={`w-full p-3 text-left transition-colors rounded-lg ${
                        selected.id === c.id
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 truncate">{c.name}</h3>
                            <span className="text-xs text-gray-500 ml-2">{c.time}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{c.preview}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3 text-blue-500" />
                              <span className="text-xs text-gray-400">OKBANG TOP UP CE...</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="secondary" className="text-xs">
                            Unassigned
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </article>

      {/* Conversation */}
      <article className="flex min-h-[70vh] flex-col rounded-lg border bg-card">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {selected.name[0] || '?'}
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">{selected.name || 'No conversation selected'}</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </div>
            </div>
          </div>
          <Badge className={selected.assigned ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}>
            {selected.assigned ? 'Assigned' : 'Unassigned'}
          </Badge>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {transformedMessages.map((m) => (
              <Bubble key={m.id} m={m} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <footer className="border-t p-3">
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${selected.name || 'contact'}...`}
              aria-label="Type a message"
              disabled={!selectedThreadId}
            />
            <Button 
              onClick={send} 
              className="bg-brand text-brand-foreground hover:opacity-90"
              disabled={!selectedThreadId || !draft.trim()}
            >
              Send
            </Button>
          </div>
        </footer>
      </article>

      {/* Details */}
      <aside className="hidden rounded-lg border bg-card p-4 md:block">
        <h2 className="text-sm font-semibold">Contact Details</h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {selected.name[0] || '?'}
          </div>
          <div>
            <div className="text-sm font-medium">{selected.name || 'No contact'}</div>
            <div className="text-xs text-muted-foreground">Customer</div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" /> 
            {selected.name ? '+62 812-3456-7890' : 'No phone'}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" /> 
            {selected.name ? 'user@example.com' : 'No email'}
          </div>
        </div>
        <Separator className="my-4" />
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">VIP</Badge>
            <Badge variant="secondary">Repeat</Badge>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary">Assign</Button>
          <Button variant="secondary">Close</Button>
          <Button variant="secondary">Snooze</Button>
          <Button variant="secondary">Spam</Button>
        </div>
      </aside>
    </section>
  );
}
