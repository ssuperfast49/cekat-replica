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
    },
    // Telegram endpoints
    TELEGRAM: {
      CREATE_PLATFORM: "/telegram/create-platform",
    },
    
    // AI Agent endpoints
    AI_AGENT: {
      CHAT_SETTINGS: "/chat-ai-agent-settings",
    },
    
    // Message endpoints
    MESSAGE: {
      SEND_MESSAGE: "/send-message",
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

export default WEBHOOK_CONFIG;
