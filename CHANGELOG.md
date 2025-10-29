# Change Log
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
  - Live chat link and embed now use `https://classy-frangollo-337599.netlify.app/livechat/{platform_id}`.
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