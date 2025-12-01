# Super Agent Data Isolation Implementation

## Overview
This document describes the RLS (Row Level Security) policies implemented to ensure proper data isolation for super agents. After applying the migration, each super agent can only access their own data and the data of agents assigned to them, while master agents retain full org-wide access.

## Migration File
`supabase/migrations/20251130000000_super_agent_data_isolation.sql`

## Access Control Matrix

### Master Agents
- **Full org-wide access** to all tables
- Can read/write/update/delete any data within their organization

### Super Agents
- **Restricted to their own data only**
- Can access:
  - Channels where `super_agent_id = auth.uid()`
  - AI profiles where `super_agent_id = auth.uid()`
  - Contacts linked to their channels
  - Messages in threads from their channels
  - Threads from their channels or involving their agents
  - Their own `super_agent_members` records

### Agents
- **Restricted to their super agent's data**
- Can access:
  - Channels where they are assigned via `channel_agents` AND channel belongs to their super agent
  - AI profiles belonging to their super agent (via `super_agent_members`)
  - Contacts linked to channels they are assigned to
  - Messages in threads from channels they are assigned to OR threads they are directly involved in
  - Threads from channels they are assigned to OR threads they are directly involved in

## Tables Modified

### 1. `channels` Table
**Previous State:** All authenticated users could see all channels (`USING (true)`)

**New Policies:**
- `channels_master_read`: Master agents see all channels in their org
- `channels_super_read`: Super agents see only their own channels
- `channels_agent_read`: Agents see channels they are assigned to (via `channel_agents`) that belong to their super agent
- Write policies (`channels_master_write`, `channels_super_write`, etc.) follow the same pattern

### 2. `contacts` Table
**Previous State:** All authenticated users could see all contacts (`USING (true)`)

**New Policies:**
- `contacts_master_read`: Master agents see all contacts in their org
- `contacts_super_read`: Super agents see contacts linked to their channels (via `contact_identities`)
- `contacts_agent_read`: Agents see contacts linked to channels they are assigned to
- Write policies follow the same pattern

### 3. `messages` Table
**Previous State:** Multiple permissive policies allowed broad access

**New Policies:**
- `messages_master_read`: Master agents see all messages in their org
- `messages_super_read`: Super agents see messages in threads from their channels
- `messages_agent_read`: Agents see messages in threads from channels they are assigned to OR threads they are directly involved in
- Write policies follow the same pattern

### 4. `threads` Table
**Status:** Already has proper isolation via existing policies:
- `threads_master_read`: Master agents see all threads
- `threads_super_read`: Super agents see threads from their channels or involving their agents
- `threads_agent_read`: Agents see threads they are involved in

**Note:** No changes needed to threads policies as they already enforce proper isolation.

### 5. `ai_profiles` Table
**Status:** Already properly isolated via existing policy:
- Master agents: see all
- Super agents: see only where `super_agent_id = auth.uid()`
- Agents: see profiles belonging to their super agent (via `super_agent_members`)

**Note:** No changes needed.

### 6. `super_agent_members` Table
**Status:** Already properly isolated via existing policies:
- `sam_master_read`: Master agents see all in their org
- `sam_super_read`: Super agents see only their own records
- `sam_super_write/delete`: Super agents can only modify their own records

**Note:** No changes needed.

## Data Flow Isolation

The isolation works through the following relationships:

```
super_agent_members
  └─> super_agent_id (identifies which super agent owns the agent)

channels
  └─> super_agent_id (identifies which super agent owns the channel)

ai_profiles
  └─> super_agent_id (identifies which super agent owns the AI profile)

contact_identities
  └─> channel_id → channels.super_agent_id (contacts isolated via channel ownership)

threads
  └─> channel_id → channels.super_agent_id (threads isolated via channel ownership)

messages
  └─> thread_id → threads.channel_id → channels.super_agent_id (messages isolated via thread → channel ownership)
```

## Testing Checklist

After applying the migration, verify:

1. **Super Agent Isolation:**
   - [ ] Super agent A cannot see channels owned by super agent B
   - [ ] Super agent A cannot see contacts linked to super agent B's channels
   - [ ] Super agent A cannot see messages from super agent B's threads
   - [ ] Super agent A can see all their own data

2. **Agent Isolation:**
   - [ ] Agent assigned to super agent A cannot see data from super agent B
   - [ ] Agent can see channels they are assigned to (via `channel_agents`)
   - [ ] Agent can see threads they are directly involved in
   - [ ] Agent can see messages from threads they have access to

3. **Master Agent Access:**
   - [ ] Master agent can see all channels, contacts, messages, threads across the org
   - [ ] Master agent can modify any data in their org

4. **Edge Cases:**
   - [ ] Unassigned agents (no super agent) cannot see any data
   - [ ] Web channels (public) still accessible to anonymous users (if needed)
   - [ ] Service role (n8n) still has full access

## Rollback

If you need to rollback this migration, you can:

1. Drop all the new policies created in this migration
2. Recreate the original permissive policies:
   ```sql
   CREATE POLICY "Allow authenticated access to channels" ON "public"."channels" 
     TO "authenticated" USING (true);
   
   CREATE POLICY "Allow authenticated access to contacts" ON "public"."contacts" 
     TO "authenticated" USING (true);
   
   CREATE POLICY "Allow authenticated access to messages" ON "public"."messages" 
     TO "authenticated" USING (true);
   ```

## Notes

- The migration preserves anonymous read access for web channels (if needed for public chat widgets)
- Service role policies remain unchanged (for n8n webhooks and system operations)
- The migration is idempotent (uses `DROP POLICY IF EXISTS`)

