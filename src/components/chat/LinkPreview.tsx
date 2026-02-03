import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Loader2 } from "lucide-react";

interface LinkMetadata {
    title?: string;
    description?: string;
    image?: {
        url: string;
    };
    logo?: {
        url: string;
    };
    publisher?: string;
    url: string;
}

interface LinkPreviewProps {
    url: string;
    isDark?: boolean;
}

export const LinkPreview = ({ url, isDark = false }: LinkPreviewProps) => {
    const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchMetadata = async () => {
            try {
                const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
                const result = await response.json();

                if (isMounted) {
                    if (result.status === "success" && result.data) {
                        setMetadata(result.data);
                    } else {
                        setError(true);
                    }
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        };

        fetchMetadata();

        return () => {
            isMounted = false;
        };
    }, [url]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 mt-2 p-3 border rounded-lg bg-black/5 animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin opacity-50" />
                <span className="text-xs opacity-50">Loading preview...</span>
            </div>
        );
    }

    if (error || !metadata || (!metadata.title && !metadata.image)) {
        return null; // Don't show anything if we can't get metadata
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 no-underline"
        >
            <Card className={`overflow-hidden transition-all hover:shadow-md ${isDark ? "bg-blue-700/50 border-blue-400 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
                {metadata.image && (
                    <div className="w-full aspect-video overflow-hidden bg-slate-100 relative">
                        <img
                            src={metadata.image.url}
                            alt={metadata.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    </div>
                )}
                <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        {metadata.logo && (
                            <img src={metadata.logo.url} alt="" className="w-4 h-4 rounded-sm" />
                        )}
                        <span className={`text-[10px] font-medium uppercase tracking-wider opacity-70`}>
                            {metadata.publisher || new URL(url).hostname}
                        </span>
                    </div>
                    <h4 className="text-sm font-semibold line-clamp-1 mb-1">
                        {metadata.title}
                    </h4>
                    {metadata.description && (
                        <p className="text-xs opacity-70 line-clamp-2 leading-relaxed">
                            {metadata.description}
                        </p>
                    )}
                </CardContent>
            </Card>
        </a>
    );
};
