# Change Log
# [0.1.58] Supabase Reopen Collaborator Reset 2026-01-15
### Supabase
- Reopen on inbound messages now clears `collaborator_user_id` so reopened/unassigned conversations have no collaborator. Migration: `20260115124500_reopen_clear_collaborator.sql`.

# [0.1.57] Supabase Policy Cleanup 2026-01-15
### Supabase
- Removed main-only public/anon policies on `job`, `job_run_details`, and `storage.objects` to match development. Migration: `20260115123000_remove_extra_public_policies.sql`.

# [0.1.56] Supabase Function Alignment 2026-01-15
### Supabase
- **takeover_thread matches dev**: returns the updated thread, sets `collaborator_user_id`, `status='pending'`, keeps `assigned_at` if present. Migration: `20260115120000_align_functions.sql`.
- **reopen_thread_on_user_message matches dev**: reopens closed threads without clearing handled-by fields. Migration: `20260115120000_align_functions.sql`.

# [0.1.55] Supabase Trigger/Function Parity 2026-01-15
### Supabase (main aligned to development)
- **Trigger parity**: Removed main-only thread triggers and added the channel super-agent sync trigger (`tr_update_contacts_threads_on_channel_super_agent_change`) to mirror development. New migration: `20260115113000_align_triggers.sql`.
- **Function parity**: Added missing `unassign_thread` SECURITY DEFINER function to main. New migration: `20260115114000_add_unassign_thread.sql`.

# [0.1.54] Supabase Schema 2026-01-15
### Supabase (schema & RLS alignment)
- **Contacts owned by super agents**: Added `contacts.super_agent_id`, backfilled from channel ownership, dropped `channel_id`, and rewrote contacts RLS to super-agent scope. New migration: `20260115100000_contacts_super_agent.sql`.
- **Scope-based RLS**: Introduced helper functions (`can_access_super_scope`, `can_access_channel_scope`, `can_access_message_scope`) and replaced channels/threads/messages policies with scope-based, account-aware, and web-widget rules. New migration: `20260115103000_scope_based_policies.sql`.
- **Audit/channel agents RLS parity**: Tightened `audit_logs` to permission-based read and simplified `channel_agents` to a single authenticated policy. New migration: `20260115110000_audit_logs_channel_agents_policies.sql`.

# [0.1.53] FE WEB CEKAT 2026-01-15
### Live Chat
- **Late-arriving user rows replace optimistics**: If the backend inserts the real user message after the AI reply, the message now replaces its optimistic twin instead of showing twice, eliminating double “Hello” bubbles.
  - Updated: `src/pages/LiveChat.tsx`
- **Commit**: `fix: livechat dedupe optimistic user messages`

# [0.1.52] FE WEB CEKAT 2026-01-14
### Conversations & Assignment Flow
- **Unassign keeps handled-by, clears collaborator**: Moving a chat to Unassigned now only nulls `collaborator_user_id`, reopens AI, and keeps the handled-by assignee intact while placing the thread in the Unassigned tab.
  - Updated: `src/hooks/useConversations.ts`, `src/components/chat/ConversationPage.tsx`
- **Takeover sets collaborator**: Takeover without reassignment now sets `collaborator_user_id` to the agent who took over, without touching handled-by.
  - Updated: `src/hooks/useConversations.ts`
- **Commit**: `chore: unassign clears collaborator only; takeover sets collaborator; lock collaborator replies`

# [0.1.51] FE WEB CEKAT 2026-01-15
### Conversations & System Events
- **System logs for assignment actions**: Takeover, Move to Unassigned, and Resolve now add system `event` messages to the thread timeline with actor details, keeping the audit trail visible in chat.
  - Updated: `src/components/chat/ConversationPage.tsx`, `src/hooks/useConversations.ts`

# [0.1.50] FE WEB CEKAT 2026-01-14
### Conversations & Ownership
- **Collaborators are now read-only**: The sidebar shows the current collaborator label while only “Takeover Chat” reclaims the slot; the select was removed to enforce the one-collaborator invariant.
  - Updated: `src/components/chat/ConversationPage.tsx`
- **Takeover/Unassign RPCs respect status**: `takeover_thread`/`unassign_thread` now only swap `collaborator_user_id` / status/assigned_at, and the frontend trusts the returned `status` so “Move to Unassigned” stays open after refresh.
  - Updated: `src/hooks/useConversations.ts`
- **RPC definitions and constraints**: Supabase migration adds status/collaborator invariants plus SECURITY DEFINER RPCs (`takeover_thread`, `unassign_thread`) that preserve `assignee_user_id` while updating collaborators.
  - Updated: `supabase/migrations/20260114090000_thread_collab_takeover.sql`

# [0.1.49] FE WEB CEKAT 2026-01-13
### Add delete button in contacts
- **Added button for delete contact**: button delete contact is available for role master agent and super agent.

# [0.1.48] FE WEB CEKAT 2026-01-13
### Conversation Ownership
- **Handled By now respects real assignees**: `computeAssignmentState` keeps the `assignee_user_id` if the thread is assigned, so `ConversationPage` can show the handler’s display name again instead of rendering “—”.
  - Updated: `src/hooks/useConversations.ts`

### Platform Ownership
- **Super-agent scoped human/AI selection**: The Connected Platforms sidebar only lists human agents and AI profiles that belong to the channel’s assigned super agent while keeping the already selected options visible, keeping ownership aligned across collaborators and bots.
  - Updated: `src/components/platforms/ConnectedPlatforms.tsx`

# [0.1.46] FE WEB CEKAT 2026-01-13
### Live Chat
- **Stable account names**: Friendly username is now stored per `account_id` (localStorage) instead of per session, so the same account can’t generate multiple display names across sessions.
  - Updated: `src/pages/LiveChat.tsx`
- **Supabase types parity**: `threads` types include `account_id` to match the schema and avoid TS errors on account-based queries.
  - Updated: `src/integrations/supabase/types.ts`
- **Commit**: `chore: bind livechat name to account and fix threads types`

# [0.1.45] FE WEB CEKAT 2026-01-13
### Live Chat & Types
- **Account-scoped attach only**: Live chat now only attaches to threads that match the current `account_id`/session and no longer reuses stored thread IDs; if none exist, it waits for an external creator (e.g., n8n) rather than auto-creating.
  - Updated: `src/pages/LiveChat.tsx`
- **Supabase types parity**: Added `account_id` to the `threads` types to match the schema changes and avoid TS errors on account-based selects.
  - Updated: `src/integrations/supabase/types.ts`
- **Commit**: `chore: livechat account attach only & fix supabase types`

# [0.1.44] FE WEB CEKAT 2026-01-13
### WhatsApp / n8n Proxy Hardening
- **Session disconnect via proxy-n8n**: WhatsApp disconnect now calls the `session.logout` proxy route (no legacy Railways) before disconnecting, matching the n8n route table.
- **Scoped polling on disconnect**: Only WhatsApp sessions are refreshed during disconnect polling, using a fresh `sessionsRef` to avoid stale state; no broad platform refresh.
- **Spam-proof delete**: Danger zone delete button is guarded by the in-flight flag to prevent repeated clicks while deletion is in progress.

### Supabase (live chat reference)
- **Account-scoped anon access**: Policies persisted in migrations (`20260113000001`, `20260113000002`) enforce `account_id` + `x-account-id` for threads/messages; legacy null-account fallback removed. Anonymous users cannot fetch other accounts’ threads or messages.
- **Edge function routing**: `proxy-n8n` is the path for WhatsApp session actions; `session.disconnect` route added to n8n route table; `DISCONNECT_SESSION` now points to `session.logout`.

# [0.1.43] FE WEB CEKAT 2026-01-13
### Live Chat (Account-scoped reuse)
- **One thread per account (frontend & DB guard)**: Live chat now reads `account_id` from `localStorage` and reuses/reopens the existing thread for that account/channel (falls back to session/alias if no account). Added `account_id` column plus a unique index on `(channel_id, account_id)` when set to prevent duplicate threads.
  - Updated: `src/pages/LiveChat.tsx`, `src/hooks/useConversations.ts`
  - New: `supabase/migrations/20260113000001_add_account_id_to_threads.sql`
- **Anonymous: new thread per cleared storage**: If local/session storage is empty, a fresh `account_id` is generated per channel and legacy thread auto-attach is disabled, so each new browser/cleared storage starts a new thread.
  - Updated: `src/pages/LiveChat.tsx`
  
### Live Chat (anon account-id hardening)
- **Fetch-only on load (no auto-create)**: Live chat no longer creates threads on refresh; it only attaches to existing threads that match the current `account_id` (and session). Threads are expected to be created externally (e.g., n8n) and delivered via realtime or subsequent fetch.
- **Thread reuse by account only**: Stored thread reuse was removed; lookup now requires account/session match (no name fallback when account_id exists).
- **Headers for anon RLS**: The live chat Supabase client sends `x-account-id` for all requests so anon RLS policies apply.

### Supabase (migration/reference)
- **account_id column & unique index**: Added `account_id` to `public.threads` and a unique index `(channel_id, account_id)` when `account_id` is set (`supabase/migrations/20260113000001_add_account_id_to_threads.sql`).
- **Edge function auth**: `proxy-n8n` redeployed with `verify_jwt=false` to allow anonymous calls (still HMAC-signs to n8n).
- **RLS (anon by account_id)**:
  - Threads: `anon_threads_by_account` (SELECT) and `anon_threads_insert_by_account` (INSERT) require `account_id` = `x-account-id`.
  - Messages: `anon_messages_by_account` (SELECT) and `anon_messages_insert_by_account` (INSERT) require parent thread `account_id` = `x-account-id`.
  - Channels: `anon_channels_web_minimal` allows anon SELECT on web channels to read minimal metadata.
  - Legacy null-account fallback policies were removed; anon access now hinges on matching `account_id`.

# [0.1.42] FE WEB CEKAT 2026-01-13
### Conversations & Assignment Flow
- **Realtime tab-safe updates**: Thread status/assignee changes now patch the conversation list via realtime updates without needing a manual refresh; tabs stay put even when counts change underneath.
  - Updated: `src/hooks/useConversations.ts`, `src/components/chat/ConversationPage.tsx`
- **Tab UX hardening**: Tabs remain clickable/selectable even when empty; user-selected tabs no longer auto-bounce when counts shift.
  - Updated: `src/components/chat/ConversationPage.tsx`
- **Resolve re-enables AI**: Resolving a conversation now flips `ai_access_enabled` back on and clears `ai_handoff_at` so AI can respond immediately after resolution.
  - Updated: `src/components/chat/ConversationPage.tsx`

# [0.1.41] FE WEB CEKAT 2026-01-12
- **Thread controls respect roles & stay real-time**: “Move to Unassigned” now only renders and functions for master/super agents (regular agents get a toast if they try), and the focused conversation keeps subscribing to its thread plus calling `fetchMessages` in a stable hook so status changes surface instantly.
  - Updated: `src/components/chat/ConversationPage.tsx`, `src/hooks/useConversations.ts`
- **Super agents can edit platform human agents**: The human-agent multi-select inside platform details now bypasses the `channel_agents.update` gate for `super_agent` roles so they can add/remove collaborators without an extra permission.
  - Updated: `src/components/platforms/ConnectedPlatforms.tsx`
# [0.1.40] FE WEB CEKAT 2026-01-12
### Conversations & Assignment Flow
- **Correct tab mapping for statuses**: “Assigned” now strictly maps to `status === "pending"` while “Unassigned” maps to `status === "open"` so the sidebar tally matches the database truth, and the legacy `assigned` enum is only treated as assigned for backward compatibility.
  - Updated: `src/components/chat/ConversationPage.tsx`
- **Render unassigned threads as open**: Assignment-sensitive logic now only considers a thread assigned when an assignee (or similar signal) exists; a bare `pending` status without an assignee rewrites to `open`, ensuring those rows appear under the Unassigned tab.
  - Updated: `src/hooks/useConversations.ts`
# [0.1.39] FE WEB CEKAT 2026-01-11
### Conversations & Assignment Flow
- **Takeover preserves handled by**: Takeover chat action now only changes thread status from "pending" (Unassigned) to "assigned", without modifying the "Handled By" field. This ensures the original super agent assignment is preserved regardless of who takes over the conversation.
  - Updated: `src/components/chat/ConversationPage.tsx`, `src/hooks/useConversations.ts`
- **Conditional assignee updates**: Added `setAssignee` option to `assignThread` function for explicit assignment control. Takeover always uses `setAssignee: false` to preserve existing assignments.
  - Updated: `src/hooks/useConversations.ts`

### UI/UX Improvements
- **Login form cleanup**: Removed redundant UI text elements from login form (one-time code message and forgot password link) to streamline the authentication interface.
  - Updated: `src/components/auth/Login.tsx`

# [0.1.38] FE WEB CEKAT 2026-01-11
### Conversations & Assignment Flow
- **Inline status controls**: Assigned threads now show a “Move to Unassigned” button next to Resolve, keeping status transitions and the list state in sync without page refreshes.
  - Updated: `src/components/chat/ConversationPage.tsx`, `src/hooks/useConversations.ts`
- **Server-truth status updates**: Removed optimistic status toggles (and stopped writing the unsupported `'assigned'` enum) so moving or taking over a single thread no longer makes other rows flicker; UI now waits for Supabase to confirm before updating.
- **Takeover preserves handled-by**: Regular agents now claim chats without overwriting the super agent’s “Handled By” field; only masters/supers promote themselves while collaborators simply flip the status and log the event.
  - Updated: `src/components/chat/ConversationPage.tsx`, `src/hooks/useConversations.ts`

# [0.1.37] FE WEB CEKAT 2026-01-11
### Conversations & Assignment Flow
- Updated: `src/components/chat/ConversationPage.tsx`
- **Takeover scoped to Unassigned**: The Takeover Chat CTA now renders only when a thread is truly in the Unassigned state, preventing accidental reassignment attempts from other tabs.
  - Updated: `src/components/chat/ConversationPage.tsx`
- **Role-based composer rules**: Collaborators (when they’re the logged-in user), super agents, and master agents now get the message composer even on unassigned threads, while other agents still see the takeover prompt until they claim the chat.
  - Updated: `src/components/chat/ConversationPage.tsx`
- **Hide master agents from selectors**: Master agents can still act on any thread, but they no longer appear in the Handled By or Collaborator dropdowns to avoid accidental assignment to all-powerful accounts.

# [0.1.36] FE WEB CEKAT 2026-01-11
### Conversations & Assignment Flow
- **Three-state workflow overhaul**: Replaced the legacy status heuristic with an explicit `Assigned / Unassigned / Done` flow that keys off `status` plus the presence of a collaborator. Counts, badges, tab filters, and auto-selection now stay in sync with the new rules and never fall back to the deprecated multi-collaborator state.
  - Updated: `src/components/chat/ConversationPage.tsx`, `src/hooks/useConversations.ts`
