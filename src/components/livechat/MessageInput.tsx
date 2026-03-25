import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Clock } from "lucide-react";
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
    isBanned?: boolean;
    banCountdown?: string;
    blockedUntil?: string | null;
}

function formatCountdown(ms: number): string {
    if (ms <= 0) return '';
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min > 0) {
        return `${min}m ${String(sec).padStart(2, '0')}s`;
    }
    return `${sec}s`;
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
    isBanned = false,
    banCountdown = '',
    blockedUntil = null,
}: MessageInputProps) {
    const [suspensionTimeLeft, setSuspensionTimeLeft] = useState<string>('');

    useEffect(() => {
        if (!blockedUntil) {
            setSuspensionTimeLeft('');
            return;
        }

        const updateCountdown = () => {
            const end = new Date(blockedUntil).getTime();
            const now = Date.now();
            const diff = end - now;
            if (diff <= 0) {
                setSuspensionTimeLeft('');
            } else {
                setSuspensionTimeLeft(formatCountdown(diff));
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [blockedUntil]);

    const isSuspended = !!suspensionTimeLeft;

    const onKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if ((!draft.trim() && !stagedFile) || isUploadingFile || isBanned || isSuspended) return;
            onSend();
        }
    };

    const inputDisabled = isUploadingFile || isBanned || isSuspended;

    return (
        <div className="p-3 border-t border-blue-100 sm:rounded-b-2xl rounded-none bg-blue-50/40">
            {isSuspended && (
                <div className="mb-2 px-3 py-2 rounded-lg bg-red-100 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-1">
                    <div className="flex items-center gap-2">
                        <span className="text-base">⏳</span>
                        <span>Akun Anda ditangguhkan sementara oleh Agent</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-red-200/50 px-2 py-0.5 rounded-md font-bold">
                        <Clock className="w-3 h-3" />
                        <span>{suspensionTimeLeft}</span>
                    </div>
                </div>
            )}
            {isBanned && !isSuspended && banCountdown && (
                <div className="mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                    <span className="text-base">⛔</span>
                    <span>Terlalu banyak aksi, mohon tunggu <strong>{banCountdown}</strong></span>
                </div>
            )}
            {isAssignedToHuman && !isBanned && !isSuspended && (
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
                    disabled={inputDisabled || !!stagedFile}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                />
                <Textarea
                    placeholder={isSuspended ? "Chat ditangguhkan..." : isBanned ? "Anda diblokir sementara..." : stagedFile ? "Add a caption (optional)..." : "Type a message"}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyPress}
                    disabled={inputDisabled}
                    className="rounded-xl min-h-[40px] max-h-[120px] resize-none px-4 py-2 border-blue-200 focus-visible:ring-blue-500 placeholder:text-slate-400 bg-white text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                    onClick={onSend}
                    disabled={(!draft.trim() && !stagedFile) || inputDisabled}
                    className="rounded-full h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700 text-blue-50"
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
