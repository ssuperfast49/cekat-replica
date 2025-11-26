# Change Log
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