-- Drop old table and associated trigger
DROP TRIGGER IF EXISTS thread_counts_trigger ON public.threads;
DROP FUNCTION IF EXISTS public.maintain_thread_status_counts() CASCADE;
DROP TABLE IF EXISTS public.thread_status_counts CASCADE;

-- Create channel_status_counts table
CREATE TABLE IF NOT EXISTS public.channel_status_counts (
    channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    status text NOT NULL,
    count bigint DEFAULT 0,
    PRIMARY KEY (channel_id, status)
);

-- RLS Policies
ALTER TABLE public.channel_status_counts ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies to avoid conflicts
DROP POLICY IF EXISTS "crud channel status count" ON public.channel_status_counts;
DROP POLICY IF EXISTS "channel counts read_all" ON public.channel_status_counts;
DROP POLICY IF EXISTS "channel counts member" ON public.channel_status_counts;

-- Master agents / auditors can see all channel counts
CREATE POLICY "channel counts read_all" ON "public"."channel_status_counts"
AS PERMISSIVE FOR SELECT TO authenticated
USING (is_master_agent() OR is_auditor());

-- Regular agents only see counts for channels they belong to
CREATE POLICY "channel counts member" ON "public"."channel_status_counts"
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  EXISTS ( 
      SELECT 1 FROM public.channels c WHERE c.id = channel_status_counts.channel_id AND (
        (c.super_agent_id = auth.uid()) OR 
        (EXISTS ( SELECT 1 FROM public.channel_agents ca WHERE ca.channel_id = c.id AND ca.user_id = auth.uid() ))
      )
  )
);

-- Trigger Function
CREATE OR REPLACE FUNCTION maintain_channel_status_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment new status count
    IF TG_OP = 'INSERT' THEN
        IF NEW.channel_id IS NOT NULL AND NEW.status IS NOT NULL THEN
            INSERT INTO public.channel_status_counts (channel_id, status, count)
            VALUES (NEW.channel_id, NEW.status::text, 1)
            ON CONFLICT (channel_id, status) DO UPDATE SET count = channel_status_counts.count + 1;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            -- Decrement old
            IF OLD.channel_id IS NOT NULL AND OLD.status IS NOT NULL THEN
                UPDATE public.channel_status_counts
                SET count = count - 1
                WHERE channel_id = OLD.channel_id AND status = OLD.status::text;
            END IF;
            
            -- Increment new
            IF NEW.channel_id IS NOT NULL AND NEW.status IS NOT NULL THEN
                INSERT INTO public.channel_status_counts (channel_id, status, count)
                VALUES (NEW.channel_id, NEW.status::text, 1)
                ON CONFLICT (channel_id, status) DO UPDATE SET count = channel_status_counts.count + 1;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement old
        IF OLD.channel_id IS NOT NULL AND OLD.status IS NOT NULL THEN
            UPDATE public.channel_status_counts
            SET count = count - 1
            WHERE channel_id = OLD.channel_id AND status = OLD.status::text;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS channel_counts_trigger ON public.threads;
CREATE TRIGGER channel_counts_trigger
AFTER INSERT OR UPDATE OF status OR DELETE ON public.threads
FOR EACH ROW EXECUTE FUNCTION maintain_channel_status_counts();

-- Backfill Data 
INSERT INTO public.channel_status_counts (channel_id, status, count)
SELECT channel_id, status, count(*) as count
FROM public.threads
WHERE channel_id IS NOT NULL AND status IS NOT NULL
GROUP BY channel_id, status
ON CONFLICT (channel_id, status) DO UPDATE SET count = EXCLUDED.count;
