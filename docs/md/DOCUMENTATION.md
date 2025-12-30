# QA Testing Guide

This guide is written for QA testers who verify the product by interacting with the deployed application. It explains how to reach each feature, the expected behaviour, validation rules, and key edge cases to consider. No code access or local setup is required.

## 1. Getting Started

- Use the latest **Dev URL** provided by the product team.
- Test accounts:
  - **Master Agent**: full access to all menus/features.
  - **Super Agent**: access to assigned agents and analytics scoped to their cluster.
  - **Agent**: limited to personal conversations and assigned contacts.
- If credentials expire or access is denied, contact the engineering team; QA has no ability to reset passwords within the app.

## 2. Authentication Journeys

### 2.1 Login
- Navigate to `/login`.
- Fields:
  - **Email** (required, email format).
  - **Password** (required, minimum 8 characters).
- Expected validation:
  - Empty fields show inline messages.
  - Invalid credentials show toast “Invalid login credentials”.
  - Deactivated accounts show “Your account is deactivated” and redirect to the Account Deactivated page.
- Successful login routes to the Dashboard.
- Buttons & states:
  - **Log In** stays disabled until both fields are valid.
  - While submitting, button shows spinner and prevents double clicks.
  - **Forgot password?** opens the reset flow; link always available.
- Tabs: `Login` and `Reset`. Switching tabs clears validation messages.
- Utilities:
  - Eye icon toggles password visibility.
  - hCaptcha widget appears when enabled; **Sign In** stays disabled until solved.
  - Footer version link (e.g., `v0.0.44`) routes to `Changelog`.

### 2.2 OTP / 2FA
- After login, some accounts require a 6-digit code.
- QA should verify:
  - Submitting incorrect code shows error toast.
  - Code input disables while verifying.
  - Resend option triggers toast “OTP sent”.
- Button behaviour:
  - **Verify code** disabled until 6 digits entered.
  - **Resend code** available once per 30 seconds; show warning toast if pressed during cooldown.

### 2.3 Forgot Password / Reset
- On login screen, click “Forgot password?” to open reset flow.
- Enter email; expect success toast even if email is not found (security).
- Follow email link (dev team will provide test link) to set new password:
  - Must be at least 8 characters and match confirmation.
  - Success toast returns to login.
- Buttons:
  - **Send reset link** disabled until email passes format validation.
  - Reset screen: **Update password** disabled until both fields filled and match; shows spinner while submitting.

### 2.4 Account Deactivated
- If an account is deactivated:
  - Login shows message and routes to `/account-deactivated`.
  - Page displays support instructions; verify no navigation options available.

### 2.5 Logout & Session Handling
- Click avatar → “Logout”. Verify:
  - Session cleared and back to login.
  - Protected routes redirect to login when visited directly after logout.

### 2.6 Profile & 2FA Toggle
- Avatar → “Profile”.
- Fields: display name, timezone, (optional) password change, email 2FA toggle.
- Validation:
  - Password change requires current password.
  - Mismatched confirm password shows inline error.
  - Saving changes shows toast confirmation.

## 3. Navigation & Menus

| Menu | Route | Typical Access | Notes |
|------|-------|----------------|-------|
| Dashboard | `/` | All logged-in users | Quick stats, alerts, action cards. |
| Live Chat | `/live-chat` | Master, Super, Agent | Conversation workspace. |
| Contacts | `/contacts` | Master, Super | Customer management. |
| AI Agents | `/ai-agents` | Master | AI profile management. |
| Human Agents | `/human-agents` | Master, Super | Assign/manage human agents. |
| Analytics | `/analytics` | Master, Super | KPI dashboards. |
| Logs | `/logs` | Master | Audit trail. |
| Permissions | `/permissions` | Master | Roles & permissions. |
| Changelog | `/changelog` | All | Release notes. |
| Profile | `/profile` | All | Personal settings. |

Menus hide automatically if the user lacks permission. QA should confirm that limited roles only see allowed entries.

## 4. Feature Testing Checklist

