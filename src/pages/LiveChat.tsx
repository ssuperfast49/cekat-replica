
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useLiveChat } from "@/hooks/useLiveChat";
import { LiveChatHeader } from "@/components/livechat/LiveChatHeader";
import { MessageList } from "@/components/livechat/MessageList";
import { MessageInput } from "@/components/livechat/MessageInput";

export default function LiveChat() {
  // Prevent scrollbar when rendered inside an iframe embed
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.margin = '0';
    const root = document.getElementById('root');
    if (root) {
      root.style.height = '100%';
      root.style.overflow = 'hidden';
    }
    return () => {
      html.style.overflow = '';
      html.style.height = '';
      body.style.overflow = '';
      body.style.height = '';
      body.style.margin = '';
      if (root) {
        root.style.height = '';
        root.style.overflow = '';
      }
    };
  }, []);
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
    isAssignedToHuman,
  } = useLiveChat();

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
      <div className="mx-auto w-full max-w-xl h-full flex flex-col sm:p-4">
        <Card className="border-0 sm:border sm:border-blue-100 sm:shadow-xl rounded-none sm:rounded-2xl bg-white/90 backdrop-blur flex-1 flex flex-col overflow-hidden">
          <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
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
              isAssignedToHuman={isAssignedToHuman}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
