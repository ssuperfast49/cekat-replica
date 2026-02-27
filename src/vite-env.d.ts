/// <reference types="vite/client" />

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare const __APP_VERSION__: string;

interface Window {
  chatConfig?: {
    baseUrl?: string;
    platformId?: string;
    sendToneUrl?: string;   // optional CDN URL for send tone
    replyToneUrl?: string;  // optional CDN URL for reply tone
  };
}
