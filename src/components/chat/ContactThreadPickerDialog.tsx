import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, MessageSquare, ChevronRight } from "lucide-react";
import { protectedSupabase } from "@/lib/supabase";
import { waitForAuthReady } from "@/lib/authReady";
import { stripMarkdown } from "@/lib/utils";

type ChannelRow = {
  id: string;
  display_name: string | null;
  provider: string | null;
  type: string | null;
  logo_url?: string | null;
  profile_photo_url?: string | null;
  external_id?: string | null;
};

export type ContactThreadSummary = {
  id: string;
  contact_id: string;
  channel_id: string;
  status: "open" | "pending" | "closed";
  last_msg_at: string | null;
  created_at: string;
  channel: ChannelRow | null;
  last_message_preview: string;
};

export type ContactThreadPickerContact = {
  id: string;
  name?: string | null;
  phone?: string | null;
};

interface ContactThreadPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactThreadPickerContact | null;
  onSelectThread: (thread: ContactThreadSummary) => void;
}

const getPreview = (value: unknown) =>
  stripMarkdown(
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200)
  ) || "—";

const formatTs = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPlatform = (providerRaw: string) => {
  const p = providerRaw.trim().toLowerCase();
  if (p === "telegram" || p === "Telegram") return "Telegram";
  if (p === "whatsapp" || p === "wa") return "WhatsApp";
  if (p === "web") return "Web";
  return providerRaw;
};

export default function ContactThreadPickerDialog({
  open,
  onOpenChange,
  contact,
  onSelectThread,
}: ContactThreadPickerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ContactThreadSummary[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!contact?.id) return;

    let active = true;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        await waitForAuthReady();

        const { data, error } = await protectedSupabase
          .from("threads")
          .select(
            `
            id,
            contact_id,
            channel_id,
            status,
            last_msg_at,
            created_at,
            channels!inner(id, display_name, provider, type, logo_url, profile_photo_url, external_id),
            messages(id, body, role, direction, created_at, seq)
          `
          )
          .eq("contact_id", contact.id)
          .order("last_msg_at", { ascending: false })
          .order("created_at", { foreignTable: "messages", ascending: false })
          .limit(1, { foreignTable: "messages" });

        if (!active) return;
        if (error) throw error;

        const mapped: ContactThreadSummary[] = (data || []).map((row: any) => {
          const last = Array.isArray(row.messages) && row.messages.length > 0 ? row.messages[0] : null;
          const lastPreview = getPreview(last?.body);
          const lastAt = (last?.created_at as string | null) ?? (row.last_msg_at as string | null) ?? null;
          return {
            id: String(row.id),
            contact_id: String(row.contact_id),
            channel_id: String(row.channel_id),
            status: row.status as any,
            last_msg_at: lastAt,
            created_at: String(row.created_at),
            channel: row.channels
              ? {
                id: String(row.channels.id),
                display_name: row.channels.display_name ?? null,
                provider: row.channels.provider ?? null,
                type: row.channels.type ?? null,
                logo_url: row.channels.logo_url ?? null,
                profile_photo_url: row.channels.profile_photo_url ?? null,
                external_id: row.channels.external_id ?? null,
              }
              : null,
            last_message_preview: lastPreview,
          };
        });

        // Defensive: enforce 1 thread per channel in the UI (even if DB ever returns duplicates).
        const uniqueByChannel = new Map<string, ContactThreadSummary>();
        for (const t of mapped) {
          if (!uniqueByChannel.has(t.channel_id)) uniqueByChannel.set(t.channel_id, t);
        }

        const unique = Array.from(uniqueByChannel.values()).sort((a, b) => {
          const aTs = new Date(a.last_msg_at ?? a.created_at ?? 0).getTime();
          const bTs = new Date(b.last_msg_at ?? b.created_at ?? 0).getTime();
          return bTs - aTs;
        });

        setThreads(unique);
      } catch (e) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : "Failed to load conversations";
        setError(msg);
        setThreads([]);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [open, contact?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const channelName = String(t.channel?.display_name || "").toLowerCase();
      const provider = String(t.channel?.provider || "").toLowerCase();
      const last = String(t.last_message_preview || "").toLowerCase();
      return channelName.includes(q) || provider.includes(q) || last.includes(q);
    });
  }, [threads, query]);

  const titleName = contact?.name || contact?.phone || "Contact";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          {/* Keep count away from the dialog close button (top-right). */}
          <DialogTitle className="flex items-center gap-2 pr-10">
            <span className="min-w-0 truncate">Conversations for {titleName}</span>
            <Badge variant="secondary" className="shrink-0">
              {threads.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by channel or message…"
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <Separator />

        {/* Fit-to-content list with a max height (scroll only when needed). */}
        <div className="max-h-[52vh] overflow-y-auto pr-1 pb-2">
          <div className="space-y-2 p-1 pb-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading conversations…
              </div>
            ) : error ? (
              <div className="py-10 text-center text-sm text-destructive">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {query.trim() ? "No threads match your search." : "No conversations for this contact yet."}
              </div>
            ) : (
              filtered.map((t) => {
                const channelLabel = t.channel?.display_name || "Channel";
                const providerRaw = (t.channel?.provider || "").toString();
                const platformLabel = providerRaw ? formatPlatform(providerRaw) : "";
                const ts = t.last_msg_at || t.created_at;
                return (
                  <Button
                    key={t.id}
                    type="button"
                    variant="ghost"
                    className="w-full justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left hover:bg-muted/60 h-auto"
                    onClick={() => onSelectThread(t)}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 rounded-md bg-blue-600/10 p-2 text-blue-700">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 truncate font-medium">{channelLabel}</div>
                          <Badge
                            variant={t.status === "closed" ? "secondary" : t.status === "pending" ? "outline" : "default"}
                            className="capitalize"
                          >
                            {t.status}
                          </Badge>
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.last_message_preview}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 self-stretch">
                      <div className="flex h-full flex-col items-end justify-between">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{formatTs(ts)}</div>
                        {platformLabel ? (
                          <Badge variant="outline" className="h-5 px-2 text-[10px]">
                            {platformLabel}
                          </Badge>
                        ) : (
                          <span />
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Button>
                );
              })
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Each channel can have only one thread for a contact (unless an admin deletes the previous thread).
        </div>
      </DialogContent>
    </Dialog>
  );
}