- **Collaborator switch stability**: Guarded the URL/thread synchronization logic so picking a collaborator no longer triggers a rapid tab flip that spammed list/message fetches.

  - Updated: `src/components/chat/ConversationPage.tsx`

### Collaboration Data Model & Permissions
- **Single-column collaborator model**: Added a migration that backfills `threads.collaborator_user_id`, rewires all RLS policies to reference that column, and drops the obsolete `thread_collaborators` table plus its triggers.
  - New: `supabase/migrations/20260110_remove_thread_collaborators.sql`
  - Updated: `supabase/migrations/permissions_update_and_policies_updates.sql`, `supabase/migrations/20251124230847_baseline.sql`, `supabase/schema.sql`, `sync/tables.config.json`
- **Typed API parity**: Regenerated Supabase types so the frontend integrations include the new `collaborator_user_id` field and foreign key metadata.
  - Updated: `src/integrations/supabase/types.ts`

### Navigation & RBAC
- **Hide AI Agents for regular agents**: Sidebar configuration now outright hides the AI Agents menu when the signed-in user only has the `agent` role, preventing them from entering AI profile management.
  - Updated: `src/config/navigation.ts`, `src/hooks/useNavigation.ts`

# [0.1.35] FE WEB CEKAT 2026-01-10
### Housekeeping
- **Line-ending normalization (no logic changes)**: Synchronized CRLF/LF on chat/contact pages and hooks to keep diffs clean without altering runtime behavior.
  - Touched: `src/components/chat/ConversationPage.tsx`, `src/components/contacts/Contacts.tsx`, `src/hooks/useContacts.ts`, `src/hooks/useConversations.ts`, `src/pages/LiveChat.tsx`
- **Migration formatting**: Tidied whitespace in the `thread_status` enum migration to match our SQL formatting conventions.
  - Updated: `supabase/migrations/20260109000000_add_assigned_thread_status.sql`

# [0.1.34] FE WEB CEKAT 2026-01-09
### Live Chat & Messaging
- **Realtime Message Recovery**: Fixed a bug where customer messages (role: 'user') were filtered out of the realtime feed, ensuring the chat window correctly updates when messages are persisted to the database.
  - Updated: `src/pages/LiveChat.tsx`
- **Smart Message Deduplication**: Added a client-side deduplication pass that prevents "double bubbles" when both an optimistic send and a database insert arrive near-simultaneously (2-second window).
  - Updated: `src/pages/LiveChat.tsx`
- **Resilient Thread Attachment**: Relaxed the thread lookup logic so the widget gracefully falls back to the most recent channel activity if a session-id match isn't immediately found—no more hanging on "Waiting for response".
  - Updated: `src/pages/LiveChat.tsx`

### Assignment & Status Management
- **Thread Status Enum Extension**: Added a new `assigned` value to the database `thread_status` enum to properly distinguish between new inquiries and those handled by a super agent or human.
  - New: `supabase/migrations/20260109000000_add_assigned_thread_status.sql`
- **Automated Assignment Flow**: Threads now automatically transition to `assigned` status when a bot hands off or a super agent is linked to the platform, while remaining in `open` for fresh inquiries.
  - Updated: `src/hooks/useConversations.ts`
- **Enum Safety Fallback**: Added a catch for Supabase error `22P02` so the app gracefully falls back to `open` status if the new `assigned` enum value hasn't been applied to the database yet.
  - Updated: `src/hooks/useConversations.ts`
- **Handled-By Display Logic**: Refactored the UI to show the platform's super agent as the default handler for bot-managed threads without incorrectly flagging them as "Assigned" until a real handoff occurs.
  - Updated: `src/hooks/useConversations.ts`

### UI/UX Polish
- **Silent Background Refresh**: Implemented a "silent" fetch mode for conversation lists that bypasses global loading states, eliminating the screen "blinking" effect when sending messages or receiving updates.
  - Updated: `src/hooks/useConversations.ts`, `src/components/chat/ConversationPage.tsx`
- **Toaster Cleanup**: Removed redundant "Message sent successfully" notifications to reduce UI clutter, keeping toasts reserved for actual errors or critical events.
  - Updated: `src/components/chat/ConversationPage.tsx`
- **Enhanced Contact Filtering**: Surfaced the new `assigned` status in the Contacts view with proper badge coloring and filter support.
  - Updated: `src/components/contacts/Contacts.tsx`, `src/hooks/useContacts.ts`
- **Live Chat Realtime Resync**: Added a lightweight catch-up mechanism that rehydrates conversations if the Supabase realtime channel drops or the tab wakes from suspension—no constant polling required.
  - Updated: `src/pages/LiveChat.tsx`
- **New Thread Subscription Fix**: Realtime subscriptions now hydrate newly created live chat threads immediately without requiring a manual refresh.
  - Updated: `src/pages/LiveChat.tsx`
- **Queued Catch-Up Requests**: Ensures live chat queues multiple background fetches when the first message creates a thread so the AI reply appears without manual reloads, retries the AI webhook on transient failures, and preserves message order for streaming replies.
  - Updated: `src/pages/LiveChat.tsx`
- **Session-Scoped Live Chat Threads**: Persist the live chat thread per browser session and only attach to threads created for the current session username, so concurrent visitors no longer see mixed conversations.
  - Updated: `src/pages/LiveChat.tsx`
- **Streaming Placeholder Cleanup**: Replace temporary assistant bubbles with the persisted Supabase message as soon as it arrives, preventing the UI from flickering or reordering when replies land.
  - Updated: `src/pages/LiveChat.tsx`
- **Thread Restore Fallbacks**: If Supabase hasn't stamped a `session_id`, the live chat gracefully falls back to the contact alias when restoring or attaching to a thread—no more blank states or scrolling jumps.
  - Updated: `src/pages/LiveChat.tsx`
- **Realtime Catch-Up Safety Net**: After each API send, the widget aggressively refetches the thread so AI replies render even if realtime events arrive late.
  - Updated: `src/pages/LiveChat.tsx`

# [0.1.33] FE WEB CEKAT 2026-01-08
### Conversations
- **Role-aware Message Composer**: Chat input now enables whenever a user has `messages.create`, is a master/super agent, is the current handled-by assignee, or is the selected collaborator—ensuring the right people can reply without manual overrides.
  - Updated: `src/components/chat/ConversationPage.tsx`

# [0.1.32] FE WEB CEKAT 2026-01-08
### Platform Management
- **Live Chat Link Quality-of-Life**: Added copy-to-clipboard buttons with toast feedback for both the live chat URL and embed snippet so teammates can drop links/widgets faster without selecting text manually.
  - Updated: `src/components/platforms/ConnectedPlatforms.tsx`

### Navigation & RBAC
- **Guaranteed Human Agents Menu for Supervisors**: Super agents now always see the Human Agents sidebar item (role bypass) and can open the roster even if their read permissions are still syncing.
  - Updated: `src/config/navigation.ts`, `src/hooks/useNavigation.ts`, `src/components/navigation/PermissionNavItem.tsx`, `src/pages/Index.tsx`

### Human Agent Management
- **Super Agent Focused View**: When a super agent opens the roster the Create button and Pending tab disappear, role/status filters are hidden, and all action buttons (status, limits, delete) are automatically allowed for members in their own cluster thanks to the new `roleBypass` helper.
  - Updated: `src/components/humanagents/HumanAgents.tsx`, `src/components/rbac/PermissionGate.tsx`

### Conversation Sidebar
- **Handled By Read-Only**: The “Handled By” field is now display-only, preventing mid-conversation reassignment from the info pane while still showing who currently owns the thread.
  - Updated: `src/components/chat/ConversationPage.tsx`

# [0.1.31] FE WEB CEKAT 2026-01-08
- **Live Chat Realtime-Only Sync**: Removed the 2-second polling loop from the live chat widget so updates rely solely on Supabase realtime subscriptions, cutting unnecessary network and memory usage.
  - Updated: `src/pages/LiveChat.tsx`

# [0.1.30] FE WEB CEKAT 2026-01-07
### Platform Management
- **Live Chat Takeover Notices**: System takeover events now render as toast notifications instead of chat bubbles, keeping conversation history clean while still informing customers.
  - Updated: `src/pages/LiveChat.tsx`
- **Human Agent Assignment UX**: Selecting agents in platform edit autosaves immediately; no more extra click to add collaborators.
  - Updated: `src/components/platforms/ConnectedPlatforms.tsx`
- **Header Cleanup**: Removed redundant save/delete buttons from platform edit header; autosave flow handles updates and delete remains available in the existing danger zone.
  - Updated: `src/components/platforms/ConnectedPlatforms.tsx`

# [0.1.29] FE WEB CEKAT 2026-01-07
### Conversation Management
- **Single Collaborator Restriction**: Changed Collaborators field from multi-select to single-select, allowing only one collaborator per thread.
  - Replaced `SearchableMultiSelect` with `SearchableSelect` component for collaborator selection.
  - When a new collaborator is selected, it automatically replaces any existing collaborator for that thread.
  - Collaborator field supports clearing selection to remove the collaborator entirely.
  - Existing threads with multiple collaborators are automatically trimmed to a single collaborator when accessed.
  - Updated: `src/components/chat/ConversationPage.tsx`

- **Role-Based Takeover Chat Button**: Implemented role-based access control for the "Takeover Chat" button.
  - **Master agents and super agents**: Takeover button is always enabled (when thread is unassigned).
  - **Regular agents**: Takeover button is only enabled when no collaborator exists for the thread.
  - Regular agents see a disabled button with tooltip explanation when a collaborator is already assigned.
  - Prevents regular agents from taking over conversations that already have a collaborator assigned.
  - Updated: `src/components/chat/ConversationPage.tsx`

# [0.1.28] FE WEB CEKAT 2026-01-07
### Security & Data Access Control
- **Super Agent Data Isolation**: Implemented Row Level Security (RLS) policies to ensure super agents can only view their own data in platform creation forms.
  - Secured `v_users` view to prevent data leakage by removing direct access to `auth.users` table.
  - View now anchors on `users_profile` table with proper RLS enforcement, ensuring super agents only see their own profile.
  - Master agents retain full visibility to all users within their organization via `is_master_agent_in_org()` function.
  - Database migration applied to enforce RLS policies at the database level for true security (not just frontend filtering).

### Platform Creation Forms
- **Auto-Select Super Agent for Super Agent Users**: Enhanced platform creation forms (Telegram, WhatsApp, Web) to automatically select and lock the Super Agent dropdown when the current user is a super agent.
  - Super Agent field is automatically populated with the current user's ID when form opens for super agent users.
  - Field becomes read-only (disabled) with visual indication when user is a super agent, preventing them from changing their own assignment.
  - Helper text updated to indicate that super agent is automatically determined by the current user's account for super agent users.
  - Master agents continue to see and can select from all available super agents in the dropdown.
  - Updated: `src/components/platforms/TelegramPlatformForm.tsx`, `src/components/platforms/WebPlatformForm.tsx`, `src/components/platforms/WhatsAppPlatformForm.tsx`


# [0.1.27] FE WEB CEKAT 2026-01-02
### Conversation Management
- **Handled By Clearing**: Users can now remove super agent assignments from conversations using a clear button in the "Handled By" selector.
  - Added `allowClear` prop to `SearchableSelect` component with inline clear button (X icon) that appears when a value is selected.
  - "Handled By" selector in conversation sidebar now supports clearing assignments, allowing conversations to be unassigned.
  - Updated `assignThreadToUser` function to accept `null` for unassigning conversations, properly clearing assignment metadata and creating "conversation unassigned" system event messages.
  - When clearing "Handled By", all collaborators are automatically removed to maintain data consistency.
  - Updated: `src/components/ui/searchable-select.tsx`, `src/components/chat/ConversationPage.tsx`, `src/hooks/useConversations.ts`
- **Resolved Thread Read-Only Controls**: Closed conversations now lock their "Handled By" and collaborator selectors.
  - `SearchableSelect` and `SearchableMultiSelect` honor the disabled state (no clear button, no chip removal) when a thread is resolved.
  - Collaborator add/remove handlers bail early for resolved threads to prevent accidental edits.
  - Updated: `src/components/ui/searchable-select.tsx`, `src/components/chat/ConversationPage.tsx`

# [0.1.26] FE WEB CEKAT 2026-01-01
### Supabase Configuration
- **Env-only credentials**: `src/config/supabase.ts` now reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) directly from the environment, with clear error messages when either is missing.
- **Removed baked-in keys**: Any hardcoded DEV/PROD URLs or anonymous keys have been removed, eliminating mismatched-session logouts when the production build refreshes.
- **Commit:** `chore: document proxy routing updates` — aligned the config with environment-driven credentials and documented the change.

# [0.1.25] FE WEB CEKAT 2025-12-30
### Webhook Routing & Live Chat
- **Proxy-aware production routing**: `src/config/webhook.ts` now prefers Supabase Edge proxy routes while still allowing explicit overrides and legacy fallbacks, ensuring production hits `proxy-n8n` even when `VITE_WEBHOOK_BASE_URL` is set to your Supabase host.
- **Client auth resilience**: `src/lib/webhookClient.ts` attempts to attach a session token when available but no longer blocks calls if the viewer lacks one, so widget traffic still reaches the proxy (and surfaces 401s when the function enforces auth).
- **Env guidance**: Documented the required `VITE_SUPABASE_ANON_KEY` in `src/config/supabase.ts` so deployments fail fast if keys are missing, and restored custom-domain detection so `api.cssuper.com` resolves to the production Supabase key when the variable is omitted.
- **Commit:** `chore: document proxy routing updates` — removed hardcoded Supabase fallbacks so `src/config/supabase.ts` now reads only the environment-provided URL/key, preventing prod refresh logouts caused by mismatched credentials.
### Live Chat
- **Streaming order stability**: `src/pages/LiveChat.tsx` now tracks a monotonic render order so assistant replies consistently appear beneath the triggering user message without requiring a refresh.
- **Proxy-first webhook**: The Live Chat send flow always calls the Supabase `proxy-n8n` function before falling back to the legacy webhook, so both production and development environments continue to hit the proxy listener.

# [0.1.24] FE WEB CEKAT 2025-12-30
### Contacts → Conversations (Multi-Thread Support)
- **Thread Picker for “Open conversation”**: Contacts now open a thread/channel picker instead of jumping directly to `/chat` by contact, solving ambiguity when a contact has multiple threads across channels.
  - New component: `src/components/chat/ContactThreadPickerDialog.tsx`
  - Updated: `src/components/contacts/Contacts.tsx` now opens the picker and navigates with `menu=chat&contact=<id>&thread=<id>`

