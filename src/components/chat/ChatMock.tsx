import { useMemo, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageSquare, Phone, Mail, Clock, CheckCheck, Loader2, RefreshCw, Search, Filter, Plus, List, Users, ChevronDown } from "lucide-react";
import { useConversations, ConversationWithDetails, MessageWithDetails } from "@/hooks/useConversations";
import { useContacts } from "@/hooks/useContacts";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ChatFilter } from './ChatFilter';

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
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [newContactForm, setNewContactForm] = useState({
    inbox: "",
    name: "",
    phoneNumber: "",
    template: ""
  });
  const [isCreatingContact, setIsCreatingContact] = useState(false);
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
    createConversation,
  } = useConversations();

  // Use the contacts hook
  const { createContact } = useContacts();

  // N8N webhook URL for sending messages
  const n8nWebhookUrl = "https://primary-production-376c.up.railway.app/webhook/2f6f9767-c3cb-4af3-b749-a496eefc2b74/waha";

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
    return messages.map((msg) => {
      // Determine author based on role and direction
      let author: 'customer' | 'agent' = 'customer';
      if (msg.role === 'assistant' || msg.role === 'agent') {
        author = 'agent';
      } else if (msg.role === 'user') {
        author = 'customer';
      } else if (msg.direction === 'out') {
        author = 'agent';
      } else if (msg.direction === 'in') {
        author = 'customer';
      }

      return {
        id: msg.id,
        author,
        text: msg.body || '',
        time: new Date(msg.created_at).toLocaleTimeString([], { 
          hour: "2-digit", 
          minute: "2-digit" 
        }),
      };
    });
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
      // Get the current conversation to find the contact's phone number
      const currentConversation = conversations.find(conv => conv.id === selectedThreadId);
      if (!currentConversation) {
        toast.error('Conversation not found');
        return;
      }

      console.log('Sending message via N8N webhook:', {
        thread_id: selectedThreadId,
        contact_name: currentConversation.contact_name,
        contact_phone: currentConversation.contact_phone,
        channel_type: currentConversation.channel_type,
        message_text: text
      });

             // Format phone number for WAHA API (remove + and add @c.us suffix)
       const wahaPhoneNumber = currentConversation.contact_phone.replace('+', '') + '@c.us';
       
       // Send message via N8N webhook (handles both WAHA API and database storage)
       const n8nResponse = await fetch(n8nWebhookUrl, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           event: "message",
           session: "default",
           engine: "WEBJS",
           payload: {
             id: `true_${wahaPhoneNumber}_${Date.now()}`,
             timestamp: Math.floor(Date.now() / 1000),
             from: wahaPhoneNumber,
             fromMe: true,
             source: "app",
             to: wahaPhoneNumber,
             body: text,
             hasMedia: false,
             ack: 1,
             vCards: [],
             _data: {}
           }
         })
       });

      console.log('N8N webhook response status:', n8nResponse.status);
      
      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.warn('N8N webhook failed:', errorText);
        toast.error('Failed to send message');
        return;
      }

      const responseData = await n8nResponse.json();
      console.log('Message sent successfully via N8N:', responseData);
      
      // Refresh messages to show the new message
      await fetchMessages(selectedThreadId);
      
      setDraft("");
      toast.success('Message sent successfully!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleNewContactSubmit = async () => {
    if (!newContactForm.name.trim() || !newContactForm.phoneNumber.trim()) {
      toast.error('Please fill in both name and phone number');
      return;
    }

    // Validate phone number format for WhatsApp
    const phoneNumber = newContactForm.phoneNumber.trim();
    const phoneRegex = /^(\+?62|0)8[1-9][0-9]{6,9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast.error('Please enter a valid Indonesian phone number (e.g., +6281234567890 or 081234567890)');
      return;
    }

    // Format phone number for WhatsApp API (ensure it starts with country code)
    const formattedPhone = phoneNumber.startsWith('+62') 
      ? phoneNumber 
      : phoneNumber.startsWith('62') 
        ? `+${phoneNumber}`
        : phoneNumber.startsWith('0')
          ? `+62${phoneNumber.substring(1)}`
          : `+62${phoneNumber}`;

    setIsCreatingContact(true);
    
    try {
      // 1. Create new contact in database
      const newContact = await createContact({
        name: newContactForm.name,
        phone: formattedPhone,
        email: null,
        notes: `Created via chat interface. Inbox: ${newContactForm.inbox}`,
        locale: 'id'
      });

      // 2. Get or create WhatsApp channel
      const { data: channels } = await supabase
        .from('channels')
        .select('id')
        .eq('org_id', '00000000-0000-0000-0000-000000000001')
        .eq('type', 'whatsapp')
        .eq('is_active', true)
        .limit(1);

      let channelId = channels?.[0]?.id;
      
      if (!channelId) {
        // Create WhatsApp channel if it doesn't exist
        const { data: newChannel } = await supabase
          .from('channels')
          .insert([{
            org_id: '00000000-0000-0000-0000-000000000001',
            type: 'whatsapp',
            provider: 'meta',
            display_name: 'WhatsApp Business',
            is_active: true
          }])
          .select('id')
          .single();
        
        channelId = newChannel?.id;
      }

      if (!channelId) {
        throw new Error('Failed to get or create WhatsApp channel');
      }

      // 3. Create new conversation/thread
      const newThread = await createConversation(newContact.id, channelId);

             // 4. Send initial message via N8N webhook
       const initialMessage = getInitialMessage(newContactForm.template);
       
               try {
          // Format phone number for WAHA API (remove + and add @c.us suffix)
          const wahaPhoneNumber = formattedPhone.replace('+', '') + '@c.us';
          
          // Send initial message via N8N webhook (handles both WAHA API and database storage)
          const n8nResponse = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              event: "message",
              session: "default",
              engine: "WEBJS",
              payload: {
                id: `true_${wahaPhoneNumber}_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000),
                from: wahaPhoneNumber,
                fromMe: true,
                source: "app",
                to: wahaPhoneNumber,
                body: initialMessage,
                hasMedia: false,
                ack: 1,
                vCards: [],
                _data: {}
              }
            })
          });

         if (!n8nResponse.ok) {
           console.warn('N8N webhook failed for initial message, but contact was created');
         } else {
           console.log('Initial message sent successfully via N8N');
         }
       } catch (n8nError) {
         console.warn('N8N webhook error:', n8nError);
         // Continue even if N8N webhook fails - the contact and thread are still created
       }

      // 6. Refresh conversations and select the new one
      await fetchConversations();
      await fetchMessages(newThread.id);

      toast.success(`Contact ${newContactForm.name} created and initial message sent to ${formattedPhone}!`);
      setNewContactOpen(false);
      setNewContactForm({
        inbox: "",
        name: "",
        phoneNumber: "",
        template: ""
      });

    } catch (error) {
      console.error('Error creating contact:', error);
      toast.error('Failed to create contact: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsCreatingContact(false);
    }
  };

  const getInitialMessage = (template: string): string => {
    switch (template) {
      case 'welcome':
        return `Halo ${newContactForm.name}! 👋 Selamat datang di Okbang Top Up Center. Ada yang bisa kami bantu?`;
      case 'follow-up':
        return `Halo ${newContactForm.name}! 👋 Terima kasih telah menghubungi kami. Bagaimana kabar Anda hari ini?`;
      case 'support':
        return `Halo ${newContactForm.name}! 👋 Terima kasih telah menghubungi tim support kami. Silakan sampaikan keluhan atau pertanyaan Anda.`;
      default:
        return `Halo ${newContactForm.name}! 👋 Selamat datang di Okbang Top Up Center. Ada yang bisa kami bantu?`;
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
            <ChatFilter onFilterChange={(filters) => console.log('Filters applied:', filters)} />
            <Dialog open={newContactOpen} onOpenChange={setNewContactOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>New Contact</DialogTitle>
                  <DialogDescription>
                    Create a new contact and start a conversation.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="inbox" className="text-right">
                      Inbox
                    </Label>
                    <Select 
                      value={newContactForm.inbox} 
                      onValueChange={(value) => setNewContactForm({...newContactForm, inbox: value})}
                      disabled={isCreatingContact}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select inbox" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="telegram">Telegram</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={newContactForm.name}
                      onChange={(e) => setNewContactForm({...newContactForm, name: e.target.value})}
                      placeholder="Contact name"
                      className="col-span-3"
                      disabled={isCreatingContact}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      value={newContactForm.phoneNumber}
                      onChange={(e) => setNewContactForm({...newContactForm, phoneNumber: e.target.value})}
                      placeholder="e.g., +6281234567890 or 081234567890"
                      className="col-span-3"
                      disabled={isCreatingContact}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="template" className="text-right">
                      Template
                    </Label>
                    <Select 
                      value={newContactForm.template} 
                      onValueChange={(value) => setNewContactForm({...newContactForm, template: value})}
                      disabled={isCreatingContact}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="welcome">Welcome Message</SelectItem>
                        <SelectItem value="follow-up">Follow Up</SelectItem>
                        <SelectItem value="support">Support Inquiry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    onClick={handleNewContactSubmit}
                    disabled={isCreatingContact}
                  >
                    {isCreatingContact ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Contact'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
      <aside className="rounded-lg border bg-card p-4">
        <div className="space-y-4">
          {/* Contact Header */}
          <div>
            <h2 className="text-lg font-semibold">{selected.name || 'No Contact'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">OKBANG TOP UP CENTER</span>
            </div>
          </div>

          {/* Labels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Labels</h3>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                + Add Label
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">No labels yet</p>
          </div>

          <Separator />

          {/* Handled By */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Handled By</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                J
              </div>
              <span className="text-sm">Julian</span>
            </div>
          </div>

          {/* Collaborators */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Collaborators</h3>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                + Add Collaborator
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                A
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium mb-2">Notes</h3>
            <div className="text-sm text-muted-foreground border border-dashed border-gray-300 rounded p-2 text-center">
              Add a note...
            </div>
          </div>

          {/* AI Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">AI Summary</h3>
              <Button variant="outline" size="sm" className="h-7 text-xs text-blue-600">
                Generate AI Summary
              </Button>
            </div>
          </div>

          {/* Additional Data */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Additional Data</h3>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Add New Additional Info
              </Button>
            </div>
          </div>

          <Separator />

          {/* Conversation Details */}
          <div>
            <h3 className="text-sm font-medium mb-3">Conversation Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned By</span>
                <span>-</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Handled By</span>
                <span>Julian</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Resolved By</span>
                <span>Agent 01</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">AI Handoff At</span>
                <span>August 13th 2025, 2:57 pm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned At</span>
                <span>August 13th 2025, 3:18 pm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created At</span>
                <span>August 13th 2025, 2:51 pm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Resolved At</span>
                <span>August 13th 2025, 3:16 pm</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Conversation Access */}
          <div>
            <h3 className="text-sm font-medium mb-2">Conversation Access</h3>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-green-600">Active - Click to Block</span>
            </div>
          </div>

          {/* AI Access */}
          <div>
            <h3 className="text-sm font-medium mb-2">AI Access</h3>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-green-600">AI Access - Click to Block</span>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
