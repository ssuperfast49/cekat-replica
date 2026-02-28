-- Drop the existing RESTRICT constraint on ai_profiles
ALTER TABLE IF EXISTS public.ai_profiles
  DROP CONSTRAINT IF EXISTS ai_profiles_super_agent_id_fkey;

-- Add it back with ON DELETE CASCADE
ALTER TABLE public.ai_profiles
  ADD CONSTRAINT ai_profiles_super_agent_id_fkey
  FOREIGN KEY (super_agent_id)
  REFERENCES public.users_profile(user_id)
  ON DELETE CASCADE;

-- Create an RPC to cleanly cascade delete a user and any sub-agents if they are a super_agent
CREATE OR REPLACE FUNCTION public.cascade_delete_agent(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  child_agent RECORD;
BEGIN
  -- 1. Find any child agents attached to this super agent
  FOR child_agent IN 
    SELECT agent_user_id 
    FROM public.super_agent_members 
    WHERE super_agent_id = target_user_id 
      AND agent_user_id IS NOT NULL
  LOOP
    -- Recursively or directly delete the child agent's auth user.
    -- Because users_profile has ON DELETE CASCADE from auth.users, and
    -- ai_profiles now has ON DELETE CASCADE from users_profile,
    -- simply deleting the auth user will wipe out their profile and AI agents (if any).
    DELETE FROM auth.users WHERE id = child_agent.agent_user_id;
  END LOOP;

  -- 2. Delete the target user themselves
  DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;