### Conversations: Deterministic Thread Selection
- **URL-based thread deep link**: `ConversationPage` now supports `thread=<threadId>` and prioritizes it over `contact=<contactId>`, ensuring the correct thread opens even when the same contact has multiple channel threads.
  - Clicking a conversation updates the URL (`thread` + `contact`) so navigation is stable and shareable.
  - Updated: `src/components/chat/ConversationPage.tsx`

### Conversations UI
- **Platform tags**: Conversation rows now show provider badges (e.g. Telegram/Web/WhatsApp) for clearer channel context.
  - Updated: `src/components/chat/ConversationPage.tsx`

### Thread Picker UI Polish
- **Better list layout**: Improved thread list rendering to avoid clipped/trimmed rows and to pin the platform chip to the bottom-right of each row (timestamp top-right).
  - Updated: `src/components/chat/ContactThreadPickerDialog.tsx`

# [0.1.23] FE WEB CEKAT 2025-12-29
### Authentication & User Management
- **Whitespace-Free Email & Password Inputs**: Login, reset-password, and agent creation forms now strip spaces and force lowercase emails while blocking space characters in passwords, preventing accidental invalid credentials.
  - `src/components/auth/Login.tsx` sanitizes email input across login, reset, and (future) signup tabs and blocks whitespace in password fields.
  - `src/pages/ResetPassword.tsx` applies the same input guards to new/confirm password fields.
  - `src/components/humanagents/HumanAgents.tsx` normalizes emails when creating agents to avoid duplicate entries caused by casing or trailing spaces.

### Conversations
- **WhatsApp-Style Day Separators**: Chat threads display `Today`, `Yesterday`, or a formatted date badge between message clusters, making timelines easier to scan.
  - Implemented in `src/components/chat/ConversationPage.tsx` with memoized grouping so the list stays performant.

### Analytics
- **Unified Date Range Picker**: Replaced separate `From`/`To` inputs with a single range calendar that mirrors the contacts page behavior and keeps queries bounded to today.
  - `src/components/analytics/Analytics.tsx` stores normalized `YYYY-MM-DD` strings and offers a quick “Clear” action.
- **Stable Refresh Logic**: Prevented stale data by delaying metric/database fetches until the user finishes selecting the range (popover closes), ensuring the latest `from/to` pair drives every refresh.

# [0.1.22] FE WEB CEKAT 2025-12-24
### Authentication & Environment
- **Supabase Config Hardening**: Prevented “Invalid API key” errors in Netlify preview/dev deploys caused by URL/key mismatches.
  - `src/config/supabase.ts` now infers dev/prod pairing from the Supabase URL host when only one override is provided.
  - Defaults to a dev-safe target unless the URL clearly points to `api.cssuper.com`.
  - Still supports explicit `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` overrides.

### Platforms (WhatsApp)
- **Delete Webhook Payload**: When deleting WhatsApp channels, the webhook call now includes the channel identifier.
  - `DELETE_SESSION` payload now sends `channel_id` and `org_id` alongside `session_name` for reliable backend cleanup.

- **External ID Consistency**: WhatsApp channels now maintain a stable external identifier across lifecycle states.
  - On create, WhatsApp channels set `external_id` to the normalized WAHA session name and store `credentials.waha_session_name`.
  - WAHA session sync now upgrades `external_id` to the real WhatsApp `me.id` (e.g. `628...@c.us`) once available, and never wipes it back to null.
  - Added a fallback lookup to `GET /api/sessions/{name}` when the WAHA list endpoint does not include `me.id`.
  - Standardized WAHA session naming to `toLowerCase().replace(/\s/g,'')` for consistent matching.
# [0.1.21] FE WEB CEKAT 2025-12-24
### Circuit Breaker Settings
- **Date Range Validation**: Updated chat date filter to require both "From" and "To" values before applying.
  - Prevents half-filled date ranges from running and warns users when only one side is selected.
  - Disallows selecting an end date earlier than the start date and keeps calendars constrained to valid ranges.
- **Audit Log Date Filter Guardrails**: Logs page now requires selecting both "From" and "To" dates and constrains pickers to valid ranges.
  - Displays inline guidance when only one side of the range is provided.
  - Ensures backend queries use start/end-of-day boundaries for inclusive day filtering.
  - Replaced separate date inputs with a single range calendar so start and end dates are chosen together.

# [0.1.20] FE WEB CEKAT 2025-12-24
### Conversations: Filter UX & Correctness
- **Channel Type Filter Fixed**: Channel Type now correctly filters threads at the query level.
  - Updated `useConversations` to use an inner join (`channels!inner(...)`) so `channels.provider` filters actually constrain `threads` results (PostgREST behavior).
  - Added defensive client-side filtering for `channelType`, `inbox`, and `platformId` to ensure consistent UI results.

- **Persistent Applied Filters**: Applied filters now persist and are shareable.
  - Filters are serialized into URL query params (`f_*`) so refresh/back/forward retains the exact filtered view.
  - If URL has no filter params, the last applied filters are restored from localStorage (per-user key).

- **Visible Active Filters**: Users can now see what’s currently applied.
  - `ConversationPage` renders active filter badges under the Conversations header (Channel, Platform, Status, Agent, Resolved By, Date, Inbox).
  - `ChatFilter` modal is now controlled via a `value` prop so reopening the modal shows the currently applied values.

### Configuration & Environment Management
- **Centralized URL Configuration**: Created comprehensive URL and environment configuration system
  - New `src/config/urls.ts` centralizes all app base URLs (APP_ORIGIN, WAHA_BASE_URL) with environment-aware defaults
  - New `src/config/supabase.ts` centralizes Supabase URL and key configuration with automatic dev/prod switching
  - Production app origin now defaults to `https://synkaai.netlify.app` (even in dev) for consistent LiveChat links
  - Supabase URL automatically switches: DEV → `bkynymyhbfrhvwxqqttk.supabase.co`, PROD → `api.cssuper.com`
  - All configuration supports `VITE_*` environment variable overrides for flexible deployment
  - Removed all hardcoded Netlify and Supabase URLs from components

- **Platform URL Updates**: Updated all platform-related URLs to use centralized configuration
  - `ConnectedPlatforms.tsx` now uses `APP_ORIGIN` and `livechatUrl()` helper instead of hardcoded URLs
  - LiveChat embed code now uses configurable `APP_ORIGIN` instead of hardcoded domain
  - `WhatsAppPlatformForm.tsx` uses `WAHA_BASE_URL` from config instead of hardcoded Railway URL
  - All platform forms now reference single source of truth for base URLs

### AI Agent Settings Cleanup
- **Removed Context Window Field**: Removed "Context Window (K tokens)" from Additional Settings UI
  - Field no longer visible or editable in AI Agent Settings interface
  - Removed all related state variables (`contextLimitInput`, `contextLimitMax`)
  - Removed input handler (`handleContextLimitChange`) and validation logic
  - Save logic still automatically persists safe default value (existing value or 28K tokens, clamped to model capability)
  - Ensures database writes continue to work without breaking changes

### Conversation Filtering
- **Removed Pipeline Status Filter**: Cleaned up thread filter interface
  - Removed "Pipeline Status" dropdown from chat filter dialog
  - Removed `pipelineStatus` from filter state and type definitions
  - Removed `pipeline_status` query filtering from `useConversations` hook
  - Simplified filter UI with cleaner, more focused options

### Technical Improvements
- **Code Organization**: Improved maintainability and consistency
  - Single source of truth for all environment-specific URLs
  - Consistent configuration pattern across all services
  - Better separation of concerns between UI and configuration
  - Enhanced type safety with centralized config exports

# [0.1.19] FE WEB CEKAT 2025-12-24
### Circuit Breaker Settings
- **Robust Numeric Validation**: Reset timeout, monitoring period, request timeout, and threshold fields now accept temporary clears but enforce min/max bounds before saving.
  - Inline error messages and disabled save state prevent invalid submissions.
  - Inputs strip non-numeric characters, block scientific notation, and clamp values to their allowed ranges.
- **Latency Feedback**: Healthy and stress latency controls show live seconds previews, clarifying millisecond inputs.
- **Tooltip Refinement**: Repositioned tooltips to render beside their triggers, preventing clipping inside the modal.

### Adaptive Rate Limiter Configuration
- **Precision Controls**: Base limits and multiplier inputs now sanitize numeric entry, limit decimals to three places, and sync their raw display strings with validated state.
- **Validation Guardrails**: All adaptive fields surface inline errors and keep the save button disabled until values fall within allowed ranges.
- **Enhanced Summary**: Read-only configuration card now surfaces latency thresholds (with seconds) alongside existing multiplier and interval details.
- **Modal Tooltips**: Every helper tooltip aligns left/right relative to its column, ensuring full visibility within the dialog.

# [0.1.18] FE WEB CEKAT 2025-12-24
### Bug Fixes
- **Fixed Platform Filter Not Finding Channels**: Resolved critical bug where selecting a channel type (Telegram, WhatsApp, Web) would show no platforms.
  - Changed platform filtering from `channels.type` to `channels.provider` to match actual database schema.
  - In database, `channels.provider` contains transport values (`telegram`, `web`, `whatsapp`) while `channels.type` contains implementation details (`bot`, `inbox`).
  - Updated both `ChatFilter.tsx` (UI filtering) and `useConversations.ts` (query filtering) to use `channels.provider`.
  - Telegram and other channel types now correctly display their platforms when selected.

### Conversation Management
- **Hierarchical Channel Type → Platform Filter**: Enhanced chat filter with parent-child filter relationship.
  - Platform filter now requires Channel Type selection first (Platform dropdown disabled until Channel Type is chosen).
  - Placeholder text changes to "Select channel type first" when Channel Type is not selected.
  - Changing Channel Type automatically clears Platform selection to prevent stale selections.
  - Improved UX with clear dependency indication between filters.

- **Empty State for Platform Filter**: Added user-friendly empty state handling.
  - When selected Channel Type has no matching platforms, dropdown shows disabled option: "No platforms found for this channel type".
  - Prevents confusion when no results are available for a selected channel type.
  - Platform display simplified to show only `display_name` without provider/type suffix for cleaner UI.

# [0.1.17] FE WEB CEKAT 2025-12-22
### Bug Fixes
- **Fixed Stale Data Persistence After Role Changes**: Resolved critical issue where threads and contacts persisted in the UI after role changes in the database.
  - Removed localStorage caching for threads (`app.cachedConversations`) to prevent stale data from persisting after authorization changes.
  - Disabled query caching for authorization-sensitive operations (threads, contacts) in `protectedSupabase` wrapper to ensure fresh data on role changes.
  - Threads and contacts now immediately clear and refetch when user roles change, preventing unauthorized data from being displayed.
  - Fixed issue where changing a user's role from `master_agent` to `super_agent` (or vice versa) in the database would not immediately reflect in the UI.

### Technical Improvements
- **Realtime Role Change Detection**: Implemented comprehensive authorization change detection system.
  - Added realtime subscription to `user_roles` table in `RBACContext` to detect role changes for the current user.
  - Created `authz.ts` utility module for centralized authorization change handling and cache invalidation.
  - Implemented event-based system (`authzChanged` event) to notify hooks when authorization changes occur.
  - `useConversations` and `useContacts` hooks now listen for authorization changes and automatically reset state + refetch data.
  - Ensures UI always reflects current user permissions without requiring manual refresh or logout/login.

- **Cache Invalidation Strategy**: Enhanced cache management for authorization-sensitive data.
  - Authorization changes now trigger comprehensive cache clearing (localStorage, query cache, fallback handler).
  - Removed role-agnostic caching that could serve stale results after permission changes.
  - All authorization-sensitive queries now bypass cache to ensure data accuracy.
  - Improved security by preventing cached data from persisting after role downgrades.

# [0.1.16] FE WEB CEKAT 2025-12-20
### UI Components
- **SearchableSelect Component**: Added a new reusable searchable single-select dropdown component.
  - Provides searchable dropdown functionality with keyboard navigation support.
  - Includes proper accessibility attributes and visual feedback for selected items.
  - Used for improved agent assignment interface in conversation management.

- **SearchableMultiSelect Component**: Added a new reusable searchable multi-select component.
  - Supports selecting multiple items with badge display for selected values.
  - Includes add/remove callbacks for granular control over selection changes.
  - Displays selected items as removable badges with clear visual indicators.

### Conversation Management
- **Enhanced Agent Assignment UI**: Replaced popover-based assignment interface with searchable select components.
  - "Handled By" field now uses `SearchableSelect` for improved searchability and UX.
  - Streamlined assignment flow with better visual feedback and state management.
  - Added optimistic UI updates with proper state synchronization.

- **Improved Collaborator Management**: Enhanced thread collaborator interface with multi-select support.
  - Replaced popover-based collaborator addition with `SearchableMultiSelect` component.
  - Collaborator list now displays as removable badges for better visibility.
  - Added support for super agent member filtering - only members of the assigned super agent can be added as collaborators.
  - Collaborator selection is disabled until a "Handled By" agent is assigned.
  - Automatic fetching of super agent members when an agent is assigned.

- **Manual Thread Assignment**: Added `assignThreadToUser` function for supervisor-level thread reassignment.
  - Allows supervisors to manually assign conversations to specific users.
  - Automatically creates system event messages when assignments occur.
  - Updates thread metadata including `assigned_by_user_id`, `assigned_at`, and `handover_reason`.
  - Disables AI access when manually assigned (`ai_access_enabled: false`).

- **User Label Resolution**: Improved user display name resolution for agents and collaborators.
  - Fetches user profile data for agents not present in the human agents list.
  - Caches user labels to avoid redundant API calls.
  - Provides fallback display names when profile data is unavailable.

### Bug Fixes
- **Fixed Handled By State Leak**: Resolved critical bug where assigning a thread to an agent would incorrectly show that agent as assigned to all other threads.
  - Scoped `handledByOverride` state to specific thread IDs instead of using global state.
  - Optimistic UI updates now only apply to the thread being assigned, preventing state leakage when navigating between conversations.
  - Fixed issue where changing "Handled By" for one thread would temporarily display the same value for all threads until server refresh.

# [0.1.15] FE WEB CEKAT 2025-12-19
### Database & Policies
- **Threads Update Policy**: Master agents can now resolve conversations across all environments.
  - Updated the `threads update perm update_own` policy to allow updates when `is_master_agent_in_org(org_id)` is true.
  - Applied the policy change to main, development, and backup Supabase projects and added a migration for consistency.

