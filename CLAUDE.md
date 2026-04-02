# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # ESLint checks
npm run preview    # Preview production build
npm run test       # Run Vitest unit tests
npm run sync       # Run sync/index.js (database/webhook sync script)
```

## Tech Stack

- **React 18 + TypeScript + Vite** — SPA, path alias `@` → `./src`
- **Supabase** — PostgreSQL backend, auth, and real-time subscriptions
- **TanStack React Query** — server state (stale 1min, cache 5min, no refetch-on-focus, no mutation retries)
- **React Router DOM v6** — client-side routing
- **shadcn/ui + Radix UI + Tailwind CSS** — component library; dark mode is class-based
- **React Hook Form + Zod** — form handling and validation
- **Sonner** — toast notifications

## Architecture

### State Management Layers

1. **AuthContext** (`src/contexts/AuthContext.tsx`) — session, OTP verification state, account deactivation check, notification preferences. OTP flag persisted in LocalStorage.
2. **RBACContext** (`src/contexts/RBACContext.tsx`) — roles/permissions with helpers `canRead()`, `canCreate()`, `canUpdate()`, `canDelete()`, `hasRole()`, `hasPermissionDB()`. Fingerprints permission state to detect changes via custom events.
3. **PresenceContext** — real-time user online/offline via Supabase WebSocket.
4. **ThemeContext** — dark/light toggle, persisted in LocalStorage via next-themes.
5. **React Query** — all server data fetched/mutated through custom hooks in `src/hooks/`.
6. **Local component state** — UI-only state (modals, filters, form inputs).

### Routing (`src/App.tsx`)

- `/` and `/chat` → main inbox (protected)
- `/profile`, `/otp` → protected pages
- `/livechat/:platform_id` → public embeddable LiveChat widget (no auth)
- `/reset-password`, `/invite`, `/logout`, `/changelog`, `/account-deactivated` → public

Protected routes use a `<ProtectedRoute>` wrapper that enforces Supabase session, OTP completion, and account active status.

### Key Directories

- `src/pages/` — route-level page components
- `src/components/` — feature-grouped components: `chat/`, `livechat/`, `contacts/`, `platforms/`, `aiagents/`, `humanagents/`, `analytics/`, `admin/`, `permissions/`, `rbac/`, `navigation/`, `layout/`, `ui/` (shadcn)
- `src/hooks/` — custom hooks for all business logic; `useConversations.ts` and `useLiveChat.ts` are the largest and most complex
- `src/contexts/` — global React context providers
- `src/lib/` — utilities: `supabase.ts` (client + auth), `circuitBreaker.ts`, `rateLimiter.ts`, `adaptiveRateLimiter.ts`, `webhookClient.ts`, `authz.ts`, `errorHandler.ts`, `fallbackHandler.ts`
- `src/config/` — static config: `navigation.ts` (sidebar nav + RBAC-gated items), `permissions.ts` (RBAC schema), `urls.ts` (API endpoints), `webhook.ts`
- `src/integrations/supabase/` — Supabase client instance and auto-generated DB types
- `src/types/` — shared TypeScript types (`rbac.ts`, `liveChat.ts`, `supabase.ts`)

### RBAC Pattern

Navigation visibility and feature access are gated through `RBACContext`. The `src/config/navigation.ts` maps nav items to required permissions. Components call `canRead()`, `canCreate()`, etc. before rendering actions. `hasPermissionDB()` performs async DB-level permission checks when needed.

### Error Resilience

`src/lib/circuitBreaker.ts` wraps Supabase calls to prevent cascading failures. `src/lib/rateLimiter.ts` and `adaptiveRateLimiter.ts` throttle requests. `src/lib/fallbackHandler.ts` handles retry logic. The admin panel (`src/components/admin/`) includes a circuit breaker status UI.

### Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
VITE_HCAPTCHA_SITEKEY
VITE_WEBHOOK_BASE_URL
```

Multiple Supabase project IDs (dev/prod/backup) are commented in `.env`.

### Deployment

- **Vercel**: `vercel.json` rewrites all routes to `index.html`
- **Netlify**: `netlify.toml` handles SPA redirects including `/livechat/*`
