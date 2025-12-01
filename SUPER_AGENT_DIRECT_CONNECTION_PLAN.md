# Super Agent Direct Connection Plan

## Problem Statement

Currently, super agents can see ALL contacts and threads because:
1. The RLS policies check `channels.super_agent_id` via joins, but some contacts/threads may not have proper channel connections
2. There's no direct `super_agent_id` column on `contacts` and `threads` tables
3. When contacts/threads are created, they don't automatically get linked to the super agent

## Solution Overview

1. **Add `super_agent_id` columns** to `contacts` and `threads` tables
2. **Migrate existing data** to populate these columns from channel relationships
3. **Create triggers** to automatically set `super_agent_id` when contacts/threads are created
4. **Update RLS policies** to check `super_agent_id` directly (more efficient and reliable)
5. **Update frontend functions** to ensure `super_agent_id` is set when creating contacts/threads

## Detailed Implementation Plan

### Step 1: Add `super_agent_id` Columns

**Contacts Table:**
- Add `super_agent_id UUID` column (nullable, references `auth.users(id)`)
- Nullable because master agents' contacts won't have a super agent
- Add foreign key constraint to `auth.users(id)`

**Threads Table:**
- Add `super_agent_id UUID` column (nullable, references `auth.users(id)`)
- Nullable because master agents' threads won't have a super agent
- Add foreign key constraint to `auth.users(id)`

### Step 2: Migrate Existing Data

**For Contacts:**
```sql
UPDATE contacts c
SET super_agent_id = (
  SELECT ch.super_agent_id
  FROM contact_identities ci
  JOIN channels ch ON ch.id = ci.channel_id
  WHERE ci.contact_id = c.id
  AND ch.super_agent_id IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM contact_identities ci
  JOIN channels ch ON ch.id = ci.channel_id
  WHERE ci.contact_id = c.id
  AND ch.super_agent_id IS NOT NULL
);
```

**For Threads:**
```sql
UPDATE threads t
SET super_agent_id = ch.super_agent_id
FROM channels ch
WHERE t.channel_id = ch.id
AND ch.super_agent_id IS NOT NULL;
```

### Step 3: Create Triggers for Automatic Assignment

**Trigger for `contact_identities` INSERT:**
- When a `contact_identities` row is created linking a contact to a channel
- If the channel has a `super_agent_id`, update the contact's `super_agent_id`
- Only update if contact's `super_agent_id` is currently NULL (don't overwrite existing)

**Trigger for `threads` INSERT:**
- When a thread is created with a `channel_id`
- Look up the channel's `super_agent_id` and set it on the thread
- This ensures threads always have the correct `super_agent_id` from creation

**Trigger for `channels` UPDATE:**
- If a channel's `super_agent_id` changes, update all related contacts and threads
- This handles cases where channels are reassigned to different super agents

### Step 4: Update RLS Policies

**Contacts:**
- `contacts_super_read`: Check `contacts.super_agent_id = auth.uid()` directly
- `contacts_agent_read`: Check via `super_agent_members` that the contact's `super_agent_id` matches their super agent

**Threads:**
- `threads_super_read`: Check `threads.super_agent_id = auth.uid()` directly
- `threads_agent_read`: Check via `super_agent_members` that the thread's `super_agent_id` matches their super agent

**Benefits:**
- More efficient (direct column check vs joins)
- More reliable (no dependency on `contact_identities` or `channels` joins)
- Handles edge cases where relationships might be missing

### Step 5: Update Frontend Functions

**`useContacts.ts` - `createContact`:**
- If creating a contact with a channel (via `contact_identities`), the trigger will handle it
- If creating a contact without a channel initially, `super_agent_id` will be NULL (master agent's contact)

**`useConversations.ts` - `createConversation`:**
- When creating a thread, fetch the channel's `super_agent_id` and include it in the insert
- This ensures the thread has the correct `super_agent_id` even if the trigger fails

**Backend/Edge Functions:**
- Any functions that create contacts/threads should set `super_agent_id` based on:
  - Channel's `super_agent_id` (for threads)
  - Channel's `super_agent_id` via `contact_identities` (for contacts)
  - AI Agent's `super_agent_id` (if creating via AI agent)

### Step 6: Handle AI Agent Connections

**For Contacts created via AI Agents:**
- If a contact is created through an AI agent interaction, check the AI agent's `super_agent_id`
- Set the contact's `super_agent_id` to match the AI agent's `super_agent_id`

**For Threads created via AI Agents:**
- Threads are always created with a `channel_id`, so the channel's `super_agent_id` should be used
- If a thread is somehow created without a channel, check if there's an AI agent context and use its `super_agent_id`

## Migration Strategy

1. **Create migration file**: `20251130000005_add_super_agent_direct_connections.sql`
2. **Add columns** with nullable constraint
3. **Migrate existing data** from channel relationships
4. **Create triggers** for automatic assignment
5. **Update RLS policies** to use direct column checks
6. **Test** with sample data
7. **Apply to all 3 databases** (dev, main, backup)

## Expected Results

After implementation:
- ✅ Super agents can ONLY see contacts where `contacts.super_agent_id = their_user_id`
- ✅ Super agents can ONLY see threads where `threads.super_agent_id = their_user_id`
- ✅ New contacts/threads automatically get `super_agent_id` set via triggers
- ✅ Frontend functions ensure `super_agent_id` is set when creating contacts/threads
- ✅ Master agents can see all contacts/threads (where `super_agent_id IS NULL` or in their org)
- ✅ No data leakage between super agents

## Edge Cases to Handle

1. **Contacts without channels**: These will have `super_agent_id = NULL` (master agent's contacts)
2. **Threads without channels**: Shouldn't happen, but if it does, `super_agent_id = NULL`
3. **Channels without super_agent_id**: These are master agent's channels, contacts/threads will have `super_agent_id = NULL`
4. **Channel reassignment**: Trigger on `channels` UPDATE will update all related contacts/threads
5. **Multiple channels per contact**: Use the first channel's `super_agent_id` (or most recent)