### Conversation Management
- **Resolved Thread Cleanup**: UI now hides take-over controls once a thread is closed.
  - Removed the takeover button and composer input when `status === 'closed'`, preventing accidental actions on resolved chats.

### Contacts
- **Unassigned Filter Accuracy**: Ensured the contacts list reflects only unassigned records without altering assigned data.
  - Adjusted Supabase querying and client filtering so contacts with no assigned agent (or no thread yet) display correctly.
  - Total counters and pagination now show filtered counts (e.g. `12 of 16`) when a handled-by filter is active.
- **Export to CSV**: Added a one-click export that downloads the current contact dataset (with latest thread info) as a CSV.
  - Includes contact fields (name, phone, email, notes, created_at) and latest thread metadata (status, handled by, channel).
- **Toolbar Cleanup**: Removed the unused “Customize Columns” button for a leaner toolbar experience.

# [0.1.14] FE WEB CEKAT 2025-12-18
### Platform Forms (WhatsApp / Telegram / Web)
- **Top Spacing Layout Fix**: Standardized form spacing under dialog headers for a cleaner, consistent layout across all platform setup forms.

### Telegram Platform
- **Bot Token Validation (Required)**: Added a **Validate** button beside the Telegram Bot Token field and made validation mandatory before creating a Telegram platform.
  - Create is blocked with an error until the token has been validated.
- **Token Verification via Supabase Edge Function**: Token verification now calls the Supabase Edge Function endpoint (`/functions/v1/telegram-verify-token`) with a strict response contract (`{ valid: boolean }`).
  - `callWebhook()` now auto-attaches Supabase auth headers for Supabase Edge Function URLs.

# [0.1.13] FE WEB CEKAT 2025-12-17
### Conversation Management
- **Date Filter Fix**: Resolved an issue where the date filter in the conversations menu would incorrectly exclude valid conversations.
  - Switched from server-side filtering on `created_at`/`last_msg_at` (which could be stale) to client-side filtering using the computed last message time.
  - Ensures the filter now perfectly matches the dates displayed in the UI, correctly showing threads active within the selected range.

# [0.1.12] FE WEB CEKAT 2025-12-14
### Human Agents UI Protection
- **Master Agent UI Safeguards**: Enhanced protection for master agent accounts in the Human Agents interface.
  - Status dropdown button is now disabled for master agents across all sections (master agents, super agents, regular agents, and pending invitations).
  - Chevron dropdown icon is conditionally hidden for master agents to provide clear visual indication that status cannot be changed.
  - Delete button is completely hidden for master agents (replacing the previous disabled button with tooltip approach) across all agent sections.
  - Applied consistent protection logic using `primaryRole === 'master_agent'` checks throughout the component.
  - Provides cleaner UI experience by removing non-functional controls rather than showing disabled states.

### Authentication & OTP
- **2FA Email Edge Function Update**: Updated edge function reference for login-specific 2FA emails.
  - Changed edge function call from `send-2fa-email` to `send-2fa-login-email` in `AuthContext.tsx` and `Otp.tsx`.
  - Aligns with backend function naming convention for better clarity and separation of login vs other 2FA email flows.

# [0.1.11] FE WEB CEKAT 2025-12-10
### Conversation Management
- **Status Filter Cleanup**: Removed the redundant "Resolved" option from the conversation status filter.
  - The "Closed" status now serves as the single source of truth for completed conversations.
  - Simplified the filtering logic to remove unnecessary status checks.

# [0.1.10] FE WEB CEKAT 2025-12-09
### Human Agents & Permissions
- **Create Agent Permission Gate**: Simplified and hardened the Create Agent button on the Human Agents page.
  - Button is now directly gated by `users_profile.create` via `PermissionGate`, following the same pattern as other RBAC-protected actions.
  - When the user lacks permission, the button stays visible but disabled with a clear tooltip (“You do not have permission to create agents.”).
  - Removed the extra client-side lookup against the `permissions` table and associated state (`createPermissionKey`, `checkingCreatePermission`) to reduce complexity and runtime edge cases.

### Navigation & RBAC Consistency
- **Super Agents Schema Alignment**: Updated `PERMISSIONS_SCHEMA` to include the full `super_agents` action set (`create`, `update`, `delete`, `read_all`, `read_own`), matching the backend `permissions` table.
- **Navigation Read-Gates**: Centralized navigation gating to use read scopes consistently:
  - Added a defensive `readPerms(resource)` helper that safely derives `resource.read*` keys from `PERMISSIONS_SCHEMA`.
  - Human Agents sidebar item now depends on any `super_agents` read scope (e.g. `super_agents.read_all` / `super_agents.read_own`), keeping menu visibility aligned with DB permissions.
- **useNavigation Stability**: Adjusted `useNavigation` to skip DB permission recomputation while RBAC is still loading, preventing transient context errors during hot reloads while keeping the existing has_perm-first behavior.

# [0.1.9] FE WEB CEKAT 2025-12-03
### AI Agents
- Replaced the browser `confirm()` with a first-class modal when deleting AI agents.
  - Uses the shared `AlertDialog` component with explicit cancel/confirm controls.
  - Shows the agent name inside the confirmation copy and blocks dismissal while the request is in flight.
  - Surfaces loader feedback and only closes when the Supabase delete succeeds.

# [0.1.8] FE WEB CEKAT 2025-12-03
### Platform Forms: Super Agent Management & Scoping
- **Explicit Super Agent Selection**: All platform forms (WhatsApp, Telegram, Web) now require explicit Super Agent selection before AI Agent selection
  - Super Agent field is now a required, selectable dropdown (previously derived from AI Agent)
  - Field appears above AI Agent selection with clear labeling and tooltips
  - Form validation prevents submission without Super Agent selection
  - Helper text explains that Super Agent can be changed independently of AI Agent

- **AI Agent Filtering by Super Agent**: Enhanced AI Agent selection with strict scoping
  - AI Agent dropdown only shows agents belonging to the selected Super Agent
  - Validation prevents selecting AI agents that don't belong to the selected Super Agent
  - Error toast notifications when attempting invalid selections
  - Form automatically resets AI Agent selection when Super Agent changes
  - Warning message displayed if selected AI Agent lacks a Super Agent assignment

- **Human Agent Scoping**: Improved human agent assignment with role-based filtering
  - Human Agent multi-select only shows agents assigned to the selected Super Agent
  - "Select All" and "Unselect All" buttons for quick agent assignment
  - Multi-select disabled until Super Agent is selected
  - Clear placeholder text indicating selection requirements
  - Consistent behavior across all platform types (WhatsApp, Telegram, Web)

- **AI Agent Creation Enhancement**: Super Agent assignment during creation
  - Super Agent selection required in AI Agent creation dialog
  - Searchable dropdown for Super Agent selection
  - Super Agent information displayed in AI Agent cards
  - Validation ensures Super Agent is selected before agent creation

### Navigation & Permissions Updates
- **Navigation Configuration**: Updated navigation items and permission mappings
  - Refined permission checks for navigation visibility
  - Enhanced role-based access control for navigation items
  - Improved database permission checks in useNavigation hook

- **Permission Schema**: Updated permissions configuration
  - Aligned permission schema with backend requirements
  - Enhanced permission categorization and validation

### Live Chat Improvements
- **Message Handling**: Enhanced message synchronization and streaming
  - Improved realtime message updates
  - Better handling of streaming responses
  - Optimized message deduplication logic
  - Enhanced user message timeout handling

### Webhook Configuration
- **Webhook Routing**: Updated webhook endpoint configuration
  - Enhanced proxy-aware routing
  - Improved endpoint resolution for different providers
  - Better error handling for webhook calls

### Technical Improvements
- **Hooks Enhancement**: Improved data fetching and scoping
  - Enhanced useAIAgents hook with better super agent scoping
  - Improved useNavigation hook with database permission checks
  - Better error handling and loading states
  - Optimized cache management

# [0.1.7] FE WEB CEKAT 2025-12-03
### RBAC & Permissions (Finalized Alignment)
- Standardized PERMISSIONS_SCHEMA to match production backend exactly:
  analytics, ai_profiles, ai_sessions, channels, contacts, contact_identities, threads, messages, ai_agent_files, admin_panel, roles, audit_logs, alerts.
- Permission Matrix UX revamp (purely permission-driven):
  - Card sections enforced per resource: Manage (create/update/delete), Access Level (read variants), Special Actions (send/ack).
  - Mutually exclusive Access Level pills; Threads uses “My Channels” (read_channel_owned), “Collaborator”, “All”.
  - Special actions exposed as toggles: messages.send (Send), alerts.ack (Acknowledge).
  - “Select All” sets Manage + Special Actions ON and selects the most permissive single read level; “Unselect All” resets to None.
  - Labels updated (“Update Settings” for admin_panel.update); consistent wording across cards.
  - Added concise tooltips for threads/messages read scopes and alerts.ack.
- Removed bundle-based “Menu Access” from PermissionsPage; no more ghost toggles or bundles.
- Fixed toggle handler so switches reflect intended state; role permission grant/revoke now gated by roles.update.
- Debounced RBAC refresh during bulk edits to prevent UI lag.

### Navigation & Visibility (Policy-First)
- Menu visibility now depends on DB has_perm checks; items are hidden if the user lacks any read scope for that section.
- Updated gating keys to align with schema:
  - Admin Panel: admin_panel.read (menu), admin_panel.update (controls)
  - Permissions: roles.read
  - Chat: threads.read_* (any of read_all/read_channel_owned/read_collaborator)
  - Analytics: analytics.read
  - Contacts: contacts.read_*; Platforms: channels.read_*; AI Agents: ai_profiles.read_*; Logs: audit_logs.read
- Sidebar renders only items from getAccessibleNavItems(); fixed ReferenceError by properly destructuring the hook return.
- Reduced has_perm spam: policy checks recompute only when RBAC roles/permissions change.

### Admin Panel
- Replaced legacy access_rules.configure gates:
  - Controls now use admin_panel.update; navigation uses admin_panel.read.

### Misc
- Added contact_identities to schema.
- Consistency/cleanup across labels, ordering, and spacing in Permission Matrix.

# [0.1.6] FE WEB CEKAT 2025-11-30
### Cache Management & Session Reliability
- **Comprehensive Cache Clearing on Logout**: Enhanced logout functionality to clear all cached data
  - Clears all localStorage items (including `app.cached*`, `app.currentUserId`, etc.)
  - Clears all sessionStorage items
  - Clears all Supabase auth tokens
  - Prevents stale data from persisting after logout
  - Applied to both `AuthContext.signOut()` and `Logout.tsx` page

- **localStorage-Based User ID Storage**: Improved session reliability by storing user ID in localStorage
  - User ID and email stored in localStorage as `app.currentUserId` and `app.currentUserEmail` on login
  - Added `getCurrentUserId()` helper function that prefers localStorage over Supabase session
  - Updated `logAction()` to use localStorage user_id first, then fallback to Supabase session
  - Ensures consistent user identification even when Supabase session is temporarily unavailable

### Bug Fixes
- **Merge Conflict Resolution**: Resolved merge conflict in `useAIAgents.ts` by combining `scopeMode` and `superAgentId` logic
- **Policy Role Fix**: Fixed `threads_master_read` policy to use `authenticated` role instead of `public` role
- **Cache Persistence**: Fixed issue where cached data persisted after logout, causing users to see unauthorized data

# [0.1.5] FE WEB CEKAT 2025-11-30
### Webhook & Supabase URL Consistency
- **Single Source for Supabase URL**: Exported a shared `SUPABASE_URL` constant from the Supabase client so all front-end integrations reference the same base URL sinstead of duplicating it.
- **Proxy Edge Function Alignment**: Updated `WEBHOOK_CONFIG` to derive the proxy base (`/functions/v1/proxy-n8n`) from the shared `SUPABASE_URL`, removing the old hardcoded Supabase project host and keeping proxy routing aligned with the active project.
- **WhatsApp WAHA Webhook Normalization**: Swapped the hardcoded Railway webhook host in `WhatsAppPlatformForm` for `WEBHOOK_CONFIG.BASE_URL`, ensuring WAHA sessions always post back into the currently configured webhook environment.

# [0.1.4] FE WEB CEKAT 2025-11-28
### Bug Fixes
- **PermissionsPage Duplicate Declaration Fix**: Resolved "Identifier 'permissionSearch' has already been declared" syntax error
  - Removed duplicate state declarations for `permissionSearch`, `permissionResourceFilter`, and `permissionActionFilter`
  - Kept the properly typed versions of these state variables
  - Fixed runtime error that prevented the Permissions page from loading

# [0.1.3] FE WEB CEKAT 2025-11-28
### AI Agent Visibility
- Agents now only see AI agents owned by their assigned super agent; a new `useSuperAgentScope` hook drives consistent filtering across dashboards, dropdowns, and cached data.
- The AI Agents list and helpers surface localized messaging when an agent has no supervising cluster, preventing stale cross-team data from leaking through local storage.
### Database Access Control
- Tightened the `ai_profiles` RLS guard so master agents retain full visibility, super agents stay scoped to their own records, and agents inherit their supervising super agent’s access.

# [0.1.2] FE WEB CEKAT 2025-11-26
### Platform Form Enhancements for Super Agents
- **Super Agent Field Auto-Prefill**: All platform creation forms (Telegram, WhatsApp, Web) now automatically prefill the super agent field when the current user is a super agent
  - Super agent field is automatically populated with the current user's super agent username/ID when form opens
  - Field becomes readonly (visual indication with reduced opacity) when user is a super agent
  - Helper text updated to indicate super agent is determined by current user's account for super agent users
  - Prevents super agent users from changing their own super agent assignment

- **AI Agent Filtering for Super Agents**: Enhanced platform forms to filter AI agents based on super agent role
  - Super agent users only see AI agents that belong to their account in the AI agent dropdown
  - Validation prevents selecting AI agents that don't belong to the super agent's account
  - Error toast notification shown when attempting to select invalid AI agents
  - Master agents continue to see all AI agents as before

- **Role-Based Form Behavior**: Implemented role-aware form logic across all platform types
  - Added `useRBAC()` hook integration to check for `ROLES.SUPER_AGENT` role
  - Automatic super agent ID detection from `humanAgents` list when form opens
  - Form reset logic preserves super agent ID for super agent users
  - Consistent behavior across Telegram, WhatsApp, and Web platform forms

### Technical Improvements
- **Component Updates**: Enhanced platform form components with role-based logic
  - Added `useEffect` hooks to prefill super agent field on form open
  - Integrated `useRBAC` context for role checking
  - Added conditional rendering and validation based on user role
  - Improved form state management to preserve super agent selection for super agent users

