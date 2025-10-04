# Webhook Configuration Setup

This document explains how to configure webhook URLs for the ChatFlow application.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Webhook Base URL
VITE_WEBHOOK_BASE_URL=https://primary-production-376c.up.railway.app/webhook

# Supabase Configuration (if not already configured)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Webhook Configuration

The application uses a centralized webhook configuration located at `src/config/webhook.ts`. This configuration:

1. **Centralizes all webhook URLs** in one place
2. **Provides helper functions** to build URLs
3. **Supports both production and test endpoints**
4. **Makes it easy to change base URLs** across the entire application

## Available Endpoints

### WhatsApp Endpoints
- `GET_LOGIN_QR`: `/get_login_qr` - Get WhatsApp QR code for login
- `GET_SESSIONS`: `/get_sessions` - Get existing WhatsApp sessions
- `LOGOUT_SESSION`: `/logout_session` - Logout from WhatsApp session

### Telegram Endpoints
- `CREATE_PLATFORM`: `/telegram/create-platform` - Create Telegram bot platform

### AI Agent Endpoints
- `CHAT_SETTINGS`: `/chat-ai-agent-settings` - Configure AI agent chat settings
- `CHAT_TEST`: `/chat-ai-agent-test` - Test AI agent chat settings

### Message Endpoints
- `SEND_MESSAGE`: `/send-message` - Send messages via webhook

## Usage Examples

### Building Production URLs
```typescript
import WEBHOOK_CONFIG from '@/config/webhook';

// Build a production URL
const url = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.CREATE_PLATFORM);
// Result: https://primary-production-376c.up.railway.app/webhook/telegram/create-platform
```

### Building Test URLs
```typescript
// Build a test URL (uses /webhook-test instead of /webhook)
const testUrl = WEBHOOK_CONFIG.buildTestUrl(WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.CREATE_PLATFORM);
// Result: https://primary-production-376c.up.railway.app/webhook-test/telegram/create-platform
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
