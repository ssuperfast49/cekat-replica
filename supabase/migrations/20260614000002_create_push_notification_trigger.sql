create or replace function public.notify_new_inbound_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text := 'https://tgrmxlbnutxpewfmofdx.supabase.co/functions/v1/send-push';
begin
  if new.direction = 'in' and new.role = 'user' then
    perform net.http_post(
      url := v_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'thread_id', new.thread_id,
        'message_id', new.id,
        'message_body', new.body,
        'sender_user_id', case when new.actor_kind = 'agent' then new.actor_id else null end
      )
    );
  end if;
  return null;
end;
$$;

drop trigger if exists tr_notify_new_inbound_message on public.messages;
create trigger tr_notify_new_inbound_message
after insert on public.messages
for each row execute function public.notify_new_inbound_message();

comment on function public.notify_new_inbound_message is 'Fires send-push Edge Function for every incoming customer message. Fire-and-forget via net.http_post.';