### 4.1 Dashboard
- Verify cards show correct counts (today’s chats, AI usage).
- AI pause banner appears when AI is paused (simulate via data).
- Quick links lead to appropriate pages.
- Master vs Agent roles display different cards (e.g., agent should **not** see Token Usage summary).
- Buttons & validation:
  - Card CTAs (e.g., “Open Live Chat”) route correctly; disabled state shown if permission missing.
  - Alert banners include **Dismiss** button that removes banner for session.
  - Token usage widgets display “No data available” state when filters return zero rows.

### 4.2 Live Chat Workspace
- Tabs: Assigned, Unassigned, Resolved.
  - Counts update as conversations move between states.
  - Filter panel: channel, tag, date range, status, search.
- Conversation view:
  - Message composer validates max length (toast if exceeded).
  - Attachments support common formats; large files rejected with error.
  - AI/Human toggle: when AI paused, toggle disabled and warning displayed.
  - Resolve conversation: require confirmation and final note if configured.
- SLA timers: conversations beyond threshold show highlighted timers.
- QA scenarios:
  - Assign conversation to self/others.
  - Reopen resolved conversation.
  - Send message as AI and as human.
- Buttons & validation:
  - **Send** disabled until message text or attachment present; shows loading while request in flight.
  - Attachment button rejects unsupported types or >25 MB files with toast.
  - **Resolve** opens confirmation modal; requires resolution reason if configured.
  - **Assign** submit disabled when no agent selected; search-as-you-type in dropdown.
  - Filters include **Reset** action to restore defaults; invalid date range shows inline error.

### 4.3 Contacts
- Search and filter by label/channel.
- View contact drawer: expect timeline of threads, editable fields.
- Create/Edit:
  - Required: name, primary identifier (email or channel handle).
  - Invalid email or duplicate handle shows inline error.
  - Successful save refreshes list and shows toast.
- Buttons & validation:
  - **Create contact** disabled until form valid; highlight required fields.
  - **Save changes** disabled if no edits.
  - **Delete** requires confirmation modal; shows spinner while deleting.
  - Tag add/remove chips update instantly; duplicates blocked with inline text.

### 4.4 AI Agents
- Card list with search/filter.
- Create flow:
  - Provide name (required).
  - Select model (required); fallback optional.
  - After creation, user lands on settings screen.
- Settings:
  - Update prompt, welcome message, handover rules, limits.
  - Toggle auto-resolve / AI pause per agent.
  - Assign a **single super agent**. Super agents only see and manage their own AI agents; master agents can reassign via dropdown, while super agents default to themselves.
- Delete agent: confirm dialog, toast success, card removed.
- Buttons & validation:
  - **Create AI agent** disabled until name and model selected.
  - Section-level **Save** buttons disabled until edits detected; toast on success/failure.
  - **Pause AI** toggles show confirmation warning when switching off.
  - Delete modal may require typing agent name; confirm button disabled until match.

### 4.5 Human Agents
- Tabs: Active, Pending invites.
- Search (name/email) and filters (role, status) update server-side list.
- Super agent view (when logged in as super agent) only shows their cluster.
- Create agent modal:
  - Requires name, email, role.
  - When role=agent, super agent selection required.
  - Optional email 2FA and phone.
- Edit token limits: toggle enforce limits, set daily/monthly caps.
- Usage dialog: select time range (7d/30d/This month) and confirm totals.
- Buttons & validation:
  - **Invite agent** disabled until name, email, and role valid; when role=agent, must select super agent.
  - Email format validated before enabling submit.
  - **Save limits** disabled when values unchanged or invalid (negative numbers).
  - **Remove agent** confirmation modal warns if active assignments exist.
  - Pending tab includes **Resend invite** button; disabled for expired invites already resent in last minute.

### 4.6 Analytics
- Sections:
  - Chat volume charts.
  - Containment rate.
  - Response time metrics.
  - Agent performance leaderboard.
  - Token usage heatmap.
- Filters: date range, channel, team. QA ensures charts update and empty states display placeholder messages.
- Export buttons (if present) produce CSV downloads.
- Buttons & validation:
  - Date pickers prevent selecting end before start; apply button disabled when invalid.
  - **Download CSV** disabled while data loading or when no rows.
  - Refresh buttons show spinners to block duplicate fetches.

