import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";

export type MediaType = "image" | "pdf" | "video" | "audio" | "file";

interface MediaViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    src: string;
    mediaType: MediaType;
    fileName?: string;
}

export function MediaViewerModal({
    isOpen,
    onClose,
    src,
    mediaType,
    fileName = "File",
}: MediaViewerModalProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);

    // Handle open/close transitions
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsZoomed(false);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
        } else {
            setIsAnimating(false);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsZoomed(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isVisible) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            if (isZoomed) {
                setIsZoomed(false);
            } else {
                onClose();
            }
        }
    };

    const handleDownload = () => {
        const link = document.createElement("a");
        link.href = src;
        link.download = fileName;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleZoom = () => {
        setIsZoomed(!isZoomed);
    };

    const renderContent = () => {
        switch (mediaType) {
            case "image":
                return (
                    <div
                        className={`transition-all duration-300 ease-out ${isZoomed
                                ? "overflow-auto max-h-[calc(100vh-56px)] max-w-full"
                                : "flex items-center justify-center overflow-hidden"
                            }`}
                        style={isZoomed ? { cursor: "zoom-out" } : { cursor: "zoom-in" }}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleZoom();
                        }}
                    >
                        <img
                            src={src}
                            alt={fileName}
                            draggable={false}
                            className={`transition-all duration-300 ease-out select-none ${isZoomed
                                    ? "" // No constraints - show at native resolution
                                    : "max-h-[calc(100vh-56px)] max-w-full object-contain"
                                }`}
                        />
                    </div>
                );

            case "pdf":
                return (
                    <div className="w-[90vw] max-w-4xl bg-white rounded-lg overflow-hidden shadow-2xl"
                        style={{ height: "calc(100vh - 72px)" }}
                    >
                        <embed
                            src={src}
                            type="application/pdf"
                            className="w-full h-full"
                        />
                    </div>
                );

            case "video":
                return (
                    <div className="max-w-4xl w-[90vw] bg-black rounded-lg overflow-hidden shadow-2xl">
                        <video
                            src={src}
                            controls
                            autoPlay
                            style={{ maxHeight: "calc(100vh - 72px)" }}
                            className="w-full"
                        >
                            Your browser does not support video playback.
                        </video>
                    </div>
                );

            case "audio":
                return (
                    <div className="bg-background p-8 rounded-lg shadow-2xl max-w-md w-[90vw]">
                        <div className="text-center mb-4">
                            <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                                <svg
                                    className="w-10 h-10 text-primary"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                                    />
                                </svg>
                            </div>
                        </div>
                        <audio src={src} controls autoPlay className="w-full">
                            Your browser does not support audio playback.
                        </audio>
                    </div>
                );

            default:
                return (
                    <div className="bg-background p-8 rounded-lg shadow-2xl text-center">
                        <p className="text-muted-foreground mb-4">
                            Cannot preview this file type
                        </p>
                        <Button onClick={handleDownload}>
                            <Download className="h-4 w-4 mr-2" />
                            Download {fileName}
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div
            className={`fixed inset-0 z-50 flex flex-col transition-opacity duration-300 ease-out ${isAnimating ? "opacity-100" : "opacity-0"
                }`}
            style={{ backgroundColor: "rgba(0, 0, 0, 0.92)" }}
        >
            {/* Fixed Header Bar */}
            <div
                className={`flex-shrink-0 h-14 px-4 flex items-center justify-between border-b border-white/10 z-10 transition-transform duration-300 ease-out ${isAnimating ? "translate-y-0" : "-translate-y-full"
                    }`}
                style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
            >
                {/* File name */}
                <p className="text-white text-sm font-medium truncate max-w-[40vw] md:max-w-md">
                    {fileName}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                    {mediaType === "image" && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleZoom}
                            className="text-white hover:bg-white/20"
                            title={isZoomed ? "Zoom out" : "Zoom in"}
                        >
                            {isZoomed ? (
                                <ZoomOut className="h-5 w-5" />
                            ) : (
                                <ZoomIn className="h-5 w-5" />
                            )}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDownload}
                        className="text-white hover:bg-white/20"
                        title="Download"
                    >
                        <Download className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="text-white hover:bg-white/20"
                        title="Close"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Content Area - no overflow when not zoomed */}
            <div
                className={`flex-1 flex items-center justify-center transition-all duration-300 ease-out ${isAnimating ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    } ${isZoomed && mediaType === "image" ? "overflow-auto p-0" : "overflow-hidden p-4"}`}
                onClick={handleBackdropClick}
            >
                {renderContent()}
            </div>
        </div>
    );
}

// Hook for managing modal state
export function useMediaViewer() {
    const [isOpen, setIsOpen] = useState(false);
    const [mediaData, setMediaData] = useState<{
        src: string;
        mediaType: MediaType;
        fileName?: string;
    } | null>(null);

    const openViewer = (src: string, mediaType: MediaType, fileName?: string) => {
        setMediaData({ src, mediaType, fileName });
        setIsOpen(true);
    };

    const closeViewer = () => {
        setIsOpen(false);
        setMediaData(null);
    };

    return {
        isOpen,
        mediaData,
        openViewer,
        closeViewer,
    };
}

export default MediaViewerModal;
