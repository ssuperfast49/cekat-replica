# Webhook Configuration Setup

This document explains how to configure webhook URLs for the ChatFlow application.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Legacy webhook base URL (used for endpoints that still hit n8n directly)
VITE_WEBHOOK_BASE_URL=https://primary-production-376c.up.railway.app/webhook

# Optional override for the Supabase Edge proxy URL
# Defaults to ${VITE_SUPABASE_URL}/functions/v1/proxy-n8n
VITE_WEBHOOK_PROXY_BASE_URL=https://<your-supabase-project>.supabase.co/functions/v1/proxy-n8n

# Supabase Configuration (if not already configured)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Webhook Configuration

The application uses a centralized webhook configuration located at `src/config/webhook.ts`. This configuration:

1. **Centralizes webhook route keys and legacy paths** in one place
2. **Provides helper functions** to build URLs and detect proxy routes
3. **Supports both Supabase proxy calls (with HMAC auth) and legacy direct endpoints**
4. **Makes it easy to change bases** across the entire application

## Available Endpoints

### WhatsApp Endpoints
- `GET_LOGIN_QR`: `route:session.get_login_qr` - Proxied QR retrieval with HMAC
- `GET_SESSIONS`: `/get_sessions` - Legacy WAHA sessions endpoint (no proxy yet)
- `LOGOUT_SESSION`: `route:session.logout` - Proxied logout request

### Telegram Endpoints
- `CREATE_PLATFORM`: `route:telegram.create_platform` - Create Telegram bot platform (proxied)

### AI Agent Endpoints
- `CHAT_SETTINGS`: `route:chat.settings` - Configure AI agent chat settings (proxied)
- `CHAT_TEST`: `route:chat.test` - Test AI agent chat settings (proxied)

### Message Endpoints
- `SEND_MESSAGE`: `/send-message` - Legacy generic send endpoint
- `WHATSAPP_SEND_MESSAGE`: `route:whatsapp.send_message` - Provider-specific send via proxy
- `TELEGRAM_SEND_MESSAGE`: `route:telegram.send_message` - Provider-specific send via proxy

## Usage Examples

### Calling Proxied Webhooks
```typescript
import WEBHOOK_CONFIG from '@/config/webhook';
import { callWebhook } from '@/lib/webhookClient';

const response = await callWebhook(WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.CREATE_PLATFORM, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...payload })
});
// callWebhook automatically injects the Supabase session token for proxy routes.
```

### Building Legacy URLs (rare)
```typescript
// Force legacy mode if you must hit the WAHA service directly
const legacyUrl = WEBHOOK_CONFIG.buildUrl('/get_sessions', { forceLegacy: true });
```

## Telegram Platform Form

The Telegram platform form now automatically sends data to the webhook endpoint when creating a new platform. The form:

1. **Sends data to the webhook** first
2. **Creates the platform** in the database
3. **Shows success/error messages** to the user

The webhook data includes:
- `brand_name`: Brand/organization name
- `description`: Platform description
- `display_name`: Telegram bot display name
- `telegram_bot_token`: Bot token from BotFather
- `telegram_bot_username`: Bot username
- `ai_profile_id`: Selected AI agent ID
- `human_agent_ids`: Array of selected human agent IDs
- `platform_type`: Set to 'telegram'

## Files Updated

The following files have been updated to use the centralized webhook configuration:

1. `src/config/webhook.ts` - New centralized configuration
2. `src/components/platforms/TelegramPlatformForm.tsx` - Added webhook integration
3. `src/components/platforms/WhatsAppPlatformForm.tsx` - Updated to use centralized config
4. `src/components/platforms/ConnectedPlatforms.tsx` - Updated to use centralized config
5. `src/hooks/useConversations.ts` - Updated to use centralized config
6. `src/components/aiagents/AIAgentSettings.tsx` - Updated to use centralized config

## Benefits

1. **Easy Maintenance**: Change webhook URLs in one place
2. **Environment Support**: Different URLs for development/production
3. **Type Safety**: TypeScript support for endpoint names
4. **Consistency**: All webhook calls use the same pattern
5. **Testing Support**: Built-in support for test endpoints
