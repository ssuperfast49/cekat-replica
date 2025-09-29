// Webhook Configuration
export const WEBHOOK_CONFIG = {
  // Base URL for all webhooks
  BASE_URL: (import.meta as any).env?.VITE_WEBHOOK_BASE_URL || "https://primary-production-376c.up.railway.app/webhook",
  
  // Specific endpoints
  ENDPOINTS: {
    // WhatsApp endpoints
    WHATSAPP: {
      GET_LOGIN_QR: "/get_login_qr",
      GET_SESSIONS: "/get_sessions",
      LOGOUT_SESSION: "/logout_session",
      CREATE_PLATFORM: "/whatsapp/create-platform",
      CREATE_SESSION: "/create_session",
      DISCONNECT_SESSION: "/disconnect_session",
      DELETE_SESSION: "/delete_session",
    },
    // Telegram endpoints
    TELEGRAM: {
      CREATE_PLATFORM: "/telegram/create-platform",
      // Provider-specific send endpoint
      SEND_MESSAGE: "/telegram/send-message",
      DELETE_WEBHOOK: "/telegram/delete-webhook",
    },
    
    // AI Agent endpoints
    AI_AGENT: {
      CHAT_SETTINGS: "/chat-ai-agent-settings",
    },
    // Knowledgebase endpoints
    KNOWLEDGE: {
      FILE_UPLOAD: "/knowledge/file-upload",
      FILE_DELETE: "/knowledge/file-delete",
    },
    
    // Message endpoints
    MESSAGE: {
      // Default generic send endpoint
      SEND_MESSAGE: "/send-message",
      // WhatsApp provider-specific send endpoint
      WHATSAPP_SEND_MESSAGE: "/whatsapp/send-message",
    },
  },
  
  // Helper function to build full URLs
  buildUrl: (endpoint: string): string => {
    return `${WEBHOOK_CONFIG.BASE_URL}${endpoint}`;
  },
  
  // Helper function to build test URLs
  buildTestUrl: (endpoint: string): string => {
    const baseUrl = WEBHOOK_CONFIG.BASE_URL.replace('/webhook', '/webhook-test');
    return `${baseUrl}${endpoint}`;
  },
};

// Map provider to its send-message path
const PROVIDER_SEND_PATHS: Record<string, string> = {
  telegram: WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.SEND_MESSAGE,
  whatsapp: WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.WHATSAPP_SEND_MESSAGE,
};

// Setter to switch the active send-message endpoint based on provider
export const setSendMessageProvider = (provider: string) => {
  const key = (provider || '').toLowerCase();
  const newPath = PROVIDER_SEND_PATHS[key] || WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.SEND_MESSAGE;
  WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.SEND_MESSAGE = newPath;
};

export default WEBHOOK_CONFIG;
