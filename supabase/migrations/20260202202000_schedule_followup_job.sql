-- Schedule the cron job to run every minute
select cron.schedule(
  'process-followups-every-minute',
  '* * * * *',
  $$
  select net.http_post(
      url:='https://tgrmxlbnutxpewfmofdx.supabase.co/functions/v1/process-followups',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Note: We do not include Authorization header because verify_jwt is false for this function.
-- Access is restricted by the function itself only checking/updating DB, not allowing arbitrary inputs.
