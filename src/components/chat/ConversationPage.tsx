import { useMemo, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  MoreVertical
} from "lucide-react";
import { useConversations, ConversationWithDetails, MessageWithDetails } from "@/hooks/useConversations";
import { useContacts } from "@/hooks/useContacts";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface MessageBubbleProps {
  message: MessageWithDetails;
  isLastMessage: boolean;
}

const MessageBubble = ({ message, isLastMessage }: MessageBubbleProps) => {
  const isAgent = message.role === 'assistant' || message.role === 'agent' || message.direction === 'out';
  const isSystem = message.role === 'system' || message.type === 'event' || message.type === 'note';
  
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
          {message.body || 'System message'}
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
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.body}</p>
          <div className={`mt-1 flex items-center gap-1 text-[10px] ${
            isAgent ? "text-primary-foreground/80" : "text-muted-foreground"
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
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  } = useConversations();

  // Use the contacts and human agents hooks
  const { createContact } = useContacts();
  const { agents: humanAgents } = useHumanAgents();

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) =>
      `${conv.contact_name} ${conv.last_message_preview}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [conversations, query]);

  // Get selected conversation
  const selectedConversation = useMemo(() => {
    if (!selectedThreadId) {
      return filteredConversations[0] || null;
    }
    return filteredConversations.find(c => c.id === selectedThreadId) || filteredConversations[0] || null;
  }, [selectedThreadId, filteredConversations]);

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
    <div className="flex h-[calc(100vh-120px)]">
      {/* Left Sidebar - Conversations List */}
      <div className="w-80 border-r border-border bg-card">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Conversations List */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2">
              {filteredConversations.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No conversations found
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <Card 
                    key={conversation.id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedThreadId === conversation.id ? 'bg-accent border-primary' : ''
                    }`}
                    onClick={() => handleConversationSelect(conversation.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src="" />
                          <AvatarFallback className="text-sm">
                            {conversation.contact_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">
                            {conversation.contact_name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {conversation.last_message_preview}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {conversation.channel_type}
                            </Badge>
                            {conversation.assigned && (
                              <Badge variant="default" className="text-xs">
                                Assigned
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(conversation.last_msg_at).toLocaleTimeString([], { 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content - Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" />
                    <AvatarFallback className="text-sm">
                      {selectedConversation.contact_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {selectedConversation.contact_name}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowParticipants(!showParticipants)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Participants
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLabels(!showLabels)}
                  >
                    <Tag className="h-4 w-4 mr-2" />
                    Labels
                  </Button>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
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
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isLastMessage={index === messages.length - 1}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
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
      </div>

      {/* Right Sidebar - Participants & Labels */}
      {(showParticipants || showLabels) && (
        <div className="w-80 border-l border-border bg-card">
          <div className="p-4">
            {showParticipants && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Participants</h3>
                <div className="space-y-2">
                  {humanAgents.map((agent) => (
                    <div key={agent.user_id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{agent.display_name || agent.email}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddParticipant(agent.user_id)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {showLabels && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Labels</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Label management coming soon...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
