# Change Log
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