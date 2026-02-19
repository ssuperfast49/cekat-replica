import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, FileIcon, ImageIcon, FileAudio, FileVideo } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { MediaViewerModal, type MediaType } from "./MediaViewerModal";

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "video/mp4",
    "audio/mpeg",
    "audio/ogg",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadedFile {
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    type: "image" | "video" | "file" | "voice";
}

export interface StagedFile {
    file: File;
    preview: string | null;
    type: "image" | "video" | "file" | "voice";
}

interface FileUploadButtonProps {
    onFileStaged: (file: StagedFile) => void;
    disabled?: boolean;
    className?: string;
}

function getFileType(mimeType: string): "image" | "video" | "file" | "voice" {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "voice";
    return "file";
}

export function getFileIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (mimeType.startsWith("audio/")) return <FileAudio className="h-4 w-4" />;
    if (mimeType.startsWith("video/")) return <FileVideo className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
}

// Utility function to upload a file to Supabase Storage
export async function uploadFileToStorage(file: File): Promise<UploadedFile> {
    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${timestamp}_${random}.${ext}`;
    const filePath = `attachments/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from("chat-attachments")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
        });

    if (error) {
        throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(filePath);

    return {
        url: urlData.publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        type: getFileType(file.type),
    };
}

// Main button component - just stages files, doesn't upload
export function FileUploadButton({
    onFileStaged,
    disabled = false,
    className = "",
}: FileUploadButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so same file can be selected again
        e.target.value = "";

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error(`File type not allowed. Allowed: images, PDF, audio, video`);
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            toast.error(`File too large. Max size: 10MB`);
            return;
        }

        // Create preview for images (data URL)
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                onFileStaged({
                    file,
                    preview: e.target?.result as string,
                    type: getFileType(file.type),
                });
            };
            reader.readAsDataURL(file);
        } else if (file.type === "application/pdf" || file.type.startsWith("video/") || file.type.startsWith("audio/")) {
            // Create preview for PDFs, videos, and audio (object URL)
            const objectUrl = URL.createObjectURL(file);
            onFileStaged({
                file,
                preview: objectUrl,
                type: getFileType(file.type),
            });
        } else {
            // Other files: no preview
            onFileStaged({
                file,
                preview: null,
                type: getFileType(file.type),
            });
        }
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(",")}
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled}
            />

            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClick}
                disabled={disabled}
                className={className}
                title="Attach file"
            >
                <Paperclip className="h-5 w-5" />
            </Button>
        </>
    );
}

// Inline preview component for staged files (shown in input area)
export function StagedFilePreview({
    stagedFile,
    onRemove,
    isUploading = false,
}: {
    stagedFile: StagedFile;
    onRemove: () => void;
    isUploading?: boolean;
}) {
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    const isPdf = stagedFile.file.type === "application/pdf";
    const isImage = stagedFile.file.type.startsWith("image/");
    const isVideo = stagedFile.file.type.startsWith("video/");
    const isAudio = stagedFile.file.type.startsWith("audio/");

    // Determine media type for the viewer
    const getMediaType = (): MediaType => {
        if (isImage) return "image";
        if (isPdf) return "pdf";
        if (isVideo) return "video";
        if (isAudio) return "audio";
        return "file";
    };

    // Check if we can preview this file
    const canPreview = isImage || isPdf || isVideo || isAudio;

    const handlePreviewClick = () => {
        if (canPreview && stagedFile.preview && !isUploading) {
            setIsViewerOpen(true);
        }
    };

    // Render preview content based on file type
    const renderPreview = () => {
        if (stagedFile.preview) {
            if (isImage) {
                return (
                    <img
                        src={stagedFile.preview}
                        alt="Preview"
                        className="h-16 w-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={handlePreviewClick}
                    />
                );
            }
            if (isPdf) {
                return (
                    <div
                        className="h-20 w-28 rounded overflow-hidden border bg-white cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={handlePreviewClick}
                    >
                        <embed
                            src={`${stagedFile.preview}#toolbar=0&navpanes=0&scrollbar=0`}
                            type="application/pdf"
                            className="w-full h-full pointer-events-none"
                        />
                    </div>
                );
            }
            if (isVideo) {
                return (
                    <div
                        className="h-16 w-24 rounded overflow-hidden bg-black cursor-pointer hover:opacity-80 transition-opacity relative"
                        onClick={handlePreviewClick}
                    >
                        <video
                            src={stagedFile.preview}
                            className="w-full h-full object-cover"
                            muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
                                <div className="w-0 h-0 border-l-[10px] border-l-black border-y-[6px] border-y-transparent ml-1" />
                            </div>
                        </div>
                    </div>
                );
            }
            if (isAudio) {
                return (
                    <div
                        className="h-16 w-16 flex items-center justify-center bg-primary/10 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                        onClick={handlePreviewClick}
                    >
                        <FileAudio className="h-8 w-8 text-primary" />
                    </div>
                );
            }
        }
        // Fallback: show icon (not clickable for preview)
        return (
            <div className="h-16 w-16 flex items-center justify-center bg-primary/10 rounded">
                {getFileIcon(stagedFile.file.type)}
            </div>
        );
    };

    return (
        <>
            <div className="relative inline-flex items-center gap-3 px-3 py-2 bg-muted rounded-lg border">
                {isUploading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg z-10">
                        <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                )}

                {renderPreview()}

                <div className="flex flex-col min-w-0 max-w-[150px]">
                    <span className="text-xs font-medium truncate">
                        {stagedFile.file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {(stagedFile.file.size / 1024).toFixed(1)} KB
                    </span>
                    {canPreview && (
                        <button
                            type="button"
                            onClick={handlePreviewClick}
                            className="text-xs text-blue-600 font-medium hover:underline text-left"
                        >
                            Click to preview
                        </button>
                    )}
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={onRemove}
                    disabled={isUploading}
                    title="Remove attachment"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Media Viewer Modal */}
            {stagedFile.preview && (
                <MediaViewerModal
                    isOpen={isViewerOpen}
                    onClose={() => setIsViewerOpen(false)}
                    src={stagedFile.preview}
                    mediaType={getMediaType()}
                    fileName={stagedFile.file.name}
                />
            )}
        </>
    );
}

