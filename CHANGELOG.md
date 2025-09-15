# Change Log
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