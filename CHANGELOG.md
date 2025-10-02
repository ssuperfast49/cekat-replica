# Change Log
# [0.0.21] FE WEB CEKAT 2025-10-02
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