// Helper component to render attachment in message bubble
export function AttachmentRenderer({
    fileLink,
    type,
    fileName,
}: {
    fileLink: string;
    type: "image" | "video" | "file" | "voice";
    fileName?: string;
}) {
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    if (!fileLink) return null;

    // Extract file name from URL if not provided
    const displayName = fileName || (() => {
        try {
            const urlPath = new URL(fileLink).pathname;
            const lastSegment = urlPath.split('/').pop() || 'file';
            // Decode URI and truncate hash-style names
            const decoded = decodeURIComponent(lastSegment);
            return decoded.length > 40 ? decoded.slice(0, 37) + '...' : decoded;
        } catch {
            return 'Download file';
        }
    })();

    // Determine extension for PDF detection
    const ext = fileLink.split('.').pop()?.toLowerCase()?.split('?')[0] ?? '';
    const isPdf = ext === 'pdf' || type === 'file' && displayName.toLowerCase().endsWith('.pdf');

    if (type === "image") {
        return (
            <>
                <img
                    src={fileLink}
                    alt={displayName}
                    className="max-w-full h-auto rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => setIsViewerOpen(true)}
                />
                <MediaViewerModal
                    isOpen={isViewerOpen}
                    onClose={() => setIsViewerOpen(false)}
                    src={fileLink}
                    mediaType="image"
                    fileName={displayName}
                />
            </>
        );
    }

    if (type === "video") {
        return (
            <video
                src={fileLink}
                controls
                className="max-w-full rounded-lg max-h-64"
            >
                Your browser does not support video.
            </video>
        );
    }

    if (type === "voice") {
        return (
            <audio controls className="max-w-full">
                <source src={fileLink} />
                Your browser does not support audio.
            </audio>
        );
    }

    // PDF: show embedded preview with download option
    if (isPdf) {
        return (
            <>
                <div
                    className="w-64 h-48 rounded-lg overflow-hidden border bg-white cursor-pointer hover:opacity-90 transition-opacity relative group"
                    onClick={() => setIsViewerOpen(true)}
                >
                    <embed
                        src={`${fileLink}#toolbar=0&navpanes=0&scrollbar=0`}
                        type="application/pdf"
                        className="w-full h-full pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="bg-white/90 text-xs font-medium px-2 py-1 rounded shadow">Click to preview</span>
                    </div>
                </div>
                <a
                    href={fileLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                >
                    <FileIcon className="h-4 w-4 text-red-500" />
                    <span className="truncate max-w-[200px]">{displayName}</span>
                </a>
                <MediaViewerModal
                    isOpen={isViewerOpen}
                    onClose={() => setIsViewerOpen(false)}
                    src={fileLink}
                    mediaType="pdf"
                    fileName={displayName}
                />
            </>
        );
    }

    // Default: file/document
    return (
        <a
            href={fileLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
            <FileIcon className="h-5 w-5 text-primary" />
            <span className="text-sm truncate max-w-[200px]">
                {displayName}
            </span>
        </a>
    );
}

export default FileUploadButton;
