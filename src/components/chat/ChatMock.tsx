import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Phone, Mail, Clock, CheckCheck } from "lucide-react";

interface Conversation {
  id: string;
  name: string;
  preview: string;
  time: string;
  assigned: boolean;
}

const sampleConversations: Conversation[] = [
  { id: "1", name: "Dewi", preview: "Halo, saya butuh bantuan pesanan.", time: "10:18", assigned: true },
  { id: "2", name: "Budi", preview: "Apakah stok masih ada?", time: "09:50", assigned: false },
  { id: "3", name: "Sari", preview: "Terima kasih atas responnya!", time: "09:32", assigned: true },
  { id: "4", name: "Andi", preview: "Bisa kirim hari ini?", time: "Yesterday", assigned: false },
];

interface Message {
  id: string;
  author: "customer" | "agent";
  text: string;
  time: string;
}

const sampleMessages: Message[] = [
  { id: "m1", author: "customer", text: "Halo! Saya ingin menanyakan status pesanan saya.", time: "10:16" },
  { id: "m2", author: "agent", text: "Halo Dewi! Tentu, mohon tunggu sebentar ya, saya cek dulu.", time: "10:17" },
  { id: "m3", author: "customer", text: "Baik, terima kasih.", time: "10:18" },
];

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
  const [selected, setSelected] = useState<Conversation>(sampleConversations[0]);
  const [messages, setMessages] = useState<Message[]>(sampleMessages);
  const [draft, setDraft] = useState("");

  const filtered = useMemo(
    () =>
      sampleConversations.filter((c) =>
        `${c.name} ${c.preview}`.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const newMsg: Message = {
      id: `${Date.now()}`,
      author: "agent",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setDraft("");
  };

  return (
    <section aria-label="Chat Inbox" className="grid gap-4 md:grid-cols-[300px_1fr_320px]">
      {/* Conversations list */}
      <article className="rounded-lg border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Conversations</h2>
          <Badge variant="secondary" className="hidden md:inline-flex">{filtered.length} open</Badge>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="mb-3"
          aria-label="Search conversations"
        />
        <Separator className="mb-2" />
        <ScrollArea className="h-[60vh] pr-2">
          <ul className="space-y-2">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selected.id === c.id
                      ? "border-brand bg-sidebar-accent"
                      : "hover:bg-sidebar-accent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {c.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{c.preview}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.time}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {c.assigned ? (
                      <Badge className="bg-success text-success-foreground">Assigned</Badge>
                    ) : (
                      <Badge variant="secondary">Unassigned</Badge>
                    )}
                    <Badge variant="secondary" className="hidden md:inline-flex">WhatsApp</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </article>

      {/* Conversation */}
      <article className="flex min-h-[70vh] flex-col rounded-lg border bg-card">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {selected.name[0]}
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">{selected.name}</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </div>
            </div>
          </div>
          <Badge className="bg-success text-success-foreground">Assigned</Badge>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} m={m} />
            ))}
          </div>
        </ScrollArea>

        <footer className="border-t p-3">
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${selected.name}...`}
              aria-label="Type a message"
            />
            <Button onClick={send} className="bg-brand text-brand-foreground hover:opacity-90">Send</Button>
          </div>
        </footer>
      </article>

      {/* Details */}
      <aside className="hidden rounded-lg border bg-card p-4 md:block">
        <h2 className="text-sm font-semibold">Contact Details</h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {selected.name[0]}
          </div>
          <div>
            <div className="text-sm font-medium">{selected.name}</div>
            <div className="text-xs text-muted-foreground">Customer</div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> +62 812-3456-7890</div>
          <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> user@example.com</div>
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