# [0.1.1] FE WEB CEKAT 2025-11-27
### Permissions Console
- **Regression Fix**: Reintroduced missing permission search and filter state in `PermissionsPage`; restores the role configuration screen and avoids the `permissionSearch is not defined` runtime error.
- **Master Agent Safety Rail**: Hard-blocked deletion of the Master Agent from both UI and API helpers; delete buttons are disabled with guidance and back-end guards stop any direct calls.
### UI Localization
- **Master Agent Deletion Message**: Updated the modal tooltip and toast that appear when attempting to delete a master agent; the copy now follows the latest localization requirements.

# [0.1.0] FE WEB CEKAT 2025-11-27
### FINALIZED FOR PRODUCTION
### Agent Creation UX
- **Modal-Friendly Errors**: Duplicate-email validation now surfaces purely as a toast; the “Create Agent” dialog stays open and no longer renders the full-page error banner, making it easy to adjust the address and resubmit.

# [0.0.49] FE WEB CEKAT 2025-11-27
### Human Agents Roster
- **Duplicate Entry Cleanup**: Adjusted role grouping logic so master agents no longer appear in both the master and agent sections of the Human Agents table; prevents a single email from showing twice and keeps assignment status accurate.

### Login & Session Guardrails
- **Refresh Spinner Fix**: Added watchdog timers around Supabase session/bootstrap calls so a stalled `auth.getSession()` or 2FA profile check can’t trap users behind the infinite “Loading…” screen; stale sessions now fall back to the login view within a few seconds.
- **Account Status Timeouts**: Soft-capped the account status RPC to keep token refreshes responsive even if the database briefly stops responding.

# [0.0.48] FE WEB CEKAT 2025-11-26
### RBAC & Permissions System Enhancements
- **Master Agent Root Role Treatment**: Master Agent is now treated as root role with full system privileges
  - Master Agent role is designated as root role with unrestricted access across the system
  - Permission matrix editing is disabled for Master Agent to prevent accidental permission removal
  - Root role status ensures Master Agent maintains full privileges regardless of permission configuration

- **Permission Matrix UI Updates**: Disabled permission matrix editing for Master Agent role
  - Added root role detection in PermissionsPage component (`isRootSelected` check)
  - Permission matrix sections (Menu Access, CRUD Permissions, Special Permissions) are disabled when configuring Master Agent
  - Added informational "Root Role" card explaining Master Agent's full privilege status
  - All permission checkboxes and bundle toggles are disabled with helpful tooltips ("Master Agent is root; matrix disabled")
  - Clear visual indication that Master Agent has full privileges and doesn't require permission configuration
  - Prevents accidental permission removal for root role through UI safeguards
  - Early return guards prevent any permission toggle operations when Master Agent is selected

### Technical Improvements
- **PermissionsPage Component**: Enhanced role configuration logic
  - Added `isRootSelected` state check based on role name comparison
  - Conditional rendering of root role information card
  - Disabled state applied to all permission matrix controls for Master Agent
  - Improved tooltip messaging for disabled root role controls
- **Open Conversation Navigation Fix**: Ensured contacts page button opens chat inbox
  - `Open conversation` now routes to chat inbox with `menu=chat`
  - Automatically selects the relevant contact thread when available

# [0.0.47] FE WEB CEKAT 2025-11-25
### Supabase Baseline Refresh
- **Single Source Migration**: Replaced the entire migrations stack with `20251124230847_baseline.sql`, capturing today’s production schema so every environment can rebuild from a single, clean baseline.
- **Vector Extension Guardrails**: Ensured the baseline creates the `vector` extension in the `public` schema and updates every dependent function/column to reference the schema-qualified type.
- **Config Hardening**: Explicitly pins Supabase Storage to `v1.31.1` in `supabase/config.toml`, preventing CLI diffs from failing on missing storage migrations.

### Branch & Data Maintenance
- **Development Branch Reset**: Repaired Supabase migration history, reapplied the new baseline, and reset the `development` branch so it replays the trimmed migration set without legacy drift.
- **Main ↔ Dev Data Parity**: Dumped production `public` + `auth` data and restored it into the development branch, then pruned historic test accounts to keep both environments aligned.
- **Backup Hygiene**: Ran the same user cleanup on the backup project (`igtizjvhxgajijjjxnzi`) to ensure the automated sync worker starts from a consistent dataset.

# [0.0.46] FE WEB CEKAT 2025-11-24
### Database Migration Hardening
- **Legacy Platform Support**: Updated the `20250828000000_merge_platforms_into_channels.sql` migration to add any missing `platforms` columns (`display_name`, `website_url`, `status`, `secret_token`, `profile_photo_url`, `ai_profile_id`) on the fly so historical environments can replay migrations without schema drift.
- **Main Branch Hotfix Migration**: Applied Supabase migration `20250827950000_fix_platforms_schema` on production to backfill those columns immediately, unblocking rebase operations across environments.
- **Rebase Reliability**: Re-ran the Supabase rebase workflow to verify the new safeguards; future branch syncs no longer fail on missing column errors when promoting channels data.

# [0.0.45] FE WEB CEKAT 2025-11-23
### QA Testing Guide Expansion
- **End-to-End Flow Coverage**: Expanded `DOCUMENTATION.md` with exhaustive step-by-step flows covering login, OTP, password reset, human/AI agent lifecycle, contacts, permissions, admin utilities, analytics, and audit logs so QA can validate every button and path without code access.
- **Button & Validation Matrix**: Documented the enabled/disabled states, confirmation dialogs, toasts, and edge-case behaviour for all primary actions (create, save, delete, export, toggle) across the application.
- **Role-Based Walkthroughs**: Added guidance on testing from master, super, and agent perspectives, including navigation expectations and restricted-card behaviour on the dashboard.

### Documentation Quality Improvements
- **Live Chat & Admin Deep Dives**: Added detailed instructions for conversation tools (notes, tags, canned responses, SLAs), AI pause/resume workflow, circuit breaker monitoring, and platform onboarding (WhatsApp, Telegram, Web).
- **Human Agent Lifecycle**: Documented invite, resend, cancellation, token limit management, usage analytics, and removal to ensure QA covers onboarding and offboarding scenarios end-to-end.
- **Changelog & Profile Flows**: Captured interactive changelog behaviour, search/filter expectations, and full profile/session management (2FA toggle, password change, device sign-out).

### Super Agent Clustering
- **AI Agent Ownership**: Introduced `super_agent_id` on `ai_profiles`, enforced via migrations and new RLS policies. Super agents only see/manage their own AI agents; master agents can reassign via settings.
- **Auto-Inherited Platform Ownership**: Platform creation/editing now derives `channels.super_agent_id` from the selected AI agent, eliminating manual super agent selection while keeping human-agent assignment intact.
- **Scoped Listings**: AI agent lists, stats, and platform forms filter to the current super agent automatically; agents without clusters are prevented from being used until assigned.

### Platform Assignment Guard
- **Scoped Agent Dropdowns**: When creating WhatsApp, Telegram, or Web platforms as a master agent, the human-agent selector now lists only agents assigned to the chosen super agent—preventing unassigned agents from appearing in the multi-select.

# [0.0.44] FE WEB CEKAT 2025-11-19
### Changelog Experience Revamp
- **Interactive Release Browser**: Introduced a dynamic changelog page with searchable release list, color-coded highlights, and accordion sections for each area of work.
- **Dual View Modes**: Added interactive and classic tabs so readers can switch between the immersive UI and the original Markdown in one place.
- **Automatic Highlight Extraction**: Generate summary badges from markdown bullet points to surface the most important updates per release.
- **Styling Updates**: Applied gradient backgrounds, elevated cards, and refined typography for a colorful, engaging presentation.
- **Comprehensive Documentation**: Added `DOCUMENTATION.md` detailing auth flows, feature modules, Supabase schema, and operational processes.

# [0.0.43] FE WEB CEKAT 2025-11-18
### AI Pause Notification System
- **New AI Paused Modal Component**: Created dedicated modal for org-wide AI pause notifications
  - Modal displays when AI responses are paused across all channels
  - Shows who paused AI and when (for master agents)
  - Different messaging for master agents vs regular agents
  - Master agents can directly navigate to Admin Panel from modal
  - Modal appears once per browser session (acknowledgment stored in localStorage)
  - Integrated into main Index page with automatic status checking

- **Org-Wide AI Pause Status Monitoring**: Enhanced AI pause state management
  - Automatic fetching of org-wide AI pause status on app load
  - Resolves paused-by user name from profile or email
  - Modal auto-dismisses when AI pause is lifted
  - Session-based acknowledgment prevents modal spam

### Conversation Page UI Improvements
- **Fixed Tab Color Styling**: Resolved issue where selected tab colors were not displaying
  - Restructured Tooltip/TabsTrigger relationship (Tooltip now inside TabsTrigger)
  - Assigned tab: Blue background and text when active
  - Unassigned tab: Red background and text when active
  - Resolved tab: Green background and text when active
  - Proper `data-[state=active]` attribute application from Radix UI

- **Improved Conversation Sorting**: Enhanced conversation list sorting logic
  - Removed unreplied priority sorting (now purely by latest activity)
  - Conversations sorted by `last_msg_at` timestamp (most recent first)
  - Fallback to `created_at` if `last_msg_at` unavailable
  - More intuitive ordering based on actual activity

- **Enhanced Timestamp Display**: Improved date/time formatting in conversation list
  - Added "Yesterday" display for messages from previous day
  - Changed date format from `dd/MM/yy` to `MM/dd/yyyy` for better clarity
  - Better hour-based calculations for relative time display
  - More accurate time representation

- **TypeScript Fixes**: Resolved type errors
  - Removed reference to non-existent `updated_at` field on `ConversationWithDetails`
  - Fixed sorting logic to use only available timestamp fields

### Code Quality Improvements
- **Conversation Hooks Cleanup**: Minor refactoring in `useConversations` hook
  - Code cleanup and optimization
  - Improved type safety

# [0.0.42] FE WEB CEKAT 2025-11-03
### Admin Panel & Centralized Management
- **New Admin Panel Component**: Created centralized admin control center for master agents
  - New dedicated Admin Panel page accessible via navigation (master agents only)
  - Moved data retention and GDPR controls from Analytics to Admin Panel for better organization
  - Added quick access links to all admin sections (Permissions, Human Agents, Platforms, Analytics, Logs, Contacts)
  - Integrated Circuit Breaker Status monitoring directly in admin panel
  - Added cache clearing utility for local storage cleanup
  - Bulk contact deletion interface with UUID parsing (comma/newline separated)
  - Enhanced data retention controls with manual cleanup trigger
  - GDPR/PDPA deletion interface with confirmation modals
  - All admin features consolidated in single, role-gated interface

### Webhook Infrastructure Refactoring
- **Centralized Webhook Client**: Created new `webhookClient.ts` for unified webhook handling
  - Automatic authentication for proxy endpoints using Supabase session tokens
  - Support for both legacy and proxy-based endpoints
  - Automatic API key injection for proxy requests
  - Consistent error handling across all webhook calls
  - `callWebhook()` function replaces direct `fetch()` calls throughout application

- **Proxy-Aware Webhook Configuration**: Major refactoring of webhook routing system
  - Introduced `route:` prefix system for proxy-based endpoints
  - Automatic routing to Supabase Edge Function proxy (`proxy-n8n`) for prefixed endpoints
  - Legacy endpoint support maintained for backward compatibility
  - Provider-specific endpoint resolution (`resolveSendMessageEndpoint()`)
  - Enhanced provider normalization (wa/whatsapp_cloud → whatsapp, tg/tele → telegram)
  - All platform forms (WhatsApp, Telegram) now use centralized webhook client
  - Live Chat component updated to use new webhook client

### AI Agent Enhancements
- **AI Model Selection System**: Comprehensive model management in AI Agent creation and settings
  - Model selection dropdown in AI Agent creation dialog with pricing and provider information
  - Fallback model selection for automatic failover when primary model unavailable
  - Model-specific context window and history limit validation
  - Dynamic limit calculation based on selected model capabilities
  - Enhanced model display with cost per 1M tokens, provider badges, and descriptions
  - Model filtering (regular vs fallback models) for better UX
  - Auto-selection of first available model on load

- **AI Agent Settings UI Improvements**: Enhanced settings interface with better input handling
  - Replaced numeric inputs with text inputs using `inputMode="numeric"` for better mobile support
  - Added input validation with clamping to model-specific maximums
  - Context window input now in "K tokens" format with model-specific limits
  - History limit shows model-specific maximums with helpful descriptions
  - Auto-resolve timeout input with proper validation (0-1440 minutes)
  - Message cap input with placeholder examples
  - Removed "AI Read File Limit" field (commented out, not in use)
  - Better label clarity: "Enable auto-resolve", "Auto-resolve timeout", "Conversation History (tokens)", "Context Window (K tokens)", "Creativity Preset", "AI Message Cap"
  - Model selection card with primary and fallback model sections
  - Real-time display of model capabilities and limits

- **AI Agent Creation Flow**: Enhanced creation process
  - Model selection required before agent creation
  - Fallback model optional selection during creation
  - Better validation and error messages
  - Improved dialog with cancel button and loading states

### Analytics Component Cleanup
- **Removed Admin Controls**: Moved data retention and GDPR controls to Admin Panel
  - Removed data retention policy card from Analytics Conversation tab
  - Removed GDPR deletion card from Analytics
  - Removed Circuit Breaker Status from Analytics (now in Admin Panel)
  - Simplified Analytics component focusing on analytics and reporting only
  - Better separation of concerns between analytics and administration

### Database & Permissions
- **New Migration**: Added `users_profile.create` permission
  - Created migration `20251103_add_users_profile_create_permission.sql`
  - Grants `users_profile.create` permission to `master_agent` and `super_agent` roles
  - Enables proper RBAC for user profile creation operations

### Enhanced Caching & Performance
- **Query Signature-Based Caching**: Improved cache key generation in `supabaseProtected.ts`
  - Added query signature serialization for more accurate cache keys
  - Cache keys now include query method signatures and arguments
  - Prevents cache collisions between similar but different queries
  - Better cache invalidation with pattern matching
  - Enhanced cache hit rates with more granular key generation

- **Cache Invalidation Improvements**: Better cache management
  - Contact deletion now invalidates related query caches
  - Thread deletion invalidates conversation caches
  - Pattern-based cache invalidation using `defaultFallbackHandler.invalidatePattern()`

### Conversation & Contact Management
- **Enhanced Conversation Hooks**: Improved conversation management
  - Added `deleteThread()` function to `useConversations` hook
  - Provider-aware message sending using `resolveSendMessageEndpoint()`
  - Better provider detection from conversation data
  - Cache invalidation on thread deletion

