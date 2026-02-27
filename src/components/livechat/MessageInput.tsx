
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { FileUploadButton, StagedFilePreview, StagedFile } from "@/components/chat/FileUploadButton";

interface MessageInputProps {
    draft: string;
    setDraft: (value: string) => void;
    stagedFile: StagedFile | null;
    setStagedFile: (file: StagedFile | null) => void;
    loading: boolean;
    isUploadingFile: boolean;
    onSend: () => void;
    isAssignedToHuman?: boolean;
}

export function MessageInput({
    draft,
    setDraft,
    stagedFile,
    setStagedFile,
    loading,
    isUploadingFile,
    onSend,
    isAssignedToHuman = false,
}: MessageInputProps) {

    const onKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if ((!draft.trim() && !stagedFile) || loading || isUploadingFile) return;
            onSend();
        }
    };

    return (
        <div className="p-3 border-t border-blue-100 rounded-b-2xl bg-blue-50/40">
            {isAssignedToHuman && (
                <div className="mb-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Agent sedang menangani percakapan ini
                </div>
            )}
            {stagedFile && (
                <div className="mb-2">
                    <StagedFilePreview
                        stagedFile={stagedFile}
                        onRemove={() => setStagedFile(null)}
                        isUploading={isUploadingFile}
                    />
                </div>
            )}
            <div className="flex items-center gap-2">
                <FileUploadButton
                    onFileStaged={setStagedFile}
                    disabled={loading || isUploadingFile || !!stagedFile}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                />
                <Textarea
                    placeholder={stagedFile ? "Add a caption (optional)..." : "Type a message"}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyPress}
                    disabled={loading || isUploadingFile}
                    className="rounded-xl min-h-[40px] max-h-[120px] resize-none px-4 py-2 border-blue-200 focus-visible:ring-blue-500 placeholder:text-slate-400 bg-white text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                    onClick={onSend}
                    disabled={(!draft.trim() && !stagedFile) || loading || isUploadingFile}
                    className="rounded-full h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
