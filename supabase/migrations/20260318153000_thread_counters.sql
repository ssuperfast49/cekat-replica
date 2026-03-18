-- Create thread_status_counts table
CREATE TABLE IF NOT EXISTS public.thread_status_counts (
    org_id uuid NOT NULL,
    status text NOT NULL,
    count bigint DEFAULT 0,
    PRIMARY KEY (org_id, status)
);

-- RLS Policies
ALTER TABLE public.thread_status_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users in org" ON "public"."thread_status_counts"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM public.users_profile WHERE user_id = auth.uid()
  )
);

-- Trigger Function
CREATE OR REPLACE FUNCTION maintain_thread_status_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment new status count
    IF TG_OP = 'INSERT' THEN
        IF NEW.org_id IS NOT NULL AND NEW.status IS NOT NULL THEN
            INSERT INTO public.thread_status_counts (org_id, status, count)
            VALUES (NEW.org_id, NEW.status, 1)
            ON CONFLICT (org_id, status) DO UPDATE SET count = thread_status_counts.count + 1;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            -- Decrement old
            IF OLD.org_id IS NOT NULL AND OLD.status IS NOT NULL THEN
                UPDATE public.thread_status_counts
                SET count = count - 1
                WHERE org_id = OLD.org_id AND status = OLD.status;
            END IF;
            
            -- Increment new
            IF NEW.org_id IS NOT NULL AND NEW.status IS NOT NULL THEN
                INSERT INTO public.thread_status_counts (org_id, status, count)
                VALUES (NEW.org_id, NEW.status, 1)
                ON CONFLICT (org_id, status) DO UPDATE SET count = thread_status_counts.count + 1;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement old
        IF OLD.org_id IS NOT NULL AND OLD.status IS NOT NULL THEN
            UPDATE public.thread_status_counts
            SET count = count - 1
            WHERE org_id = OLD.org_id AND status = OLD.status;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS thread_counts_trigger ON public.threads;
CREATE TRIGGER thread_counts_trigger
AFTER INSERT OR UPDATE OF status OR DELETE ON public.threads
FOR EACH ROW EXECUTE FUNCTION maintain_thread_status_counts();

-- Backfill Data (Seed the table with current counts)
-- By grouping existing threads and inserting them
INSERT INTO public.thread_status_counts (org_id, status, count)
SELECT org_id, status, count(*) as count
FROM public.threads
WHERE org_id IS NOT NULL AND status IS NOT NULL
GROUP BY org_id, status
ON CONFLICT (org_id, status) DO UPDATE SET count = EXCLUDED.count;
