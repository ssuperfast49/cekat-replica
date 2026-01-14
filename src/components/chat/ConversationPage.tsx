import { useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ChevronUp,
  Tag,
  UserMinus,
  Send,
  MoreVertical,
  CheckCircle,
  X,
  Trash2
} from "lucide-react";
import { useConversations, ConversationWithDetails, MessageWithDetails, type ThreadFilters } from "@/hooks/useConversations";
import { useContacts } from "@/hooks/useContacts";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { toast } from "sonner";
import { supabase, protectedSupabase } from "@/lib/supabase";
import { useRBAC } from "@/contexts/RBACContext";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/types/rbac";
import { setSendMessageProvider } from "@/config/webhook";
import { isDocumentHidden, onDocumentVisible } from "@/lib/utils";
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
import { SearchableSelect } from "@/components/ui/searchable-select";

interface MatchPosition {
  start: number;
  length: number;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatPlatformLabel = (providerRaw: string) => {
  const p = providerRaw.trim().toLowerCase();
  if (p === "telegram" || p === "Telegram") return "Telegram";
  if (p === "whatsapp" || p === "wa") return "WhatsApp";
  if (p === "web") return "Web";
  return providerRaw;
};

type FlowTab = 'assigned' | 'unassigned' | 'done';

const getFlowTabForThread = (thread?: Pick<ConversationWithDetails, 'status'> | null): FlowTab | null => {
  if (!thread) return null;
  const status = String(thread.status || '').toLowerCase();
  if (status === 'closed') return 'done';
  // FE flow rule:
  // - Unassigned = status "open"
  // - Assigned   = status "pending"
  // - Done       = status "closed"
  if (status === 'open') return 'unassigned';
  if (status === 'pending') return 'assigned';
  // Back-compat (older enum value). Treat as assigned.
  if (status === 'assigned') return 'assigned';
  return 'unassigned';
};

const isFlowAssigned = (thread?: Pick<ConversationWithDetails, 'status'> | null) =>
  getFlowTabForThread(thread) === 'assigned';
const isFlowUnassigned = (thread?: Pick<ConversationWithDetails, 'status'> | null) =>
  getFlowTabForThread(thread) === 'unassigned';
const isFlowDone = (thread?: Pick<ConversationWithDetails, 'status'> | null) =>
  getFlowTabForThread(thread) === 'done';

interface MessageBubbleProps {
  message: MessageWithDetails;
  isLastMessage: boolean;
  highlighted?: boolean;
  matches?: MatchPosition[];
  activeMatchOrder?: number;
}

interface MessageSearchMatch extends MatchPosition {
  messageId: string;
  order: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMessageDateLabel = (date: Date) => {
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = startOfToday.getTime() - startOfTarget.getTime();
  const diffDays = Math.floor(diffMs / DAY_IN_MS);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

type MessageRenderItem =
  | { type: "date"; key: string; label: string }
  | { type: "message"; key: string; message: MessageWithDetails };

const MessageBubble = ({ message, isLastMessage, highlighted = false, matches = [], activeMatchOrder = -1 }: MessageBubbleProps) => {
  const isAgent = message.role === 'assistant' || message.role === 'agent' || message.direction === 'out';
  const isSystem = message.role === 'system' || message.type === 'event' || message.type === 'note';
  const isHumanAgent = message.role === 'assistant';
  const isAiAgent = message.role === 'agent';

  const renderBodyWithHighlights = () => {
    const body = message.body || '';
    if (!body || matches.length === 0) {
      return body;
    }

    const sortedMatches = [...matches].sort((a, b) => a.start - b.start);
    const segments: (string | { type: 'highlight'; content: string; index: number })[] = [];
    let cursor = 0;

    sortedMatches.forEach(({ start, length }, idx) => {
      if (start > cursor) {
        segments.push(body.slice(cursor, start));
      }
      const highlightedText = body.slice(start, start + length);
      segments.push({ type: 'highlight', content: highlightedText, index: idx });
      cursor = start + length;
    });

    if (cursor < body.length) {
      segments.push(body.slice(cursor));
    }

    return segments.map((segment, idx) => {
      if (typeof segment === 'string') {
        return <span key={`seg-${idx}`}>{segment}</span>;
      }
      const isActive = segment.index === activeMatchOrder;
      return (
        <mark
          key={`highlight-${segment.index}`}
          className={`rounded-sm px-0.5 text-current text-black ${isActive ? 'bg-orange-300' : 'bg-yellow-200'}`}
        >
          {segment.content}
        </mark>
      );
    });
  };

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
          className={`rounded-lg px-3 py-2 text-sm shadow-sm ${isAiAgent
              ? "bg-blue-600 text-white"
              : isHumanAgent
                ? "bg-blue-100 text-blue-900"
                : "bg-muted text-foreground"
            } ${highlighted ? 'ring-2 ring-yellow-300' : ''}`}
        >
          <p className="whitespace-pre-wrap">
            {renderBodyWithHighlights()}
          </p>
          <div className={`mt-1 flex items-center gap-1 text-[10px] ${isAiAgent ? "text-blue-100" : isHumanAgent ? "text-blue-700" : "text-muted-foreground"
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
  const [activeTab, setActiveTab] = useState<FlowTab>("assigned");
  const [tabLocked, setTabLocked] = useState(false); // lock smart auto-switch once user manually selects a tab
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const trimmedSearch = messageSearch.trim();

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
    addThreadLabel,
    removeThreadLabel,
    assignThread,
    assignThreadToUser,
    takeoverThread,
    unassignThread,
    clearCollaborator,
    deleteThread,
    setThreadCollaborator,
  } = useConversations();

  // Use the contacts and human agents hooks
  const { createContact } = useContacts();
  const { agents: humanAgents } = useHumanAgents();
  const { user } = useAuth();
  const { hasRole, hasPermission } = useRBAC();
  const isMasterAgent = hasRole('master_agent');
  const isSuperAgent = hasRole('super_agent');
  const isRegularAgentOnly = hasRole('agent') && !isMasterAgent && !isSuperAgent;
  const canMoveToUnassigned = isMasterAgent || isSuperAgent;
  const canSendMessagesPermission = hasPermission('messages.create');
  const currentUserId = user?.id ?? null;
  // Track optimistic collaborator updates per thread
  const [collaboratorOverride, setCollaboratorOverride] = useState<{ threadId: string; userId: string | null } | null>(null);
  const [moveToUnassignedLoading, setMoveToUnassignedLoading] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConversationWithDetails | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const canDeleteConversation = hasPermission('contacts.delete');
  const [activeFilters, setActiveFilters] = useState<ThreadFilters>({});
  const isPushingFiltersRef = useRef(false);
  const filtersInitRef = useRef(false);
  const FILTERS_STORAGE_KEY = useMemo(() => `chat.threadFilters.v1:${user?.id || 'anon'}`, [user?.id]);
  const [channelIdToName, setChannelIdToName] = useState<Record<string, string>>({});
  const [channelIdToProvider, setChannelIdToProvider] = useState<Record<string, string>>({});
  
  // Optimistic "handled by" value while an assignment request is in-flight.
  // IMPORTANT: scope it to a specific thread so it doesn't leak to other threads when navigating.
  const [superAgentMemberAgentIds, setSuperAgentMemberAgentIds] = useState<string[]>([]);
  const [userIdToLabel, setUserIdToLabel] = useState<Record<string, string>>({});
  
  // Options for the "Handled By" selector: only Super Agents
  const superAgentOptions = useMemo(
    () =>
      humanAgents
        .filter((a: any) => String(a?.primaryRole || '').toLowerCase() === 'super_agent')
        .map((a: any) => ({ value: a.user_id, label: a.display_name || a.email || 'Unknown Agent' })),
    [humanAgents]
  );

  // Options for general agent picking (collaborators, etc.): all non-master agents
  const agentOptions = useMemo(
    () =>
      humanAgents
        .filter((a: any) => String(a?.primaryRole || '').toLowerCase() !== 'master_agent')
        .map((a: any) => ({ value: a.user_id, label: a.display_name || a.email || 'Unknown Agent' })),
    [humanAgents]
  );

  const humanAgentIdToLabel = useMemo(() => {
    return Object.fromEntries(
      humanAgents.map((a: any) => [String(a.user_id), String(a.display_name || a.email || 'Unknown')])
    ) as Record<string, string>;
  }, [humanAgents]);

  const labelForUserId = useMemo(() => {
    return (id: string) => humanAgentIdToLabel[id] || userIdToLabel[id] || id;
  }, [humanAgentIdToLabel, userIdToLabel]);

  // Derive current handled-by (assignee) without referencing selectedConversation (avoid TDZ)
  const [handledByOverride, setHandledByOverride] = useState<{ threadId: string; userId: string | null } | null>(null);

  const derivedHandledById = useMemo(() => {
    if (!selectedThreadId) return null;
    const t = conversations.find(c => c.id === selectedThreadId) as any;
    return (t?.assignee_user_id as string | null) ?? null;
  }, [selectedThreadId, conversations]);

  const handledById = useMemo(() => {
    if (!selectedThreadId) return null;
    if (handledByOverride?.threadId === selectedThreadId) return handledByOverride.userId;
    return derivedHandledById;
  }, [selectedThreadId, handledByOverride, derivedHandledById]);

  useEffect(() => {
    if (!selectedThreadId) {
      setHandledByOverride(null);
      return;
    }
    if (
      handledByOverride?.threadId === selectedThreadId &&
      derivedHandledById === handledByOverride.userId
    ) {
      setHandledByOverride(null);
    }
  }, [selectedThreadId, derivedHandledById, handledByOverride]);


  // Fetch allowed collaborator agents for the selected handled-by (super agent)
  useEffect(() => {
    if (!handledById) {
      setSuperAgentMemberAgentIds([]);
      return;
    }
    let active = true;
    const fetchMembers = async () => {
      const { data, error } = await protectedSupabase
        .from('super_agent_members')
        .select('agent_user_id')
        .eq('super_agent_id', handledById);

      if (!active) return;
      if (error) {
        console.warn('Failed to fetch super agent members', error);
        setSuperAgentMemberAgentIds([]);
        return;
      }
      setSuperAgentMemberAgentIds((data || []).map((r: any) => String(r.agent_user_id)));
    };
    fetchMembers();
    return () => { active = false; };
  }, [handledById]);

  const messageMatches = useMemo<MessageSearchMatch[]>(() => {
    if (!trimmedSearch) {
      return [];
    }

    const safeTerm = escapeRegExp(trimmedSearch);
    if (!safeTerm) {
      return [];
    }

    return messages.flatMap((msg) => {
      const body = msg.body || "";
      if (!body) {
        return [];
      }
      const regex = new RegExp(safeTerm, "gi");
      const matches: MessageSearchMatch[] = [];
      let perMessageIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(body)) !== null) {
        matches.push({
          messageId: msg.id,
          start: match.index,
          length: match[0].length,
          order: perMessageIndex,
        });
        perMessageIndex += 1;

        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
      return matches;
    });
  }, [trimmedSearch, messages]);

  const matchesByMessage = useMemo<Record<string, MatchPosition[]>>(() => {
    if (messageMatches.length === 0) {
      return {};
    }
    const map = messageMatches.reduce<Record<string, MatchPosition[]>>((acc, match) => {
      if (!acc[match.messageId]) {
        acc[match.messageId] = [];
      }
      acc[match.messageId].push({ start: match.start, length: match.length });
      return acc;
    }, {});

    Object.values(map).forEach((positions) => {
      positions.sort((a, b) => a.start - b.start);
    });

    return map;
  }, [messageMatches]);

  const matchCount = messageMatches.length;
  const activeMatch = matchCount > 0 ? messageMatches[currentMatchIndex] : null;

  const lastMessageId = useMemo(() => (messages.length > 0 ? messages[messages.length - 1].id : null), [messages]);

  const messagesWithDateSeparators = useMemo<MessageRenderItem[]>(() => {
    const items: MessageRenderItem[] = [];
    let lastDateKey: string | null = null;

    messages.forEach((message) => {
      const createdAt = message.created_at;
      if (createdAt) {
        const createdDate = new Date(createdAt);
        if (!Number.isNaN(createdDate.getTime())) {
          const dateKey = getLocalDateKey(createdDate);
          if (dateKey !== lastDateKey) {
            const label = formatMessageDateLabel(createdDate);
            if (label) {
              items.push({
                type: "date",
                key: `date-${dateKey}`,
                label,
              });
            }
            lastDateKey = dateKey;
          }
        }
      }

      items.push({
        type: "message",
        key: message.id,
        message,
      });
    });

    return items;
  }, [messages]);

  const normalizeFilterString = (v: any) => {
    const s = (v ?? '').toString();
    if (!s || s === 'all') return '';
    return s;
  };

  const hasAnyActiveFilters = (f: ThreadFilters) => {
    return Boolean(
      (f.dateRange?.from || f.dateRange?.to) ||
      normalizeFilterString(f.inbox) ||
      normalizeFilterString(f.channelType) ||
      normalizeFilterString(f.platformId) ||
      normalizeFilterString(f.status) ||
      normalizeFilterString(f.agent) ||
      normalizeFilterString(f.resolvedBy)
    );
  };

  const serializeFiltersSignature = (f: ThreadFilters) => {
    const from = f.dateRange?.from ? f.dateRange.from.getTime() : 0;
    const to = f.dateRange?.to ? f.dateRange.to.getTime() : 0;
    return [
      from,
      to,
      normalizeFilterString(f.inbox),
      normalizeFilterString(f.channelType),
      normalizeFilterString(f.platformId),
      normalizeFilterString(f.status),
      normalizeFilterString(f.agent),
      normalizeFilterString(f.resolvedBy),
    ].join('|');
  };

  const parseFiltersFromSearchParams = (params: URLSearchParams): ThreadFilters => {
    const fromMsRaw = params.get('f_from');
    const toMsRaw = params.get('f_to');
    const fromMs = fromMsRaw ? Number(fromMsRaw) : 0;
    const toMs = toMsRaw ? Number(toMsRaw) : 0;
    const dateRange =
      fromMs || toMs
        ? {
            from: fromMs ? new Date(fromMs) : undefined,
            to: toMs ? new Date(toMs) : undefined,
          }
        : undefined;

    const inbox = normalizeFilterString(params.get('f_inbox'));
    const channelType = normalizeFilterString(params.get('f_channelType'));
    const platformId = normalizeFilterString(params.get('f_platformId'));
    const status = normalizeFilterString(params.get('f_status'));
    const agent = normalizeFilterString(params.get('f_agent'));
    const resolvedBy = normalizeFilterString(params.get('f_resolvedBy'));

    const out: ThreadFilters = {};
    if (dateRange) out.dateRange = dateRange;
    if (inbox) out.inbox = inbox;
    if (channelType) out.channelType = channelType;
    if (platformId) out.platformId = platformId;
    if (status) out.status = status;
    if (agent) out.agent = agent;
    if (resolvedBy) out.resolvedBy = resolvedBy;
    return out;
  };

  const writeFiltersToSearchParams = (params: URLSearchParams, f: ThreadFilters) => {
    const keys = ['f_from', 'f_to', 'f_inbox', 'f_channelType', 'f_platformId', 'f_status', 'f_agent', 'f_resolvedBy'];
    keys.forEach((k) => params.delete(k));

    if (f.dateRange?.from) params.set('f_from', String(f.dateRange.from.getTime()));
    if (f.dateRange?.to) params.set('f_to', String(f.dateRange.to.getTime()));
    if (normalizeFilterString(f.inbox)) params.set('f_inbox', normalizeFilterString(f.inbox));
    if (normalizeFilterString(f.channelType)) params.set('f_channelType', normalizeFilterString(f.channelType));
    if (normalizeFilterString(f.platformId)) params.set('f_platformId', normalizeFilterString(f.platformId));
    if (normalizeFilterString(f.status)) params.set('f_status', normalizeFilterString(f.status));
    if (normalizeFilterString(f.agent)) params.set('f_agent', normalizeFilterString(f.agent));
    if (normalizeFilterString(f.resolvedBy)) params.set('f_resolvedBy', normalizeFilterString(f.resolvedBy));
  };

  const handleFilterChange = (nextFilters: ThreadFilters) => {
    setActiveFilters(nextFilters);
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
        ...nextFilters,
        dateRange: nextFilters.dateRange
          ? {
              from: nextFilters.dateRange.from ? nextFilters.dateRange.from.getTime() : undefined,
              to: nextFilters.dateRange.to ? nextFilters.dateRange.to.getTime() : undefined,
            }
          : undefined,
      }));
    } catch {}

    const next = new URLSearchParams(window.location.search);
    writeFiltersToSearchParams(next, nextFilters);
    isPushingFiltersRef.current = true;
    setSearchParams(next, { replace: true });
    setTimeout(() => { isPushingFiltersRef.current = false; }, 0);

    void fetchConversations(nextFilters);
  };

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [trimmedSearch]);

  useEffect(() => {
    if (matchCount > 0 && currentMatchIndex >= matchCount) {
      setCurrentMatchIndex(0);
    }
  }, [currentMatchIndex, matchCount]);

  useEffect(() => {
    if (!trimmedSearch || !activeMatch) {
      setHighlightMessageId(null);
      return;
    }

    setHighlightMessageId(activeMatch.messageId);
    const el = messageRefs.current[activeMatch.messageId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [trimmedSearch, activeMatch]);

  const handleNextMatch = () => {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
  };

  const handlePrevMatch = () => {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
  };

  // Get contact ID and tab from URL parameters
  const contactId = searchParams.get('contact');
  const threadParam = searchParams.get('thread');
  const tabParam = searchParams.get('tab');

  // Bidirectional URL<->state sync with loop guard
  const isPushingTabRef = useRef(false);
  useEffect(() => {
    if (!tabParam) return;
    if (isPushingTabRef.current) return; // ignore echo from our own push
    const normalized = tabParam === 'resolved' ? 'done' : tabParam;
    if (normalized === 'assigned' || normalized === 'unassigned' || normalized === 'done') {
      if (normalized !== activeTab) setActiveTab(normalized as FlowTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  // Fetch channels map for showing friendly filter labels (Platform name, provider).
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const { data, error } = await protectedSupabase
          .from('channels')
          .select('id, display_name, provider')
          .order('created_at', { ascending: false });
        if (!active) return;
        if (error) throw error;
        const nameMap: Record<string, string> = {};
        const providerMap: Record<string, string> = {};
        (data || []).forEach((row: any) => {
          nameMap[String(row.id)] = String(row.display_name || 'Unknown');
          providerMap[String(row.id)] = String(row.provider || '');
        });
        setChannelIdToName(nameMap);
        setChannelIdToProvider(providerMap);
      } catch {
        if (!active) return;
        setChannelIdToName({});
        setChannelIdToProvider({});
      }
    };
    run();
    return () => { active = false; };
  }, []);

  // Initialize filters from URL (preferred) or localStorage (fallback), and keep URL changes (back/forward) in sync.
  useEffect(() => {
    if (isPushingFiltersRef.current) return;
    const fromUrl = parseFiltersFromSearchParams(searchParams);

    // First load: if URL has no filter params, fallback to localStorage once.
    if (!filtersInitRef.current) {
      filtersInitRef.current = true;
      if (!hasAnyActiveFilters(fromUrl)) {
        try {
          const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw || '{}') as any;
            const revived: ThreadFilters = {
              ...parsed,
              dateRange: parsed?.dateRange
                ? {
                    from: parsed.dateRange.from ? new Date(Number(parsed.dateRange.from)) : undefined,
                    to: parsed.dateRange.to ? new Date(Number(parsed.dateRange.to)) : undefined,
                  }
                : undefined,
            };
            setActiveFilters(revived);
            const next = new URLSearchParams(window.location.search);
            writeFiltersToSearchParams(next, revived);
            isPushingFiltersRef.current = true;
            setSearchParams(next, { replace: true });
            setTimeout(() => { isPushingFiltersRef.current = false; }, 0);
            void fetchConversations(revived);
            return;
          }
        } catch { /* ignore */ }
      }
    }

    const urlSig = serializeFiltersSignature(fromUrl);
    const localSig = serializeFiltersSignature(activeFilters);
    if (urlSig !== localSig) {
      setActiveFilters(fromUrl);
      void fetchConversations(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString(), FILTERS_STORAGE_KEY]);

  const filteredConversations = useMemo(() => {
    const list = conversations.filter((conv) =>
      `${conv.contact_name} ${conv.last_message_preview}`.toLowerCase().includes(query.toLowerCase())
    );
    return [...list].sort((a, b) => {
      const aTs = new Date(a.last_msg_at ?? a.created_at ?? 0).getTime();
      const bTs = new Date(b.last_msg_at ?? b.created_at ?? 0).getTime();
      return bTs - aTs;
    });
  }, [conversations, query]);

  // Smart Tab Switching: If the current tab is empty but another tab has data (based on RLS results), switch to it.
  useEffect(() => {
    if (tabLocked) return;
    if (loading || conversations.length === 0) return;

    const assignedCount = conversations.filter((c) => isFlowAssigned(c)).length;
    const unassignedCount = conversations.filter((c) => isFlowUnassigned(c)).length;
    const doneCount = conversations.filter((c) => isFlowDone(c)).length;

    if (activeTab === 'assigned' && assignedCount === 0 && unassignedCount > 0) {
      setActiveTab('unassigned');
      return;
    }

    if ((activeTab === 'assigned' || activeTab === 'unassigned') && assignedCount === 0 && unassignedCount === 0 && doneCount > 0) {
      setActiveTab('done');
      return;
    }
  }, [conversations, loading, activeTab, tabLocked]);

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

  // Auto-select by explicit thread param (preferred). This disambiguates multi-channel contacts.
  useEffect(() => {
    if (!threadParam) return;
    if (selectedThreadId === threadParam) return; // already synced
    if (filteredConversations.length === 0) return;

    const target = filteredConversations.find(c => c.id === threadParam);
    if (!target) return;

    setSelectedThreadId(target.id);
    setActiveTab(getFlowTabForThread(target) ?? 'unassigned');
    void fetchMessages(target.id);
    if (target.channel?.provider) {
      setSendMessageProvider(target.channel.provider);
    }
  }, [threadParam, filteredConversations, selectedThreadId]);

  // Auto-select by contactId only on first load for this navigation; do not override manual selection
  useEffect(() => {
    if (!contactId) return;
    if (threadParam) return; // explicit thread param wins
    if (selectedThreadId) return; // user has already selected a thread; don't override
    if (filteredConversations.length === 0) return;
    const target = filteredConversations.find(c => c.contact_id === contactId);
    if (!target) return;
    setSelectedThreadId(target.id);
    // Ensure tab reflects the selected conversation
    setActiveTab(getFlowTabForThread(target) ?? 'unassigned');
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
  const isSelectedConversationDone = isFlowDone(selectedConversation);
  const selectedConversationFlow = getFlowTabForThread(selectedConversation);

  const derivedCollaboratorId = useMemo(() => {
    if (!selectedThreadId) return null;
    return selectedConversation?.collaborator_user_id ?? null;
  }, [selectedThreadId, selectedConversation?.collaborator_user_id]);

  const collaboratorId = useMemo(() => {
    if (!selectedThreadId) return null;
    if (collaboratorOverride?.threadId === selectedThreadId) {
      return collaboratorOverride.userId ?? null;
    }
    return derivedCollaboratorId;
  }, [selectedThreadId, collaboratorOverride, derivedCollaboratorId]);

  // Load display labels for any collaborator/member IDs not present in humanAgents
  useEffect(() => {
    const ids = Array.from(new Set([
      ...(handledById ? [handledById] : []),
      ...(collaboratorId ? [collaboratorId] : []),
      ...superAgentMemberAgentIds,
    ].filter(Boolean))) as string[];

    if (ids.length === 0) return;

    const missing = ids.filter(id => !humanAgentIdToLabel[id] && !userIdToLabel[id]);
    if (missing.length === 0) return;

    let active = true;
    const fetchLabels = async () => {
      try {
        const { data, error } = await protectedSupabase
          .from('users_profile')
          .select('user_id, display_name')
          .in('user_id', missing);

        if (!active) return;
        if (error) throw error;

        const nextMap: Record<string, string> = Object.fromEntries(
          (data || []).map((p: any) => [String(p.user_id), String(p.display_name || '')])
        );

        setUserIdToLabel(prev => ({ ...prev, ...nextMap }));
      } catch (e) {
        // non-fatal: fallback will still show ids
        console.warn('Failed to fetch user labels', e);
      }
    };
    fetchLabels();
    return () => { active = false; };
  }, [handledById, collaboratorId, superAgentMemberAgentIds, humanAgentIdToLabel, userIdToLabel]);

  const collaboratorOptions = useMemo(() => {
    if (!handledById) return [];
    const allowed = new Set(superAgentMemberAgentIds);
    return agentOptions
      .filter(o => allowed.has(o.value))
      .map(o => ({ ...o, label: labelForUserId(o.value) }));
  }, [agentOptions, handledById, superAgentMemberAgentIds, labelForUserId]);

  const selectedCollaboratorId = collaboratorId ? String(collaboratorId) : null;

  const collaboratorOptionsWithSelected = useMemo(() => {
    // Ensure selected collaborator always has a label, even if they aren't in the allowed list/options.
    const map = new Map<string, { value: string; label: string }>();
    collaboratorOptions.forEach(o => map.set(o.value, o));
    if (selectedCollaboratorId && !map.has(selectedCollaboratorId)) {
      map.set(selectedCollaboratorId, { value: selectedCollaboratorId, label: labelForUserId(selectedCollaboratorId) });
    }
    return Array.from(map.values());
  }, [collaboratorOptions, selectedCollaboratorId, labelForUserId]);

  const isCurrentUserCollaborator = useMemo(() => {
    if (!currentUserId || !selectedCollaboratorId) return false;
    return selectedCollaboratorId === currentUserId;
  }, [selectedCollaboratorId, currentUserId]);

  const selectedStatus = (selectedConversation?.status || '').toLowerCase();
  const aiAllowedByStatus = selectedStatus === 'pending';

  // Only the collaborator who took over can send replies
  const roleAllowsSend = useMemo(() => {
    if (!currentUserId) return false;
    return selectedCollaboratorId === currentUserId;
  }, [currentUserId, selectedCollaboratorId]);

  const canCurrentUserSend = roleAllowsSend;

  const sendDisabledReason = useMemo(() => {
    if (canCurrentUserSend) return undefined;
    return 'Only the collaborator who took over can send messages.';
  }, [canCurrentUserSend]);

  useEffect(() => {
    if (!selectedThreadId) {
      setCollaboratorOverride(null);
      return;
    }
    if (
      collaboratorOverride?.threadId === selectedThreadId &&
      derivedCollaboratorId === collaboratorOverride.userId
    ) {
      setCollaboratorOverride(null);
    }
  }, [selectedThreadId, derivedCollaboratorId, collaboratorOverride]);

  const handleTakeoverChat = async () => {
    if (!selectedConversation) return;
    if (!user?.id) {
      toast.error('You must be signed in to take over');
      return;
    }
    try {
      await takeoverThread(selectedConversation.id);
      setCollaboratorOverride({ threadId: selectedConversation.id, userId: user.id });
      toast.success('You are now assigned to this chat');
      setActiveTab('assigned');
      await fetchConversations(undefined, { silent: true });
    } catch (e) {
      toast.error('Failed to take over chat');
    }
  };

  const handleMoveToUnassigned = async () => {
    if (!selectedConversation) return;
    if (!canMoveToUnassigned) {
      toast.error('Only master or super agents can move conversations to Unassigned');
      return;
    }
    setMoveToUnassignedLoading(true);
    try {
      // Use RPC-backed unassign to clear collaborator and reopen AI without changing handled-by
      await unassignThread(selectedConversation.id);
      setCollaboratorOverride({ threadId: selectedConversation.id, userId: null });
      toast.success('Conversation moved to Unassigned');
      setActiveTab('unassigned');
      await fetchConversations(undefined, { silent: true });
      await fetchMessages(selectedConversation.id);
    } catch (error) {
      toast.error('Failed to move conversation to Unassigned');
    } finally {
      setMoveToUnassignedLoading(false);
    }
  };

  const handleResolveConversation = async () => {
    if (!selectedConversation) return;
    setResolveLoading(true);
    try {
      const { error } = await protectedSupabase
        .from('threads')
        .update({
          status: 'closed',
          ai_access_enabled: true, // reopen AI access after resolve
          ai_handoff_at: null,
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: user?.id ?? null,
          handover_reason: null,
        })
        .eq('id', selectedConversation.id);
      if (error) throw error;

      // Log system event for resolve
      try {
        const { data: profile } = await supabase
          .from('users_profile')
          .select('display_name')
          .eq('user_id', user?.id ?? '')
          .single();

        await protectedSupabase.from('messages').insert([{
          thread_id: selectedConversation.id,
          direction: null,
          role: 'system',
          type: 'event',
          body: `Conversation resolved by ${profile?.display_name || user?.email || 'agent'}.`,
          payload: { event: 'resolve', user_id: user?.id ?? null },
        }]);
      } catch (eventErr) {
        console.warn('Failed to insert resolve event message', eventErr);
      }

      toast.success('Conversation resolved');
      setActiveTab('done');
      await fetchConversations(undefined, { silent: true });
      await fetchMessages(selectedConversation.id);
    } catch (error) {
      toast.error('Failed to resolve');
    } finally {
      setResolveLoading(false);
    }
  };

  // Simple + reliable: always keep chat pinned to bottom on message updates (realtime/refetch).
  useLayoutEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    try {
      viewport.scrollTop = viewport.scrollHeight;
    } catch {}
  }, [messages, selectedThreadId]);

  // Handle conversation selection
  const handleConversationSelect = async (threadId: string) => {
    // Set provider based on the selected conversation's channel.provider
    const conv = filteredConversations.find(c => c.id === threadId);
    if (conv?.channel?.provider) {
      setSendMessageProvider(conv.channel.provider);
    }
    setSelectedThreadId(threadId);
    // Keep URL in sync so deep-links work and URL selection doesn't override manual changes
    try {
      const next = new URLSearchParams(window.location.search);
      next.set('thread', threadId);
      if (conv?.contact_id) next.set('contact', conv.contact_id);
      setSearchParams(next, { replace: true });
    } catch { }
    await fetchMessages(threadId);
  };

  // Keep selection aligned to the active tab so each tab shows a matching thread category.
  useEffect(() => {
    const selectFirstForTab = () => {
      if (activeTab === 'done') {
        return filteredConversations.find(conv => isFlowDone(conv)) || null;
      }
      if (activeTab === 'assigned') {
        return filteredConversations.find(conv => isFlowAssigned(conv)) || null;
      }
      // unassigned
      return filteredConversations.find(conv => isFlowUnassigned(conv)) || null;
    };

    // If nothing selected, pick the first thread in the current tab (if any).
    if (!selectedThreadId) {
      const first = selectFirstForTab();
      if (first?.id) void handleConversationSelect(first.id);
      return;
    }

    const selectedCategory = getFlowTabForThread(selectedConversation);
    // If selected thread doesn't match current tab, switch selection to the first thread in the tab.
    if (selectedConversation && selectedCategory !== activeTab) {
      const first = selectFirstForTab();
      if (first?.id) {
        void handleConversationSelect(first.id);
      } else {
        // No threads available in this tab; clear selection to avoid showing a stale thread.
        setSelectedThreadId(null);
      }
    }
  }, [activeTab, filteredConversations, selectedThreadId, selectedConversation]);

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
          await fetchConversations(undefined, { silent: true });
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

  // Update webhook provider whenever selected conversation changes
  useEffect(() => {
    if (selectedConversation?.channel?.provider) {
      setSendMessageProvider(selectedConversation.channel.provider);
    }
  }, [selectedConversation?.channel?.provider]);

  // Helpers for thread list UI
  const formatListTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24 && diffHours >= 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (diffHours >= 24 && diffHours < 48) {
      return 'Yesterday';
    }

    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const renderStatus = (conv: ConversationWithDetails) => {
    const category = getFlowTabForThread(conv);
    if (category === 'done') {
      return <Badge className="bg-green-100 text-green-700 border-0">Done</Badge>;
    }
    if (category === 'assigned') {
      return <Badge className="bg-blue-100 text-blue-700 border-0">Assigned</Badge>;
    }
    return <Badge className="bg-secondary text-secondary-foreground">Unassigned</Badge>;
  };

  const getListTimestamp = (conv: any) => {
    const ts = (conv as any).last_msg_at || (conv as any).updated_at || (conv as any).created_at || '';
    return formatListTime(ts);
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
          <Button onClick={() => { void fetchConversations(undefined, { silent: true }); }} variant="outline">
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
            <ChatFilter
              value={{
                dateRange: activeFilters.dateRange || {},
                inbox: (activeFilters.inbox as any) || '',
                label: [],
                agent: (activeFilters.agent as any) || '',
                status: (activeFilters.status as any) || '',
                resolvedBy: (activeFilters.resolvedBy as any) || '',
                platformId: (activeFilters.platformId as any) || '',
                channelType: (activeFilters.channelType as any) || 'all',
              }}
              onFilterChange={handleFilterChange}
            />
          </div>
        </div>
        {hasAnyActiveFilters(activeFilters) && (
          <div className="mb-2 flex flex-wrap gap-1">
            {activeFilters.channelType && (
              <Badge variant="secondary">
                Channel: {String(activeFilters.channelType).toLowerCase() === 'web' ? 'Live Chat' : String(activeFilters.channelType)}
              </Badge>
            )}
            {activeFilters.platformId && (
              <Badge variant="secondary">
                Platform: {channelIdToName[String(activeFilters.platformId)] || String(activeFilters.platformId)}
              </Badge>
            )}
            {activeFilters.status && (
              <Badge variant="secondary">Status: {String(activeFilters.status)}</Badge>
            )}
            {activeFilters.agent && (
              <Badge variant="secondary">Agent: {labelForUserId(String(activeFilters.agent))}</Badge>
            )}
            {activeFilters.resolvedBy && (
              <Badge variant="secondary">Resolved By: {labelForUserId(String(activeFilters.resolvedBy))}</Badge>
            )}
            {(activeFilters.dateRange?.from || activeFilters.dateRange?.to) && (
              <Badge variant="secondary">
                Date: {activeFilters.dateRange?.from ? new Date(activeFilters.dateRange.from).toLocaleDateString() : '…'} →{' '}
                {activeFilters.dateRange?.to ? new Date(activeFilters.dateRange.to).toLocaleDateString() : '…'}
              </Badge>
            )}
            {activeFilters.inbox && (
              <Badge variant="secondary">Inbox: {String(activeFilters.inbox)}</Badge>
            )}
          </div>
        )}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10 h-8 text-sm" />
        </div>
        {(() => {
          const assignedList = filteredConversations.filter(conv => isFlowAssigned(conv));
          const unassignedList = filteredConversations.filter(conv => isFlowUnassigned(conv));
          const doneList = filteredConversations.filter(conv => isFlowDone(conv));
          const tabs: Array<{ key: FlowTab; label: string; count: number; className: string; tooltip: string }> = [
            { key: 'assigned', label: 'Assigned', count: assignedList.length, className: 'bg-blue-50 text-blue-600 border-blue-500', tooltip: 'Lihat percakapan yang ditugaskan ke agen' },
            { key: 'unassigned', label: 'Unassigned', count: unassignedList.length, className: 'bg-red-50 text-red-600 border-red-500', tooltip: 'Lihat percakapan yang menunggu penugasan' },
            { key: 'done', label: 'Done', count: doneList.length, className: 'bg-green-50 text-green-600 border-green-500', tooltip: 'Lihat percakapan yang selesai' },
          ];
          const renderEmpty = (label: string) => (
            <div className="h-[calc(100vh-280px)] flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground bg-muted/40">
              No {label} threads found
            </div>
          );
          const renderList = (list: typeof filteredConversations) => (
            <div className="space-y-1">
              {list.map(conv => (
                <div key={conv.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleConversationSelect(conv.id)}
                    className={`w-full p-3 pr-12 text-left transition-colors rounded-lg ${selectedThreadId === conv.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}
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
                      <div className="flex flex-col items-end shrink-0 w-[130px] self-stretch justify-between">
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{getListTimestamp(conv)}</span>
                          <div className="mt-1">{renderStatus(conv)}</div>
                        </div>
                        {(conv.channel_provider || conv.channel?.provider) ? (
                          <Badge variant="outline" className="h-5 px-2 text-[10px] shrink-0">
                            {formatPlatformLabel(String(conv.channel_provider || conv.channel?.provider))}
                          </Badge>
                        ) : <span />}
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
                          onClick={(event) => { event.stopPropagation(); handleOpenDelete(conv); }}
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
          );
          const renderContent = () => {
            if (activeTab === 'assigned') {
              return assignedList.length === 0 ? renderEmpty('assigned') : renderList(assignedList);
            }
            if (activeTab === 'unassigned') {
              return unassignedList.length === 0 ? renderEmpty('unassigned') : renderList(unassignedList);
            }
            return doneList.length === 0 ? renderEmpty('done') : renderList(doneList);
          };

          return (
            <>
              <div className="grid w-full grid-cols-[1fr_1fr_auto] mb-3 bg-white">
                {tabs.map((tab) => (
                  <Tooltip key={tab.key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => { setTabLocked(true); setActiveTab(tab.key); }}
                        className={`text-xs h-8 rounded-md border-b-2 transition-colors flex items-center justify-center gap-2 px-2 ${
                          activeTab === tab.key
                            ? `${tab.className}`
                            : 'text-muted-foreground border-transparent hover:bg-muted'
                        }`}
                        aria-pressed={activeTab === tab.key}
                      >
                        {tab.key === 'done' ? <CheckCircle className="h-4 w-4" /> : null}
                        <span>{tab.label}</span>
                        <Badge variant="secondary" className="h-5 text-xs" aria-live="polite" aria-atomic="true">
                          {tab.count}
                        </Badge>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tab.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <div className="h-[calc(100vh-280px)] overflow-y-auto">
                {renderContent()}
              </div>
            </>
          );
        })()}
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
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      placeholder="Search messages"
                      className="pl-7 h-8 w-44 text-xs"
                    />
                  </div>
                  {trimmedSearch && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="text-xs font-medium min-w-[48px] text-right">
                        {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : "0/0"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handlePrevMatch}
                        disabled={matchCount === 0}
                        aria-label="Temukan sebelumnya"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleNextMatch}
                        disabled={matchCount === 0}
                        aria-label="Temukan berikutnya"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedConversationFlow === 'assigned' && canMoveToUnassigned && (
                    <Button
                      size="sm"
                      className="h-8 bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-60"
                      onClick={handleMoveToUnassigned}
                      disabled={moveToUnassignedLoading}
                    >
                      {moveToUnassignedLoading ? 'Moving…' : 'Move to Unassigned'}
                    </Button>
                  )}
                  {selectedConversation.status !== 'closed' && (
                    <Button
                      size="sm"
                      className="h-8 bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
                      onClick={handleResolveConversation}
                      disabled={resolveLoading}
                    >
                      {resolveLoading ? 'Resolving…' : 'Resolve'}
                    </Button>
                  )}
                </div>
                <Badge
                  className={
                    selectedConversationFlow === 'done'
                      ? "bg-green-100 text-green-700 border-0"
                      : selectedConversationFlow === 'assigned'
                        ? "bg-success text-success-foreground hover:bg-success"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary"
                  }
                >
                  {selectedConversationFlow === 'done'
                    ? 'Done'
                    : selectedConversationFlow === 'assigned'
                      ? 'Assigned'
                      : 'Unassigned'}
                </Badge>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea viewportRef={messagesViewportRef as any} className="flex-1 p-4">
              <div className="space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messagesWithDateSeparators.map((entry) => {
                    if (entry.type === "date") {
                      return (
                        <div key={entry.key} className="flex justify-center my-4">
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            {entry.label}
                          </span>
                        </div>
                      );
                    }

                    const message = entry.message;
                    return (
                      <div key={entry.key} ref={el => { messageRefs.current[message.id] = el; }}>
                        <MessageBubble
                          message={message}
                          isLastMessage={message.id === lastMessageId}
                          highlighted={highlightMessageId === message.id}
                          matches={matchesByMessage[message.id] ?? []}
                          activeMatchOrder={activeMatch?.messageId === message.id ? activeMatch.order : -1}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Message Input or Takeover / Join */}
            <div className="border-t p-3 space-y-2">
              {!isSelectedConversationDone && collaboratorId === user?.id && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={`Message ${selectedConversation.contact_name}...`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1"
                    disabled={!canCurrentUserSend}
                    title={sendDisabledReason}
                  />
                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!draft.trim() || !canCurrentUserSend}
                    title={sendDisabledReason || 'Send message'}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {(!isSelectedConversationDone && collaboratorId !== user?.id) && (
                <Button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleTakeoverChat}
                  disabled={!user?.id}
                  title={user?.id ? undefined : 'You must be signed in'}
                >
                  Takeover Chat
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
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Handled By</h3>
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {handledById ? (labelForUserId(handledById) || '—') : '—'}
              </div>
            </div>

            {/* Collaborators */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Collaborator</h3>
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {selectedCollaboratorId ? (labelForUserId(selectedCollaboratorId) || '—') : '—'}
              </div>

            </div>

            {/* Notes */}
            {/* <div>
              <h3 className="text-sm font-medium mb-2">Notes</h3>
              <div className="flex items-center gap-2">
                <Input placeholder="Add a note..." />
              </div>
            </div> */}

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
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Handled By</span><span>{handledById ? (labelForUserId(handledById) || '—') : '—'}</span></div>
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