### 4.7 Logs
- Table with filters (actor, action, success/failure, date range).
- Master agent sees all entries; super/agent see only personal actions.
- Clicking a row reveals JSON detail (if implemented).
- Ensure pagination and search behave correctly.
- Buttons & validation:
  - **Apply filters** disabled until required inputs valid.
  - Pagination buttons disabled at list boundaries.
  - **Export logs** (if present) unavailable to non-master roles; show tooltip.

### 4.8 Permissions
- Roles table:
  - View counts, open configure dialog, edit name/description, delete role.
- Configure view for role:
  - Menu Access toggles (bundles) update state instantly.
  - CRUD permissions grid (Create/Read/Update/Delete) with inline filters.
  - Special permissions list grouped by resource with same filters.
  - Filters (search/resource/action) should narrow both grids simultaneously.
  - Summary badges (counts) reflect current assignments.
- QA should verify audit logs capture changes (if accessible).
- Buttons & validation:
  - **New role** disabled without `roles.create` permission.
  - Role edit modal enforces unique name; duplicate triggers inline error.
  - Menu toggles display spinner while RPC completes; cannot be toggled again until success/failure.
  - Filters share **Clear** action that resets search/resource/action simultaneously.
  - Delete role modal blocks removal if role still assigned; shows warning text.

### 4.9 Profile
- Update display name, timezone, password, email 2FA toggle.
- Password change requires old password; mismatch errors show inline.
- Toasts confirm success or failure.
- Logging out from profile works.
- Buttons & validation:
  - **Save profile** disabled until changes detected.
  - **Update password** disabled until current password entered and new/confirm match policy (min 8 chars).
  - **Enable email 2FA** toggle prompts confirmation; disabled while request pending.
  - **Sign out of other sessions** button (if present) shows confirmation toast.

### 4.10 Changelog
- Tabs: Interactive, Markdown.
- Search filter and highlight badges.
- Ensure newest entry (0.0.44) includes documentation note.
- Buttons & validation:
  - Tab switcher reflects active state and is keyboard accessible.
  - Search box filters list instantly; clearing restores full list.
  - Version badges open detail panel; highlight persists after navigation.

### 4.11 Miscellaneous Pages
- `NotFound` renders for invalid route.
- `AccountDeactivated` blocks further navigation.
- `Logout` invalidates session.

## 5. End-to-End Flows

### 5.1 Invite New User (Human or Super Agent)
1. Sign in as a master agent and navigate to `Human Agents`.
2. Click `Invite agent`.
3. Complete the form:
   - Name (required), email (required, unique), role (master / super / agent).
   - If role is `Agent`, select a supervising super agent.
   - Optional: toggle email 2FA, add phone number.
4. Submit. The button stays disabled until all mandatory fields pass validation; expect a success toast.
5. Switch to the `Pending` tab to confirm the invite appears with status `Invited`.
6. (Optional) Use `Resend invite` to verify repeat-send cooldown and toast feedback.

### 5.2 Accept Invitation & First Login
1. Open the invitation email (delivered via Supabase SMTP).
2. Follow the `Accept invitation` link; create a password (min 8 chars) and confirm.
3. After submission, you are redirected to the login screen.
4. Sign in with the invited email + new password.
5. On first login:
   - Complete OTP if enforced for the organization.
   - After success, you land on the Dashboard with role-scoped navigation.

### 5.3 Change Password from Profile
1. While signed in, open the avatar menu → `Profile`.
2. Expand the `Change password` section.
3. Enter current password, new password, confirm new password.
4. The `Update password` button remains disabled until all fields pass validation (new password ≥8 chars and matches confirmation).
5. Submit: expect toast confirmation and automatic clearing of fields. Invalid credentials show inline error and toast.

### 5.4 Reset Password via “Forgot Password”
1. On the login screen, click `Forgot password?`.
2. Enter the account email and submit (`Send reset link` enables only when the email field is valid).
3. A success toast shows regardless of whether the email is registered (security).
4. Open the reset email, click the link, set and confirm a new password.
5. On success you are returned to `/login`; attempt sign-in with the new credentials to finish validation.