- **Contact Management**: Improved deletion handling
  - Enhanced bulk deletion with cache invalidation
  - Better error handling in contact operations
  - Improved cache management for contact queries

### Platform Integration Updates
- **WhatsApp Platform**: Updated to use new webhook client
  - Session creation, login QR, logout, disconnect, and delete operations use `callWebhook()`
  - Consistent error handling across all WhatsApp operations

- **Telegram Platform**: Updated to use new webhook client
  - Platform creation and webhook deletion use centralized webhook client
  - Better error handling and response parsing

- **Connected Platforms**: Enhanced platform management
  - All webhook calls migrated to `callWebhook()` function
  - Better error handling and user feedback
  - Consistent authentication across all platform operations

### Navigation & Routing
- **New Admin Panel Route**: Added admin panel to navigation
  - New "Admin Panel" navigation item (master agents only)
  - Requires `access_rules.configure` permission
  - Added to navigation config and routing
  - Default navigation fallback improved to handle permission-based routing

### UI/UX Improvements
- **Human Agents**: Enhanced creation dialog
  - Better validation and error messages
  - Cancel button in creation dialog
  - Improved loading states
  - Permission-based UI (disabled buttons with tooltips when permission missing)

- **Input Improvements**: Better form inputs throughout application
  - Numeric inputs use `inputMode="numeric"` for mobile keyboards
  - Better placeholder text and validation messages
  - Improved accessibility with proper input types

### Technical Improvements
- **Code Organization**: Better separation of concerns
  - Admin functionality centralized in Admin Panel component
  - Webhook logic centralized in webhook client
  - Better component structure and maintainability

- **Type Safety**: Enhanced TypeScript types
  - Added `model_id` to AIProfile interface
  - Better type definitions for webhook responses
  - Improved type safety in platform forms

- **Error Handling**: Consistent error handling
  - Unified error handling in webhook client
  - Better error messages throughout application
  - Improved user feedback with toast notifications

# [0.0.41] FE WEB CEKAT 2025-11-01
### Data Retention & GDPR Compliance
- **Data Retention Policy System**: Implemented configurable data retention with automatic cleanup
  - Added 90-day default retention policy (adjustable from 1-365 days) stored in `org_settings` table
  - Created `cleanup_old_chat_data()` PostgreSQL function for automatic deletion of old chat data
  - Scheduled daily cleanup job at 2 AM UTC via `pg_cron` extension
  - Respects organization-specific retention periods stored in `org_settings.retention_days`
  - Only deletes data older than retention period (rolling window, not everything daily)
  - Deletes old threads, messages, and orphaned contacts based on `created_at` timestamps
  - Supports both org-specific cleanup and global cleanup for all organizations

- **GDPR/PDPA Right to Erasure**: Implemented compliant user data deletion functionality
  - Created `gdpr_delete_user_data()` PostgreSQL function for permanent deletion of user data
  - Deletes all threads, messages, and contact records for a specific contact UUID
  - Validates contact belongs to requesting organization before deletion
  - Returns detailed deletion results (threads, messages, contacts deleted count)
  - Permanently removes all user-associated data in compliance with GDPR/PDPA regulations
  - Action cannot be undone with clear warning messages in UI

- **Admin Controls in Analytics**: Added data retention and GDPR controls in Conversation tab
  - Data Retention Policy card with current retention period display and edit functionality
  - Manual "Run Cleanup Now" button for immediate cleanup execution
  - GDPR/PDPA deletion card with contact UUID input field
  - Restricted to users with `access_rules.configure` permission (master/super agents only)
  - Real-time success/error message display for all operations
  - Last cleanup results display showing threads, messages, and contacts deleted counts

- **Database Migration**: Applied comprehensive migration for data retention features
  - Migration `20250102_data_retention_and_gdpr.sql` successfully applied via Supabase MCP
  - Created `cleanup_old_chat_data()` and `gdpr_delete_user_data()` functions with proper security
  - Added RLS policies for `org_settings` table updates restricted to master/super agents
  - Initialized default 90-day retention for all existing organizations
  - Ensured `is_current_user_active()` dependency function exists for RLS checks

### Contact Management Enhancements
- **Contact UUID Detail Modal**: Added master agent-only contact UUID display
  - New UUID section in contact details modal visible only to master agents
  - Displays contact UUID with copy-to-clipboard functionality
  - Includes helpful description for GDPR deletion requests and system integrations
  - Uses RBAC role check (`hasRole('master_agent')`) to restrict visibility
  - Styled with monospace font and muted background for clear readability
  - Badge indicator showing "Master Agent Only" restriction

### Technical Improvements
- **Supabase Integration**: Full integration with Supabase database functions
  - `fetchRetentionSettings()` reads from `org_settings` table via protected Supabase client
  - `saveRetentionDays()` updates retention period using upsert operation
  - `triggerCleanup()` calls `cleanup_old_chat_data` RPC function
  - `executeGdprDeletion()` calls `gdpr_delete_user_data` RPC function
  - All operations use `protectedSupabase` client respecting circuit breaker and RLS
  - Proper error handling and user feedback for all database operations

- **RBAC Integration**: Enhanced role-based access control for admin features
  - Permission gates around data retention and GDPR controls
  - Master agent role check for contact UUID visibility
  - Secure access control using `useRBAC` context hooks

### UI/UX Enhancements
- **Data Retention UI**: Comprehensive admin interface for retention management
  - Edit modal for configuring retention period (1-365 days range)
  - Visual display of current retention period with clear descriptions
  - Warning messages explaining automatic cleanup schedule
  - Success/error message toasts for user feedback

- **GDPR Deletion UI**: Secure and user-friendly deletion interface
  - Two-step confirmation process with warning modal
  - Clear indication of what will be deleted (threads, messages, contacts)
  - Contact UUID input with validation
  - Destructive button styling to indicate permanent action

### Security & Compliance
- **Data Protection**: Enhanced data protection mechanisms
  - Row Level Security (RLS) policies enforce master/super agent access only
  - Automatic cleanup respects retention periods to prevent accidental data loss
  - GDPR deletion function validates organization membership before deletion
  - All database operations use security definer functions with proper permissions

# [0.0.40] FE WEB CEKAT 2025-11-01
### Adaptive Rate Limiter Integration & DDoS Protection
- **Adaptive Rate Limiter Full Integration**: Integrated adaptive rate limiter into Supabase protection system
  - Enhanced AdaptiveRateLimiter class with getConfig() and updateConfig() methods for runtime configuration
  - Added localStorage persistence for adaptive rate limiter configuration and multipliers
  - Integrated adaptive rate limiter into supabaseProtected.ts, replacing static rate limiter for all operations
  - Implemented automatic limit adjustment based on system health metrics (response time, error rate)
  - Added query to circuit_breaker_metrics table in Supabase for real-time metrics analysis
  - Automatic adjustment loop runs every adjustment interval to update limits dynamically

- **Adaptive Rate Limiter Configuration UI**: Added comprehensive configuration interface
  - Created new "Adaptive Rate Limiter Configuration" section in Limit Configuration
  - Display base limits for all 4 operations (Reads, Writes, RPC, Auth) with current effective limits
  - Real-time display of multipliers (percentage) for each operation type
  - Show min/max multiplier, adjustment interval, and latency thresholds
  - Added "Edit" button with comprehensive modal for editing all adaptive rate limiter parameters
  - Visual status indicator showing adaptive rate limiter is active and protecting database
  - All configuration values are editable with proper validation and range limits

- **Enhanced Rate Limiter Card**: Updated to show adaptive limits
  - Changed card title to "Rate Limiter (Adaptive)" to reflect dynamic nature
  - Display effective limits (dynamically calculated) instead of static limits
  - Show multiplier percentage for each operation type
  - Real-time updates every second to reflect current adaptive limits
  - Informative tooltips explaining how adaptive limits work for traffic spike protection

- **Comprehensive Circuit Breaker Documentation Updates**: Enhanced documentation with detailed input explanations
  - Added detailed explanation section for all Circuit Breaker inputs (5 parameters)
    - Failure Threshold: When circuit opens, tips, recommendations
    - Reset Timeout: Recovery time, tips for different scenarios
    - Success Threshold: Recovery validation, recommendations
    - Monitoring Period: Sliding window explanation, impact on detection
    - Request Timeout: Timeout handling, recommendations per operation type
  - Added comprehensive explanation for all Adaptive Rate Limiter inputs (7+ parameters)
    - Base Limits: Explanation for Reads/Writes/RPC/Auth with recommendations
    - Min/Max Multiplier: How multipliers affect limits, examples with calculations
    - Latency Thresholds: Healthy vs Stress thresholds, tips for optimization
    - Adjustment Interval: How often limits adjust, recommendations for different scenarios
  - Added "How They Work Together" sections showing complete workflow for both systems

- **DDoS & Traffic Spike Protection Guide**: Added dedicated protection guide
  - Created comprehensive guide section explaining inputs specifically for DDoS protection
  - Ranked inputs by importance: Min Multiplier (most important), Stress Threshold, Base Limits, etc.
  - Detailed recommendations for each input with effectiveness ratings
  - Provided optimal configuration preset for maximum DDoS protection
  - Explained complete attack scenario flow (5-step process)
  - Visual color-coded sections for easy reference (red borders for critical inputs)

- **Documentation Improvements**: Enhanced existing documentation sections
  - Updated "Best Practices" section to include adaptive rate limiter tips
  - Enhanced "Configuration Reference" to show both Circuit Breaker and Adaptive Rate Limiter configs
  - Added effective limits display with multiplier percentages in configuration reference
  - Updated troubleshooting section to mention adaptive rate limiter as protection layer
  - All documentation now uses dynamic values from current configuration (real-time)

### Technical Improvements
- **Type System Enhancements**: Improved TypeScript type exports
  - Re-exported OperationType from adaptiveRateLimiter for better type consistency
  - Fixed import issues in CircuitBreakerStatus component
  - All types properly exported and available for external use

- **Storage Management**: Enhanced persistence system
  - Adaptive rate limiter config persists to localStorage with multipliers
  - Automatic loading of saved configuration on initialization
  - Interval ID management for proper cleanup when adjustment interval changes
  - Backward compatible with existing localStorage data

### UI/UX Enhancements
- **Configuration Visualization**: Better display of adaptive limits
  - Show both base limit and effective limit side-by-side
  - Multiplier percentage displayed with color coding (green for healthy)
  - Real-time status indicators showing system is actively protecting
  - Clear distinction between static base limits and dynamic effective limits

- **Documentation UX**: Improved documentation readability
  - Color-coded input explanations (red, orange, yellow, blue, purple borders)
  - Step-by-step workflows with numbered lists
  - Practical examples using actual configuration values
  - Tips and recommendations clearly separated from explanations
  - Warning boxes for critical information

### Performance & Security
- **DDoS Protection**: Multi-layered defense system
  - Adaptive rate limiter as first line of defense (reduces limits automatically)
  - Request timeout as second layer (cancels slow requests)
  - Circuit breaker as last resort (blocks all requests if needed)
  - Complete protection against traffic spikes and DDoS attacks

- **Smart Limit Adjustment**: Intelligent limit management
  - Limits increase when system is healthy (up to 200% of base)
  - Limits decrease when system is stressed (down to 50% of base by default)
  - Gradual adjustment prevents sudden changes (max 10% increase, 20% decrease per cycle)
  - Automatic return to normal limits when system recovers

# [0.0.39] FE WEB CEKAT 2025-11-01
### Circuit Breaker Enhancements & Documentation
- **Circuit Breaker Configuration Management**: Added comprehensive limit configuration interface for admins
  - Created "Limit Configuration" section displaying all circuit breaker thresholds (disabled by default)
  - Added "Edit" button to open configuration modal for modifying limits
  - Implemented getConfig() and updateConfig() methods in CircuitBreaker class
  - Added configuration persistence to localStorage for client-side recovery
  - Configuration values are now dynamically displayed and editable
  - Each configuration field includes descriptive tooltips explaining the purpose

- **Circuit Breaker Documentation System**: Implemented comprehensive documentation modal
  - Added documentation card section above "Danger Zone" with "Lihat Dokumentasi Circuit Breaker" button
  - Created detailed documentation modal covering:
    - What is Circuit Breaker and its purpose
    - How Circuit Breaker works (three states: CLOSED, OPEN, HALF_OPEN)
    - Step-by-step workflow with dynamic configuration values
    - What to do when circuit breaker opens (troubleshooting guide)
    - Understanding metrics and their meanings
    - Best practices for monitoring and optimization
    - Configuration reference with current values
  - All documentation content in Indonesian language with clear formatting
  - Modal is scrollable and responsive for better readability

- **Enhanced UI/UX for Circuit Breaker Analytics**: Improved user experience and safety
  - Added question mark icons (HelpCircle) beside all labels in "Limit Configuration" section
  - Each icon displays informative tooltip on hover with Indonesian descriptions
  - Reorganized admin controls into two distinct sections:
    - "Limit Configuration": For viewing and editing circuit breaker thresholds
    - "Danger Zone": For critical admin actions with enhanced warnings
  - Added tooltips to all buttons in "Danger Zone" explaining their effects
  - Enhanced visual hierarchy with color-coded sections (blue for docs, red for danger)
  - All tooltips and descriptions use dynamic values from current configuration

- **Circuit Breaker Class Improvements**: Enhanced circuit breaker functionality
  - Added getConfig() method to retrieve current configuration
  - Added updateConfig() method to modify configuration at runtime
  - Configuration is automatically saved to localStorage on update
  - Configuration is automatically loaded from localStorage on initialization
  - Maintains backward compatibility with existing circuit breaker state

### AI Agent Settings Cleanup
- **Removed Timezone Field**: Cleaned up unused timezone configuration
  - Removed timezone field from AI Agent Settings UI component
  - Dropped timezone column from ai_profiles table via database migration
  - Removed timezone state variables and related logic from frontend
  - Updated TypeScript types to remove timezone references
  - Note: timezone field in users_profile table remains unchanged (separate feature)

### Technical Improvements
- **Code Organization**: Better separation of concerns in Circuit Breaker Status component
  - Split admin controls into logical sections (Documentation, Limit Configuration, Danger Zone)
  - Improved component structure for better maintainability
  - Enhanced modal management with dedicated state variables
  - Better error handling and user feedback

### UI/UX Enhancements
- **Documentation Integration**: Added comprehensive help system
  - Documentation card with prominent call-to-action button
  - Modal-based documentation with scrollable content
  - Color-coded sections for better visual hierarchy
  - Responsive design for all screen sizes
  - Dark mode support throughout documentation modal

