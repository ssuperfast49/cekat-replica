
export type ChatMessage = {
    id: string;
    role: "user" | "assistant" | "system";
    body: string;
    at: string;
    order: number;
    streaming?: boolean;
    type?: "text" | "image" | "video" | "file" | "voice";
    file_link?: string;
    payload?: any;
};

export interface LiveChatState {
    messages: ChatMessage[];
    draft: string;
    loading: boolean;
    stagedFile: any | null; // using any for StagedFile to avoid circular deps, or import it
    isUploadingFile: boolean;
    booting: boolean;
    showScrollButton: boolean;
}