### 5.5 Transactional Email (SMTP) Verification
1. Use the QA inbox provided by engineering (Mailtrap/Mailosaur/Mailpit account).
2. Trigger each email type:
   - Invite a user (see 5.1).
   - Run the forgot-password flow (5.4).
   - Trigger OTP/2FA (2.2) if enabled.
3. Confirm each email arrives from `no-reply@...` (configured sender), includes correct branding, and contains working CTA links.
4. Validate timestamps (<1 min delay) and that expired links show the expected error message.
5. Record any missing emails or delivery delays as bugs (tag `[SMTP]`).

### 5.6 Handle a Live Chat Conversation
1. Sign in as an agent (or master/super) and open `Live Chat`.
2. In `Unassigned`, pick a conversation → click `Assign to me`.
   - Button disabled until selection made; success toast + thread moves to `Assigned`.
3. Send a message:
   - Type reply, optionally attach file (<25 MB). `Send` enables only when content present.
   - Observe typing indicator and message timestamp; failed send shows red toast.
4. Toggle AI status:
   - Flip `AI Assist` switch. When paused globally, toggle disabled with tooltip.
5. Use conversation tools:
   - Add internal note, apply/remove tags, assign to another agent or super agent.
   - Trigger canned responses/shortcuts where available.
   - If AI token limit exceeded, confirm escalation banner and auto assignment to super agent.
6. Resolve the thread:
   - Click `Resolve`, fill closing summary if required, confirm dialog.
   - Conversation moves to `Resolved`, SLA badge clears; verify post-chat CSAT prompt when enabled.
7. Reopen (`Resolved` tab → `Reopen`) to confirm status change and toast.

### 5.7 Create and Configure an AI Agent
1. Navigate to `AI Agents` (master role).
2. Click `Create AI agent`.
   - Complete: name, select model/provider, optional fallback. Submit (button enables when valid).
3. In the settings page verify sections:
   - Assign the owning **super agent** (required). Super agents only see their cluster; master agents pick from the dropdown, while super agents default to themselves.
   - Update prompt/system message ⇒ hit `Save` and expect success toast.
   - Toggle auto-resolve limits and confirm warning dialogs appear.
   - Manage knowledge base uploads: add file (shows progress), delete file (confirmation dialog).
   - Adjust welcome message, fallback message, and temperature sliders where exposed.
4. Use `Test AI` (if present) to send sample question; expect modal response or error toast.
5. Delete agent:
   - Open overflow menu → `Delete`. When confirmation requires typing name, ensure mismatch disables delete.
   - After deletion, agent card disappears and toast fires.
6. Confirm activity timeline logs create/update/delete actions in `Logs`.

### 5.8 Add and Manage a Contact
1. Go to `Contacts`.
2. Click `Add contact`.
   - Fill name (required) and primary identifier (email or platform handle).
   - Attach label(s), channel, optional notes.
   - Submit → modal closes, list refreshes, toast shown.
3. Open the new contact entry:
   - Verify timeline shows recent threads; add note and save (button disabled until text entered).
   - Add/remove labels and check chips update; duplicate label shows inline feedback.
   - Add additional identifiers (phone/channel handles) if fields available; ensure validation on format.
4. Test validation:
   - Attempt to save duplicate email ⇒ inline error `Email already exists`.
   - Clear required field and submit ⇒ error highlighting.
5. Delete contact:
   - Use overflow actions, confirm modal message, ensure toast and row removal.
6. Export contact list (if button available) and confirm CSV delivered.

### 5.9 Update Role Permissions
1. As master agent, open `Permissions`.
2. Select a role → `Configure`.
3. Edit role metadata:
   - Use `Edit role` to rename/describe; save disabled until text changes; ensure uniqueness validation.
   - Delete role via overflow menu; confirm blocked when assignments exist (warning toast).
3. Menu Access:
   - Toggle a module (e.g., `Analytics`). Switch shows spinner then success toast; navigation updates immediately when impersonating role.
4. CRUD grid:
   - Use search to narrow (`contacts`) and toggle specific `Read`/`Update`.
   - Verify counts update and table indicates assignment.
