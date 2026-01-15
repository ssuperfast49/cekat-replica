-- Remove public/anon policies present only on main to match development

BEGIN;

-- Drop cron-related public policies
DROP POLICY IF EXISTS cron_job_policy ON public.job;
DROP POLICY IF EXISTS cron_job_run_details_policy ON public.job_run_details;

-- Drop extra public read policies on storage objects
DROP POLICY IF EXISTS "Members read their org assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read of channel profile" ON storage.objects;

COMMIT;
