
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { LinkPreview } from "@/components/chat/LinkPreview";
import { isImageLink, extractUrls } from "@/lib/utils";
import { AttachmentRenderer } from "@/components/chat/FileUploadButton";
import { ChatMessage } from "@/types/liveChat";

interface MessageListProps {
    messages: ChatMessage[];
    loading: boolean;
    booting: boolean;
    viewportRef: React.RefObject<HTMLDivElement>;
    endRef: React.RefObject<HTMLDivElement>;
    showScrollButton: boolean;
    onScrollToBottom: () => void;
    fmt: (iso: string) => string;
}

export function MessageList({
    messages,
    loading,
    booting,
    viewportRef,
    endRef,
    showScrollButton,
    onScrollToBottom,
    fmt
}: MessageListProps) {

    // Sorting is done in hook or parent? Hook returns messages unsorted? 
    // Hook logic: `messages` state is updated with `appendSorted` and `moveOptimisticToTail` so it should be somewhat sorted but let's double check.
    // In `useLiveChat`, `upsertFromRows` sorts them. `appendSorted` sorts them.
    // The state `messages` IS sorted by order.
    // But wait, `LiveChat.tsx` useMemo sortedMessages was:
    // const sortedMessages = useMemo(() => { return [...messages].sort((a, b) => a.order - b.order); }, [messages]);
    // So I should sort them here too or pass sorted messages.
    // Hook returns `messages`. I'll assume they need sorting or I can do it here.
    const sortedMessages = [...messages].sort((a, b) => a.order - b.order);

    const MarkdownComponents = {
        a: ({ href, children }: any) => {
            const url = href || "";
            if (isImageLink(url)) {
                return (
                    <img
                        src={url}
                        alt="User uploaded content"
                        className="rounded-lg max-w-full h-auto my-2 border border-black/10 shadow-sm"
                        loading="lazy"
                    />
                );
            }
            return (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 font-medium underline hover:text-blue-800"
                >
                    {children}
                </a>
            );
        },
        img: ({ src, alt }: any) => (
            <img
                src={src}
                alt={alt}
                className="rounded-lg max-w-full h-auto my-2 border border-black/10 shadow-sm overflow-hidden"
                loading="lazy"
            />
        )
    };

    return (
        <div className="relative flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 p-4" viewportRef={viewportRef}>
                <div className="space-y-3">
                    {booting && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            Preparing chat…
                        </div>
                    )}
                    {sortedMessages.map((m) => {
                        if (!m.body || (m.streaming && (!m.body || m.body.trim() === ''))) {
                            return null;
                        }

                        if (m.role === 'system') {
                            return (
                                <div key={m.id} className="flex justify-center my-4">
                                    <div className="text-center">
                                        <div className="text-sm text-slate-500 bg-slate-100/50 px-3 py-1 rounded-full border border-slate-100">
                                            {m.body || 'System event'}
                                        </div>
                                        <div className="flex items-center justify-center gap-2 mt-1 text-[10px] text-slate-400">
                                            <span>{fmt(m.at)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (() => {
                            const bodyText = (m.body || '').trim();
                            const isText = m.type === 'text' || !m.type;
                            const isAttachment = !isText && bodyText;

                            let attachType = m.type;
                            if (isAttachment && (!attachType || attachType === 'text')) {
                                const ext = bodyText.split('.').pop()?.toLowerCase()?.split('?')[0] ?? '';
                                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) attachType = 'image';
                                else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) attachType = 'video';
                                else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) attachType = 'voice';
                                else attachType = 'file';
                            }

                            const hasRealBody = isText && bodyText.length > 0;
                            const effectiveFileLink = isAttachment ? bodyText : null;

                            // Customize link color for User bubble
                            const finalComponents = m.role === "user" ? {
                                ...MarkdownComponents,
                                a: ({ href, children }: any) => {
                                    const url = href || "";
                                    if (isImageLink(url)) {
                                        return <img src={url} alt="User content" className="rounded-lg max-w-full h-auto my-2 shadow-sm" loading="lazy" />;
                                    }
                                    return (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-300 font-medium underline hover:text-white">
                                            {children}
                                        </a>
                                    );
                                }
                            } : MarkdownComponents;

                            return (
                                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`flex ${m.role === "user" ? "flex-row-reverse" : "flex-row"} items-end gap-2 max-w-[92%] sm:max-w-[85%]`}>
                                        <div className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"} min-w-0 max-w-full space-y-1`}>
                                            {effectiveFileLink && attachType && (
                                                <div className="max-w-full">
                                                    <AttachmentRenderer
                                                        fileLink={effectiveFileLink}
                                                        type={attachType as any}
                                                    />
                                                </div>
                                            )}

                                            {hasRealBody && (
                                                <div
                                                    className={`px-4 py-2 text-sm rounded-2xl shadow-sm transition-colors ${m.role === "user"
                                                        ? "bg-blue-600 text-white rounded-br-md"
                                                        : "bg-white text-slate-900 border border-blue-100 rounded-bl-md"
                                                        }`}
                                                >
                                                    <div className={`prose prose-sm leading-normal max-w-none [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${m.role === "user" ? "text-white [&_*]:text-inherit [&_li]:marker:text-white [&_code]:text-blue-100 [&_code]:bg-blue-700" : ""}`}>
                                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={finalComponents}>
                                                            {m.body}
                                                        </ReactMarkdown>
                                                    </div>
                                                    {(() => {
                                                        const urls = extractUrls(m.body);
                                                        if (urls.length === 0) return null;
                                                        return (
                                                            <div className="space-y-2 mt-2">
                                                                {urls.map((u) => !isImageLink(u) && (
                                                                    <LinkPreview key={u} url={u} isDark={m.role === "user"} />
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className={`mt-1 text-[10px] ${m.role === "user" ? "text-blue-200 text-right" : "text-slate-400"}`}>
                                                        {fmt(m.at)}
                                                    </div>
                                                </div>
                                            )}

                                            {!hasRealBody && (
                                                <div className={`text-[10px] ${m.role === "user" ? "text-blue-200 text-right" : "text-slate-400"}`}>
                                                    {fmt(m.at)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })();
                    })}
                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            Typing…
                        </div>
                    )}
                    <div ref={endRef} />
                </div>
            </ScrollArea>
            {showScrollButton && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full shadow-lg bg-blue-100/90 hover:bg-blue-200 text-blue-700 h-8 px-3 text-xs gap-1 border border-blue-200 animate-in fade-in slide-in-from-bottom-2"
                        onClick={onScrollToBottom}
                    >
                        <ArrowDown className="h-3 w-3" />
                        New message
                    </Button>
                </div>
            )}
        </div>
    );
}
