
import { Card, CardContent } from "@/components/ui/card";
import { useLiveChat } from "@/hooks/useLiveChat";
import { LiveChatHeader } from "@/components/livechat/LiveChatHeader";
import { MessageList } from "@/components/livechat/MessageList";
import { MessageInput } from "@/components/livechat/MessageInput";

export default function LiveChat() {
  const {
    messages,
    draft,
    setDraft,
    loading,
    stagedFile,
    setStagedFile,
    isUploadingFile,
    booting,
    handleSend,
    viewportRef,
    endRef,
    showScrollButton,
    scrollToBottom,
  } = useLiveChat();

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
      <div className="mx-auto w-full max-w-xl h-full">
        <Card className="border border-blue-100 shadow-xl rounded-2xl bg-white/90 backdrop-blur">
          <CardContent className="p-0">
            <LiveChatHeader />

            <MessageList
              messages={messages}
              loading={loading}
              booting={booting}
              viewportRef={viewportRef}
              endRef={endRef}
              showScrollButton={showScrollButton}
              onScrollToBottom={() => scrollToBottom()}
              fmt={fmt}
            />

            <MessageInput
              draft={draft}
              setDraft={setDraft}
              stagedFile={stagedFile}
              setStagedFile={setStagedFile}
              loading={loading}
              isUploadingFile={isUploadingFile}
              onSend={handleSend}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
