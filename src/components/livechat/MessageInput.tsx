
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
}

export function MessageInput({
    draft,
    setDraft,
    stagedFile,
    setStagedFile,
    loading,
    isUploadingFile,
    onSend
}: MessageInputProps) {

    const onKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="p-3 border-t border-blue-100 rounded-b-2xl bg-blue-50/40">
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
                    className="rounded-xl min-h-[40px] max-h-[120px] resize-none px-4 py-2 border-blue-200 focus-visible:ring-blue-500 placeholder:text-slate-400 bg-white text-slate-900"
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
