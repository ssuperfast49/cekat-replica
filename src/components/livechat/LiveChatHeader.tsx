import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LiveChatHeader() {
    return (
        <div className="flex items-center justify-between px-4 py-3 sm:rounded-t-2xl rounded-none bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm">
            <div className="flex items-center gap-2">
                <div className="text-sm font-medium tracking-wide">Live Chat</div>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
                onClick={() => {
                    try {
                        window.parent.postMessage({ type: 'CEKAT_CHAT_MINIMIZE' }, '*');
                    } catch (e) {
                        console.error('Failed to post minimize message', e);
                    }
                }}
            >
                <X className="h-4 w-4" />
                <span className="sr-only">Close chat</span>
            </Button>
        </div>
    );
}