- **Enhanced Tooltips**: Improved user guidance
  - Question mark icons next to all configuration labels
  - Contextual tooltips explaining each configuration parameter
  - Tooltips on danger zone buttons with detailed warnings
  - All tooltips in Indonesian language for consistency


# [0.0.38] FE WEB CEKAT 2025-10-30
### Refactor Authentication & RBAC
- Removed unnecessary debug logging from authentication and RBAC components.
- Enhanced role checks within navigation for more secure access control.
- Improved account status handling to better manage user states.
- Added role-based restrictions directly in navigation configuration.
- Updated related components for improved clarity and performance.

# [0.0.37] FE WEB CEKAT 2025-10-30
### Circuit Breaker & Database Protection System
- **Comprehensive Circuit Breaker Implementation**: Implemented full-featured circuit breaker system for database protection
  - Created core CircuitBreaker class with state machine (CLOSED, OPEN, HALF_OPEN) and configurable thresholds
  - Added state persistence using localStorage for client-side recovery across page refreshes
  - Implemented event emitter pattern for real-time monitoring and state change notifications
  - Added time-windowed failure counting (10s monitoring period) with automatic state transitions

- **Rate Limiting & Request Management**: Implemented advanced rate limiting and request optimization
  - Created sliding window rate limiter with per-user and per-endpoint tracking
  - Implemented request queue with deduplication, priority handling, and debouncing
  - Added request batching for similar queries to reduce total request count
  - Created adaptive rate limiter that adjusts limits based on system health metrics

- **Enhanced Error Handling & Caching**: Implemented comprehensive error management and response caching
  - Created error classifier utility mapping Supabase error codes to categories (network, database, auth, rate limit, timeout)
  - Implemented retry logic with exponential backoff (1s, 2s, 4s, 8s max) and error-specific strategies
  - Added response caching with IndexedDB/localStorage using stale-while-revalidate pattern
  - Implemented offline mode support with write operation queuing and sync on connection restore

- **Database Analytics & Monitoring**: Added comprehensive database performance monitoring
  - Created new "Database" tab in Analytics section with detailed database statistics
  - Implemented PostgreSQL functions for database metrics (table sizes, row counts, index performance, memory stats)
  - Added real-time database activity monitoring with KPI cards and interactive charts
  - Created comprehensive table statistics view with scan ratios, vacuum timestamps, and DML operations

- **Circuit Breaker Analytics Dashboard**: Integrated circuit breaker monitoring into Analytics section
  - Added new "Circuit Breaker" tab displaying real-time status and metrics
  - Created CircuitBreakerStatus component with admin controls and visual indicators
  - Implemented metrics collection and storage in circuit_breaker_metrics table
  - Added comprehensive help tooltips with Indonesian descriptions for all labels

- **Protected Supabase Integration**: Wrapped all database operations with circuit breaker protection
  - Created protectedSupabase wrapper replacing direct Supabase calls in critical components
  - Integrated circuit breaker, rate limiting, caching, and metrics collection
  - Updated Analytics, ConversationPage, and useConversations hooks to use protected wrapper
  - Implemented graceful degradation and fallback mechanisms for failed operations

- **Admin Controls & Safety Features**: Added comprehensive admin controls with safety measures
  - Implemented custom modal dialogs replacing browser confirm/alert dialogs
  - Added confirmation popups with detailed Indonesian warnings for all admin actions
  - Created color-coded modal themes (orange for reset, red for critical actions, blue for info)
  - Added success/error feedback modals with proper error handling

### Technical Improvements
- **Performance Optimizations**: Resolved application freezing and lag issues
  - Fixed infinite loop in background cache refresh mechanism
  - Optimized metrics collection with batching and throttling (50 batch size, 30s interval)
  - Implemented caching for getUserId calls with 1-minute TTL and 500ms timeout
  - Added cooldown periods to prevent refresh storms (30s for queries, 60s for RPCs)
  - Made rate limiting more lenient for read operations to prevent blocking

- **Database Schema Updates**: Enhanced database with circuit breaker metrics
  - Created circuit_breaker_metrics table with comprehensive operation tracking
  - Added RLS policies and indexes for efficient metrics querying
  - Implemented 30-day retention policy with cleanup_old_metrics function
  - Added database analytics functions for comprehensive performance monitoring

### UI/UX Enhancements
- **Modal System**: Replaced browser dialogs with custom modal components
  - Created consistent modal design matching application theme
  - Added proper dark mode support and responsive design
  - Implemented clear visual hierarchy with icons and color coding
  - Added comprehensive warning messages in Indonesian language

- **Help System**: Enhanced user guidance throughout the application
  - Added question mark icons with tooltips to all analytics labels
  - Implemented LabelWithHelp component for consistent help integration
  - Created comprehensive Indonesian descriptions for all circuit breaker features
  - Added contextual help for admin controls and safety warnings


# [0.0.36] FE WEB CEKAT 2025-10-25
### Security & Authentication
- **Account Deactivation System**: Implemented comprehensive account deactivation blocking system
  - Added database-level RLS policies to prevent deactivated users from accessing system resources
  - Created dedicated `/account-deactivated` warning page with Indonesian content
  - Implemented pre-login account status validation to prevent deactivated users from authenticating
  - Added automatic redirect to warning page when deactivated account is detected
  - Enhanced security with "fail closed" approach - blocks access if account status cannot be verified

### User Experience Improvements
- **Enhanced Navigation**: Fixed navigation issues and improved user flow
  - Replaced modal-based account deactivation with dedicated warning page
  - Added "Kembali ke Halaman Login" button with complete cleanup functionality
  - Implemented localStorage clearing and user signout on account deactivation
  - Fixed infinite loading issues caused by component conflicts
  - Added loading states and prevented multiple button clicks during navigation

### Technical Improvements
- **Component Architecture**: Streamlined authentication flow components
  - Removed deprecated `AccountDeactivatedModal` component
  - Created dedicated `AccountDeactivated` page component with proper routing
  - Fixed Router context issues by restructuring component hierarchy in App.tsx
  - Enhanced error handling and timeout management for signOut operations
  - Added comprehensive debugging and logging for authentication flow

### Database & Security
- **Row Level Security (RLS)**: Enhanced database security policies
  - Updated RLS policies to include active user checks for all major tables
  - Created `is_current_user_active()` helper function for consistent security checks
  - Applied security policies to `users_profile`, `org_members`, `channels`, `contacts`, `threads`, and `messages` tables
  - Implemented strict access control preventing deactivated users from reading sensitive data

### Bug Fixes
- **Authentication Flow**: Resolved multiple authentication-related issues
  - Fixed flicker when logging in with deactivated accounts
  - Resolved race conditions in account status checking
  - Fixed logout button functionality by preventing account deactivation interference
  - Corrected database column name from `is_f2a_email_enabled` to `is_2fa_email_enabled`
  - Fixed CORS errors with edge function approach by implementing direct database validation

### UI/UX Enhancements
- **Account Deactivation Warning Page**: Created comprehensive user feedback system
  - Added clear Indonesian messaging explaining account deactivation
  - Implemented contact instructions for Master Agent reactivation
  - Added visual warning indicators with appropriate icons and styling
  - Created responsive design with proper loading states and button interactions

# [0.0.35] FE WEB CEKAT 2025-16-09
### Updates
- Added HCaptcha site key to .env for CAPTCHA validation.
- Enhanced Login component to include CAPTCHA verification.
- Improved ConversationPage to display channel logos.
- Updated HumanAgents component for better pagination and agent management.
- Adjusted useConversations and useHumanAgents hooks to support new fields for channel logos and agent organization.
- Implemented strict checks for super agent assignments in usePlatforms hook.

# [0.0.34] FE WEB CEKAT 2025-11-09
### Updates
### AIAgentSettings
* Added new state variables:
  * `historyLimit`
  * `readFileLimit`
  * `contextLimit`
  * `responseTemperature`
  * `messageAwait`
  * `messageLimit`
  * `timezone`
* Improved overall usage tracking and configurability.

### HumanAgent
* Introduced **usage range option** for better monitoring.
* Refactored **agent visibility logic** for clearer access control.
* Enhanced handling of **agent roles and statuses** for more robust management.

# [0.0.33] FE WEB CEKAT 2025-10-09
### Updates
- Update project branding, enhance chat functionality, and improve permissions management
- Added aria-labels for accessibility in chat components
- Refined URL state synchronization in ConversationPage
- Implemented sorting and editing features in Contacts
- Removed legacy policy editing from PermissionsPage
- Updated navigation permissions for better clarity

# [0.0.32] FE WEB CEKAT 2025-10-04
### Updates
- Fixed Live chat error and detail chat
- Update project branding to **Synka AI**
- Enhance **chat functionality**
- Improve **permissions management**
- Key changes include:
  - Renaming titles and meta descriptions
  - Adding a direct route to the chat inbox
  - Updating permission checks
  - Refining UI elements for better user experience

Updating permission checks

Refining UI elements for better user experience
# [0.0.31] FE WEB CEKAT 2025-10-04
### Updates
- Introduced a new endpoint `CHAT_TEST` for testing AI agent chat settings.
- Updated `AIAgentSettings` component to include profile handling and improved UI with collapsible sections for behavior, welcome message, and transfer conditions.
- Enhanced `ChatPreview` to support profile ID and adjusted styling for better user experience.
- Refactored platform forms to remove profile photo upload functionality.

# [0.0.30] FE WEB CEKAT 2025-10-04
### Updates
- Fix invite

# [0.0.29] FE WEB CEKAT 2025-10-04
Commit: Invite flow fixes, required field validation, form improvements
### Updates
- Invite Flow Fixes
  - Fixed invite flow to redirect users directly to password creation page instead of 2FA page
  - Added invite flow detection to skip 2FA requirements for invited users
  - Prevented duplicate 2FA emails for invited users
  - Added `/invite` route for proper invite handling
  - Enhanced ProtectedRoute to detect and redirect invite flows appropriately
- Form Validation Improvements
  - Made "Attach to Super Agent" field required for regular agents
  - Added visual indicators (red asterisks) for all required fields
  - Implemented real-time form validation with disabled submit button
  - Added contextual help text explaining field requirements
  - Enhanced error messages with specific validation feedback
- User Experience Enhancements
  - Submit button now disabled until all required fields are filled
  - Clear visual hierarchy distinguishing required vs optional fields
  - Real-time validation feedback as users type/select
  - Improved form accessibility with proper labeling
- Bug Fixes
  - Fixed invite users being incorrectly redirected to 2FA page
  - Resolved duplicate 2FA email sending for invited users
  - Corrected form submission logic for agent creation
  - Enhanced error handling for missing required fields

# [0.0.28] FE WEB CEKAT 2025-10-04
Commit: Auto-resolve functionality, thread timestamp fixes, audio notifications, UI improvements
### Updates
- Auto-Resolve System
  - Fixed auto-resolve functionality to work correctly with AI agents
  - Database triggers now properly set `auto_resolve_at` timestamp when AI responds
  - Auto-resolve function uses correct enum value `'closed'` instead of `'resolved'`
  - Periodic checking every 30 seconds for threads ready to auto-resolve
  - Real-time auto-resolve checks on message events
  - Threads auto-resolve after specified minutes of inactivity without user response
- Thread List Improvements
  - Fixed thread list to show latest message timestamp instead of first message timestamp
  - WhatsApp-style conversation sorting with unreplied threads at top
  - Real-time conversation preview updates without full list refresh
- Audio Notifications
  - Added audio notification system for new messages in opened threads
  - Two notification sounds: incoming (`mixkit-message-pop-alert-2354.mp3`) and outgoing (`mixkit-long-pop-2358.wav`)
  - Debounced notifications to prevent duplicate sounds
  - Tab visibility checks to only play sounds when tab is active
  - User controls: enable/disable audio notifications, test notification
- UI Improvements
  - Removed clock icon from chat message bubbles for cleaner appearance
  - Enhanced message streaming with better real-time updates
  - Improved conversation list performance with optimized refresh logic
- Database Schema Updates
  - Added `channel_id` to `token_usage_logs` table for better analytics
  - Added `super_agent_id` to `channels` table (moved from `ai_profiles`)
  - Updated RLS policies to use `channels.super_agent_id` for proper clustering
  - Fixed foreign key constraints and relationships
- Bug Fixes
  - Fixed page reload issues when alt+tabbing between browser tabs
  - Resolved conversation data leakage between different super agents
  - Fixed AI Agent dropdown filtering logic
  - Corrected thread timestamp display in conversation list

# [0.0.27] FE WEB CEKAT 2025-10-03
- Enabling AI Profiles fetch instead of using cache 

# [0.0.26] FE WEB CEKAT 2025-10-03
Commit: Live Chat realtime + anon policies, auto-resolve with enable flag, reopen on user reply, UI polish
### Updates
- Live Chat (Embed)
  - Messages now stream from Supabase realtime (`public.messages`); webhook response is ignored for content.
  - Sends `channel_id`, `session_id`, and a persistent friendly `username` (stored per host in localStorage). Removed `platform_id` from payload.
  - Ringtones wired to `public/tones` assets; low = `mixkit-message-pop-alert-2354.mp3`, high = `mixkit-long-pop-2358.wav`.
  - Thread lookup uses `contacts(name)` with `maybeSingle()` (fixes PGRST116 when 0 rows).
- Database (Supabase)
  - Added anon SELECT RLS for web embed:
    - `channels`: `allow_public_select_web_channels` (provider='web' and active only).
    - `threads`: `public_read_web_threads` (via web channels).
    - `messages`: `public_read_web_messages` (via web channels).
    - Fixes 401/42501 when opening standalone live chat.
  - Auto-resolve framework:
    - `ai_profiles.auto_resolve_after_minutes` (int) and `enable_resolve` (bool).
    - `threads.auto_resolve_at` scheduled by trigger `set_thread_auto_resolve_after_message` on agent/assistant replies; cleared on user replies.
    - Function `auto_close_due_threads()` (cron-friendly) and helper `schedule_auto_resolve_for_open_threads()` for backfill.
  - Auto-reopen: trigger `reopen_thread_on_user_message` reopens closed threads and unassigns when a new user message arrives.
- AI Agent Settings
  - “Enable Auto-resolve” switch added; “Auto-resolve after (minutes)” is disabled when switch is off.
  - Removed sending `system_prompt` to webhook; UI still saves prompt to profile.
- Conversations UI
  - “Unreplied” badge restyled (soft red background, darker red text) to match “Assigned” styling.

# [0.0.25] FE WEB CEKAT 2025-10-02
Commit: Human vs AI handover analytics, WAHA sessions fetch, realtime chats, Platforms loop fix, UI polish
### Updates
- Analytics (Human Agent)
  - Handover rate redefined as Human/(Human+AI) across all conversations (not only resolved).
  - Added breakdowns: by Super Agent and by Agent, with Super Agent filter.
