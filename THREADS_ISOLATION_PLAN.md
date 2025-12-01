# Threads Isolation Fix Plan

## Problem Analysis

### Current Issues:

1. **Overly Permissive Policy**
   - `"Allow authenticated access to threads"` - Allows ALL authenticated users to see ALL threads
   - **Action:** DROP this policy

2. **`threads_super_read` Policy - Security Leak**
   - Current condition allows super agents to see threads where:
     - Their agents are involved (assignee/assigned_by/resolved_by) **OR**
     - Thread's channel belongs to them
   - **Problem:** The first condition allows super agents to see threads from OTHER super agents' channels if their agent is involved
   - **Fix:** Remove the agent involvement check, ONLY allow threads from their own channels

3. **`threads_agent_read` Policy - Missing Super Agent Check**
   - Current condition allows agents to see threads where:
     - They are assigned to the thread (assignee/assigned_by/resolved_by) **OR**
     - They are assigned to the channel (via channel_agents)
   - **Problem:** Doesn't verify that the channel belongs to their super agent
   - **Fix:** Add check that `channels.super_agent_id` matches their super agent from `super_agent_members`

4. **Missing Write Policies**
   - No INSERT/UPDATE/DELETE policies for threads that enforce super agent isolation
   - **Fix:** Add write policies similar to channels, contacts, and messages

## Solution Plan

### Step 1: Drop Overly Permissive Policy
```sql
DROP POLICY IF EXISTS "Allow authenticated access to threads" ON "public"."threads";
```

### Step 2: Fix `threads_super_read` Policy
**Current (WRONG):**
- Allows threads where super agent's agents are involved OR threads from their channels

**New (CORRECT):**
- ONLY allows threads from channels where `channels.super_agent_id = auth.uid()`
- Remove the agent involvement check completely

### Step 3: Fix `threads_agent_read` Policy
**Current (WRONG):**
- Allows threads where agent is involved OR assigned to channel
- Doesn't check channel ownership

**New (CORRECT):**
- Allows threads where:
  1. Agent is assigned to channel (via channel_agents) AND channel belongs to their super agent
  2. OR agent is directly involved in thread (assignee/assigned_by/resolved_by/collaborator) AND channel belongs to their super agent

### Step 4: Add Write Policies for Threads

**For Super Agents:**
- `threads_super_write` (INSERT) - Can create threads in their channels
- `threads_super_update` (UPDATE) - Can update threads from their channels
- `threads_super_delete` (DELETE) - Can delete threads from their channels

**For Master Agents:**
- `threads_master_write` (INSERT) - Can create threads in their org
- `threads_master_update` (UPDATE) - Can update threads in their org
- `threads_master_delete` (DELETE) - Can delete threads in their org

**For Agents:**
- Agents typically don't create threads (they're created by the system), but they can update/delete threads they're involved in
- `threads_agent_update` (UPDATE) - Can update threads they're involved in AND channel belongs to their super agent
- `threads_agent_delete` (DELETE) - Can delete threads they're involved in AND channel belongs to their super agent

## Expected Result

After the fix:
- ✅ Super agents can ONLY see threads from their own channels
- ✅ Agents can ONLY see threads from channels assigned to them AND channel belongs to their super agent
- ✅ Master agents can see all threads in their org
- ✅ No data leakage between super agents

## Migration Strategy

1. Create new migration file: `20251130000001_fix_threads_isolation.sql`
2. Drop the permissive policy
3. Drop and recreate `threads_super_read` with correct logic
4. Drop and recreate `threads_agent_read` with super agent check
5. Add all write policies
6. Apply to all three databases (dev, main, backup)