5. Special permissions:
   - Filter by action (`export`) and enable/disable items.
6. Attempt invalid operations:
   - Toggle when request in flight ⇒ control disabled.
   - Delete role with active assignments ⇒ modal warns and blocks action.
7. Audit confirmation (optional): check `Logs` for `role_permissions.update`.

### 5.10 Connect a Messaging Platform
1. Navigate to `Admin Panel` → `Platforms & Integrations` (or `Channels` module).
2. Click `Add platform`/`Connect` → choose provider (`WhatsApp`, `Telegram`, `Web`).
3. Complete setup form:
   - Required fields: display name, AI agent, (for WhatsApp) phone number.
   - Super agent is auto-filled from the selected AI agent; choose a different AI agent to change ownership.
   - Attach branding image (<5 MB) and pick optional human agents (list filtered to the AI agent's super agent).
4. Submit: expect `Creating...` state then success toast; new platform appears in list.
5. For WhatsApp:
   - Click `Connect session` to generate QR code; scan with device.
   - Session status should transition to `connected`. Invalid code should show error and re-enable connect button.
6. For Web:
   - Copy `Embed code` and `Live Chat link` fields; ensure `Copy` buttons place content on clipboard (toast confirmation).
7. Existing platform maintenance:
   - Change assigned AI agent or human agents and confirm spinners + toast feedback.
   - Upload/update avatar (preview updates immediately); remove avatar resets to default icon.
   - Delete platform from overflow menu; confirmation modal requires acknowledgement and list refreshes after success.
8. Admin panel utilities:
   - **Clear Local Cache** button flushes cached data; toast confirms.
   - `AI Auto Responses` card → `Pause AI Responses` opens modal (optional reason). Confirm status badge flips to Paused; `Resume AI Responses` restores Active.
   - Review `Reliability & Circuit Breaker` panel statuses; toggles (if exposed) must reflect circuit breaker state changes.

### 5.11 Retrieve Analytics and Exports
1. Open `Analytics`.
2. Set date range (custom) ensuring start ≤ end; apply filters (channel/team).
3. Validate each widget refresh (spinners) and displays updated values.
4. Trigger `Download CSV` from Chat Volume and Token Usage if available—button disabled until data loads.
5. For empty dataset (e.g., future date range), confirm charts show “No data” and exports disable.
6. Switch between dashboard tabs (Overview, Agent Performance, Token Usage); verify filters persist.
7. Inspect drill-down links (e.g., `View threads`) to ensure navigation to detailed reports works.

### 5.12 Review Audit Logs
1. Go to `Logs`.
2. Use filters:
   - Actor email, action type, success/failure toggle, date range.
   - Ensure `Apply` disabled until inputs valid.
3. Pagination:
   - Navigate pages and confirm boundary disabling.
4. Open log entry (row click) to view JSON details; verify data reflects recent actions (e.g., from 5.9).
5. Export (if permitted) to confirm file download or appropriate permission error.
6. Verify realtime updates: perform action (e.g., toggle permission) and confirm new log row appears after refresh.

### 5.13 Run Data Retention & GDPR Cleanup
1. In `Admin Panel`, locate `Data retention`.
2. Click `Edit retention` → adjust days (numeric only). Submit; toast confirms and modal closes.
3. Trigger `Run cleanup now`:
   - Button shows spinner; upon completion, toast summarises threads/messages deleted.
4. GDPR deletion:
   - Open modal, input contact UUID, submit. Expect progress spinner and success/failure toast.
   - Invalid UUID should show inline error or toast.
5. Danger zone cleanup:
   - Paste comma/newline separated contact IDs; parsed count updates live.
   - **Delete contacts** button disabled when list empty or while request processing.
   - Confirmation prompts explain irreversibility; toast confirms completion.

### 5.14 Manage Human Agent Lifecycle
1. From `Human Agents` → `Active`, open an agent card.
2. Use `Edit` to update display name/role; save disabled until changes detected, toast confirms update.
3. Switch to `Pending` tab:
   - Use `Cancel invite` (confirmation modal) and confirm removal.
   - Use `Resend invite`; ensure cooldown toast appears if triggered repeatedly.
4. Token limits:
   - Open `Token limits`, toggle enforcement, edit daily/monthly caps; invalid numbers highlight input.
   - Save to update summary badge and verify entry in `Logs`.
5. Usage insights:
   - `View usage` → change time range (7d/30d/This month/custom) and verify chart/table refresh.
6. Remove agent:
   - Select `Remove from org`, confirm irreversible delete, ensure agent disappears from list.

### 5.15 Review Dashboard Quick Actions
1. Confirm system banners (AI pause, token low) display when relevant; use **Dismiss** and ensure banner stays hidden after refresh.
2. Verify KPI cards:
   - Hover tooltips explain metrics.
   - Role-restricted cards show lock message for lower roles.
3. Trigger quick action CTAs (e.g., `Open Live Chat`, `Invite new agent`, `Connect platform`) and ensure correct modals/pages open.
4. Token usage widget: switch timeframe selector (Today/7d/30d) and confirm chart/summary update; empty state shows placeholder text.
5. Activity feed (if present) updates with recent actions; clicking entry navigates to source page.

### 5.16 Profile & Session Management
1. Avatar → `Profile`.
2. Update display name/timezone; `Save profile` disabled until changes detected; toast on success.
3. Email 2FA toggle:
   - Enable/disable; confirmation dialog appears; follow-up login requires OTP when enabled.
4. Change password:
   - Enter current/new/confirm; mismatched passwords show inline text; success clears inputs and produces toast.
5. Manage sessions (if list present):
   - Review device list; click `Sign out other sessions` (confirmation modal) and ensure entry in `Logs`.
6. Return to Dashboard via breadcrumb or nav; verify persistence of edited details.

### 5.17 Changelog Experience
1. Open `Changelog`.
2. Toggle between `Interactive` and `Markdown` tabs; ensure state preserved when navigating back.
3. Use search input to filter releases; badges update and clearing resets view.
4. Expand release accordion to view grouped highlights; verify tags (UI, Backend, Docs) render.
5. Use share/copy link (if provided) to copy release anchor; toast success indicates link copied.
6. Confirm latest entry version matches footer link from login page.

## 6. Validation Summary

- Forms show inline error messages for missing/invalid fields.
- Toasts provide outcome: success (green), error (red), warning (yellow).
- API errors surfaced via toast with human-readable text (e.g., “Something went wrong, please try again”).
- Attachment size/format limits enforced in Live Chat and profile uploads.
- Filters default to last used values for convenience (where applicable).
- Primary action buttons remain disabled until required inputs pass validation and show busy state while submitting.
- Destructive actions require confirmation dialogs; submit buttons stay disabled until confirmation fulfilled.

## 7. Role-Based Expectations

| Feature | Master Agent | Super Agent | Agent |
|---------|--------------|-------------|-------|
| Dashboard | Full | Limited cards | Limited cards |
| Live Chat | All conversations | Own cluster | Assigned only |
| Contacts | View/manage all | View/manage assigned | View read-only |
| AI Agents | Full control | Read (if granted) | No access |
| Human Agents | Manage all | Manage cluster | No access |
| Analytics | Global | Cluster-only | No access |
| Logs | Global | Personal | Personal |
| Permissions | Full | No access | No access |
| Profile | Own | Own | Own |

QA should log in with each role to confirm visibility/permissions accordingly.

## 8. Known Edge Cases / Regression Targets

- AI Pause toggle should immediately disable AI actions across Live Chat and AI agents.
- Deactivated users must never reach any app page.
- Changelog search should work with partial version numbers (e.g., “0.0.4”).
- Human Agent creation with duplicate email should fail gracefully.
- Permissions filters should persist while switching between CRUD/Special accordions.
- Large audit log exports should not hang UI (loading spinner expected).

## 9. Reporting Issues

- Provide screenshot or screen recording.
- Include account role used and exact steps to reproduce.
- Note URL and timestamp if possible (some logs look up actions).
- Tag issue with feature area (e.g., `[Live Chat]`, `[Analytics]`).

---

This QA-focused guide intentionally omits developer setup information. For technical details (stack, schema, migrations), contact engineering or reference internal developer documentation.