- Database (Supabase)
  - New/updated RPCs: `get_handover_by_super_agent`, `get_handover_by_agent`, `get_agent_kpis`.
  - Enabled realtime by adding `public.threads` and `public.messages` to `supabase_realtime`.
- Platforms (WhatsApp)
  - Fetch sessions from WAHA (`/api/sessions` and `/api/sessions/{name}`); removed dependency on webhook `/get_sessions` calls in UI.
  - Filter sessions to selected channel; debounced refresh; fixed infinite refresh loop on Platforms page.
  - QR polling uses WAHA session endpoint; Disconnect/Delete refresh safely.
- Conversations
  - Live-updating conversation list and counts via realtime subscriptions to `threads` and `messages` (debounced).
- UI
  - Delete Channel button shows spinner + “Deleting…” and subtle pulse while processing.
- Changelog
  - Source from root `CHANGELOG.md` only; removed `public/CHANGELOG.md`; scripts updated to skip copy.

# [0.0.24] FE WEB CEKAT 2025-09-30
### Updates
- Enhance message handling in ConversationPage and useConversations hooks.
- Optimistic UI updates for message status

# [0.0.23] FE WEB CEKAT 2025-10-02
### Updates
- Live Chat
  - New embedded-only chat page at `/livechat/:platform_id` with blue-white palette, gradient background, glassy card, and clearer borders.
  - Sound notifications: low note on send, high note on AI reply; ringtone-style sequences; support external audio and synthesized chimes.
  - Netlify SPA routing for `/livechat/*` via redirects in `netlify.toml` and `public/_redirects`.

- Connected Platforms
  - Live chat link and embed now use `https://synkaai.netlify.app/livechat/{platform_id}`.
  - Added Super Agent section (single-select; master-only). Human Agents now a searchable multi-select of regular agents only.
  - Removed “Teams” card. Agent chips show proper names and can be removed.

- Platform Forms (Web, WhatsApp, Telegram)
  - Enforce Super Agent selection; filter AI/Human Agents by the selected Super Agent.
  - Fixed Telegram `useEffect` import error; safer webhook response handling.
  - Only selected human agents are attached on create.

- Hooks and data
  - `usePlatforms`: join `channel_agents`; insert/remove on create/update; read/update `channels.credentials.super_agent_id`.
  - `useAIAgents`/`LiveChat`: dropped non-existent `model`; filter by `super_agent_id`.
  - `useHumanAgents`: include `super_agent_id` via `super_agent_members`.

- Human Agents page
  - Clustering UI to manage Super Agents → Agents & AI Agents; token totals by cluster.

- Database (Supabase)
  - New `super_agent_members` table (RLS) and `ai_profiles.super_agent_id` (NOT NULL).
  - Added `users_profile.used_tokens` plus `refresh_used_tokens_for_super_agents` function and trigger to aggregate token usage per super agent.
  - Deployed and backfilled via Supabase MCP; membership mappings added where needed.

- Fixes
  - Resolved SPA 404s for `/livechat/*`.
  - Fixed `users_profile.email` and `ai_profiles.model` 42703 errors.
  - Ensured agent removal updates `channel_agents` and access.

# [0.0.22] FE WEB CEKAT 2025-09-30
### Updates
- Fix platform creating for telegram
- Add saving functionality for selected AI agent in ConnectedPlatforms and prevent duplicate Telegram bot tokens in TelegramPlatform Form
- Enhance AI Agent Settings: Implement file upload functionality with Supabase integration, including upload progress tracking and error handling. Update UI to reflect file statuses and permissions. Add new knowledgebase endpoints for file management.
- Enhance file upload process in AIAgentSettings: pre-compute content hash for stable key, include additional metadata (storageName, storageSize, storageUpdatedAt) in upload response, and improve file validation checks.

# [0.0.21] FE WEB CEKAT 2025-09-30
### Updates
- Update CHANGELOG and enhance Analytics and HumanAgents components. 
- Added token usage tracking in Analytics with visualizations for daily usage and top models. 
- Improved token aggregation logic in HumanAgents to account for super-agent clusters.

# [0.0.20] FE WEB CEKAT 2025-09-30
### Updates
- Platform agent assignment
  - Persist selected agents on create to `channel_agents`; updates replace assignments.
  - Agents now only see platforms they’re assigned to; master/super see all.
  - Platforms list shows only attached human agents (no more org-wide members).

- Platform details UI
  - New Super Agent section: shows assigned super agent; single-select; editable by master agents only; stored in `channels.credentials.super_agent_id`.
  - Human Agent manager: chips with remove (X) + searchable multi-select to add; lists only regular agents (excludes super/master).
  - Removed unused “Teams” card; unified details behavior across providers.

- Telegram platform creation
  - Hits `POST /telegram/create-platform` (CREATE_PLATFORM) before channel insert.
  - Sends `brand_name, display_name, description, telegram_bot_token, ai_profile_id, human_agent_ids, org_id`.
  - Robust response handling for empty/non-JSON bodies; emits refresh after success.

- Data fetching and names
  - Human agent names prefer `users_profile.display_name` with fallback to `v_users.display_name`; email sourced from `v_users`.
  - Fixed error when `users_profile.email` was selected (column doesn’t exist).

- Components
  - Added `ui/multi-select` (popover + search + checkbox) for multi-add of agents.

- Fixes
  - Agent chips now display the correct agent name (not internal IDs).
  - Only the agents selected during platform creation are attached (no more “all agents” issue).
  - Resolved Telegram JSON parse errors and `42703 users_profile.email` error.

# [0.0.19] FE WEB CEKAT 2025-09-23
### Updates
- Automatically switch to the Resolved tab when only closed conversations are present
- Updated Resolved tab UI to display the count of closed conversations.

# [0.0.18] FE WEB CEKAT 2025-09-20
### Updates
- Added provider tabs (WhatsApp, Telegram, Live Chat) to filter the list; auto-select first item in active tab
- Replaced black status dot with green (active) / gray (inactive) indicator

# [0.0.17] FE WEB CEKAT 2025-09-20
### Updates
- Scope data fetching and realtime to visible pages and active routes (Conversations, Human Agents, Platforms, Contacts, AI Agents, RBAC, Analytics)
- Add tab-visibility guards to avoid background fetch on tab-restore; hydrate from cache first where applicable
- Standardize React Query defaults (staleTime=60s, gc=5m, disable refetch on focus/reconnect)
- Reduce audit log verbosity: ignore refresh/update events; add 3s debounce in `logAction`; include current route in log context
- Analytics
  - Default to last 30 days and align to full-day UTC boundaries
  - Prevent invalid date ranges (From ≤ To; To ≥ From) with input min/max and clamping
  - Fetch once per change; removed duplicate initial fetch
- UI consistency: set Telegram Platform create button to blue
- Utilities: add `isDocumentHidden` and `onDocumentVisible` helpers

# [0.0.16] FE WEB CEKAT 2025-09-19
### Updates
- Enhance real-time synchronization for conversations and messages; always fetch fresh data on mount

# [0.0.15] FE WEB CEKAT 2025-09-19
### Updates
- Auth/OTP: eliminate redirect flicker by gating on `otpEvaluated`; `ProtectedRoute` and `Otp` now wait for evaluation; `ResetPassword` handles magic-link `?code=` with `exchangeCodeForSession`.
- Changelog page: render Markdown (react-markdown + GFM), Tailwind Typography, compact heading sizes; added Netlify `public/_redirects`; added `prebuild`/`predev` to copy root `CHANGELOG.md` to `public/`.
- Build: remove top-level await in `main.tsx` (wrap in async IIFE).
- Analytics (global): add graceful fallback when `get_containment_and_handover` is missing; improved handover reason labels; added per-user analytics (Assigned To, Takeovers Initiated, Resolved By, AI→Agent Handovers).
- Human Agents:
  - Create Agent dialog with loader; 2FA enable checkbox on create; colored CTAs.
  - Add confirmation dialog with loader for deletion; wire hard delete.
  - Status changed to Active/Inactive; add `users_profile.is_active` column and update UI/actions.
  - Edit dialog shows “Require Email 2FA” switch and token limits; loads/saves `is_2fa_email_enabled`.
  - Role badges and submenu restyled (blue/green/gray).
- Edge Functions: `admin-create-user` (invite + profile + role, CORS) and `admin-delete-user` (hard delete auth user and related rows).
- Logging: `logAction` falls back to default org when `org_id` cannot be resolved (fixes audit log NOT NULL).
- UI theming: replaced remaining dark/black buttons with blue/green/red where appropriate.

# [0.0.14] FE WEB CEKAT 2025-09-19
### Updates
- Fix changelog is not accessible in staging

# [0.0.13] FE WEB CEKAT 2025-09-19
### Updates
- Implement OTP flow for login and enhance ProtectedRoute for OTP verification. 
- Added new Otp and Logout pages
- Updated AuthContext to manage OTP state 
- Modified Login component to handle OTP requirements.

# [0.0.12] FE WEB CEKAT 2025-09-18
### Updates
- Enhance authentication flow with local storage caching and session restoration
- Implemented local storage caching for AI agents and conversations to improve performance and reduce flicker on refresh.
- Added session restoration from local storage to ensure user authentication state is maintained across page reloads.
- Updated AuthContext to prioritize local storage for session data before reconciling with Supabase.
- Introduced a loading state management to handle UI updates more smoothly during data fetching.

# [0.0.11] FE WEB CEKAT 2025-09-17
### Updates
- Audit Logs self-read policy for non-master users.
- Added `get_audit_logs` RPC with server-side filters, paging, and master-only org-wide access.
- Analytics foundations: date-range controls and labeled charts; wired to secure RPCs.
- KPI RPCs: `get_chats_timeseries` and `get_response_time_stats` (avg/median/p90) with Asia/Jakarta bucketing.
- RBAC and conversation label changes now emit audit log entries.
- Analytics UI now uses new KPI RPCs with channel filter, time-series, and labeled bars.
- Containment/Handover groundwork: added `threads.resolution`, `end_reason`, `handover_reason`, AI auto-resolution trigger.
- Analytics RPCs: `get_containment` (with previous period) and `get_handover_stats` (reason breakdown).
- Server-side validation: handover reason now required when handover happens; added helpful indexes for analytics.
- Added `get_non_contained` RPC for drilldown of non-contained conversations.
- Containment/Handover dashboard cards with drilldown and reason pie chart.
- RBAC policy engine scaffold: `rbac_policies` table, RPCs (`get_role_policy`, `put_role_policy`, `apply_role_policy`), extended `has_perm` to honor policies.
- Role Policy editor UI (matrix) to manage per-resource actions; policy changes logged.
- Added docs/ANALYTICS_AND_LOGS.md covering RPCs, validation, and telemetry.
- Added PII sanitization tests for log CSV export.
- Added analytics time-series, containment, handover, and RBAC policy tests; basic E2E seed.
- TODO roadmap (server-validated) added for Analytics KPIs, Containment/Handover, RBAC policies, indexes, docs, and tests.
- implement OTP flow in login
- enhance ProtectedRoute for OTP verification

# [0.0.10] FE WEB CEKAT 2025-09-16
### Updates
- fix: remove duplicate import of useRBAC in ConversationPage component

# [0.0.9] FE WEB CEKAT 2025-09-16
### Updates
- Created loggings for every users, and only admin can access.
- Made Role Management for admins to setting the role.

# [0.0.8] FE WEB CEKAT 2025-09-14
### Updates
- Replaced thread participants with collaborators in the database schema.
- Implemented checks for user collaboration status on conversations.
- Enhanced thread assignment logic to ensure proper user assignment and audit fields.
- Updated UI elements for chat takeover functionality to reflect new collaborator roles.

# [0.0.7] FE WEB CEKAT 2025-09-13
### Updates
- Removed static permission constants in favor of direct string references for better alignment with database values.
- Updated components to utilize new permission string format, enhancing consistency across the application.
- Improved navigation logic to enforce permission checks when syncing active tabs, ensuring users only access permitted items.
- Streamlined permission-related code in various components, enhancing maintainability and readability.

# [0.0.6] FE WEB CEKAT 2025-09-03
### Updates
- Implement OpenAI usage tracking and enhance analytics component
- Added OpenAI API key configuration to .env for usage tracking.
- Refactored vite.config.ts to include a usage proxy plugin for fetching OpenAI usage data.
- Enhanced Analytics component to display OpenAI token usage with dynamic date range selection and improved UI elements.
- Integrated charts to visualize input, output, and total tokens over selected time ranges.
- Implemented error handling and loading states for better user experience during data fetching.

# [0.0.5] FE WEB CEKAT 2025-09-03
### Updates
- Updated PermissionNavItem and NavigationItem interfaces to use string arrays for permissions instead of PermissionName type for better flexibility.
- Modified NAVIGATION_CONFIG to replace permission constants with string representations for improved readability and consistency.
- Enhanced RBACProvider's hasPermission function to support various permission formats, including direct matches and synonyms for better user experience.
- Integrated a new PermissionsPage component into the main Index page, ensuring proper permission checks with PermissionGate.


# [0.0.4] FE WEB CEKAT 2025-09-03
### Updates
- Integrate RBAC and enhance agent management features
- Added RBACProvider to App component for role-based access control.
- Updated HumanAgents component to utilize PermissionGate for role management and agent creation.
- Refactored agent role handling to support new roles: master_agent and super_agent.
- Enhanced ConversationPage to display channel provider information for better context.
- Improved useHumanAgents hook to fetch agents from the new v_users view, streamlining data retrieval and role assignment.

# [0.0.3] FE WEB CEKAT 2025-09-03
### Updates
- Implement WhatsApp session polling and enhance deletion handling
- Added polling mechanism to check WhatsApp session status while the QR modal is open, improving user feedback on connection status.
- Introduced loading state management for channel deletion actions to prevent multiple submissions and enhance user experience.
- Removed phone number input from WhatsAppPlatformForm as per updated requirements, streamlining the form submission process.

# [0.0.2] FE WEB CEKAT 2025-09-01
### Updates
- Deleted AUTHENTICATION_SETUP.md, CHAT_SETUP.md, HUMAN_AGENTS_SETUP.md, sample_data.sql, and simple_sample_data.sql as they are no longer relevant to the current project structure.
- Updated package.json version to 0.0.1 and removed unnecessary dev dependencies from package-lock.json.
- Enhanced Login component to display the current version of the application.
- Enhanced Whatsapp channel connecting flow and validation

# [0.0.1] FE WEB CEKAT 2025-09-01
### Updates
- Enhance ClientEditProfileForm: Make company industry selection read-only for non-admin users