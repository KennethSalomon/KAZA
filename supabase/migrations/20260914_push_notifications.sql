-- ============================================================================
-- Emetteur push (Pass 4 - D2) : push cloud-to-device via l'API Expo.
--  - profiles.push_token             : jeton Expo du profil (octet deja present
--                                      en production / dans les types generes)
--  - notifications.push_sent_at      : marqueur de livraison (deduplication)
--  - notifications.push_claimed_at   : claim atomique (lease 5 min)
--  - claim_push_batch                : RPC atomique interne (service_role only)
--  - notifications_push_columns_guard : empêche les clients d'écrire push_sent_at
--  - job pg_cron 'push-emitter'      : scrute les notifications non livrees
--                                      toutes les minutes
-- ============================================================================

-- 1. Jeton de push sur le profil (idempotent pour la fraicheur db reset)
alter table public.profiles add column if not exists push_token text;

create index if not exists profiles_push_token_idx
  on public.profiles (push_token)
  where push_token is not null;

-- 2. Marquage de livraison sur les notifications
alter table public.notifications add column if not exists push_sent_at timestamptz;

-- Index partiel : notifications en attente d'envoi (les plus anciennes d'abord)
create index if not exists notifications_push_pending_idx
  on public.notifications (created_at)
  where push_sent_at is null;

-- 3. Claim atomique (lease 5 min) : empêche l'envoi en double de deux
--    exécutions concurrentes du cron.
alter table public.notifications add column if not exists push_claimed_at timestamptz;

-- 4. RPC interne : claim atomique (seulement service_role)
--    UPDATE ... RETURNING avec FOR UPDATE SKIP LOCKED => une seule invocation
--    remporte chaque notification. Lease de p_lease_seconds (defaut 300 = 5 min).
create or replace function public.claim_push_batch(
  p_batch_size int default 100,
  p_lease_seconds int default 300
)
returns table (
  id uuid,
  user_id uuid,
  type public.notification_type,
  title text,
  body text,
  data jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  -- Belt-and-suspenders : le GRANT ci-dessous suffit, mais cette
  -- verif defence-in-depth interdit tout appel non autorise.
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'claim_push_batch: token de niveau service requis' using errcode = '42501';
  end if;

  return query
    update public.notifications n
       set push_claimed_at = v_now + make_interval(secs => p_lease_seconds)
      from (
        select s.id
          from public.notifications s
         where s.push_sent_at is null
           and (s.push_claimed_at is null or s.push_claimed_at < v_now)
         order by s.created_at asc
         limit p_batch_size
         for update skip locked
      ) c
     where n.id = c.id
     returning n.id, n.user_id, n.type, n.title, n.body, n.data;
end;
$$;

revoke all on function public.claim_push_batch(int, int) from public;
revoke all on function public.claim_push_batch(int, int) from anon, authenticated;
grant execute on function public.claim_push_batch(int, int) to service_role;

-- 5. Garde-fou : empêche les clients (auth'd) de modifier push_sent_at /
--    push_claimed_at sur leurs propres lignes. Les service_role et postgres
--    ne sont pas impactés (edits on completion/release).
create or replace function public.notifications_push_columns_guard()
returns trigger language plpgsql
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    new.push_sent_at    := old.push_sent_at;
    new.push_claimed_at := old.push_claimed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_push_before_update on public.notifications;
create trigger notifications_push_before_update before update on public.notifications
  for each row execute procedure public.notifications_push_columns_guard();

-- 6. Secret du job : genere aleatoirement (idempotent)
--    (md5 est integre a PostgreSQL, pas de dependance a pgcrypto)
insert into public._cron_secrets (name, secret)
values (
  'push-emitter',
  md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text)
)
on conflict (name) do nothing;

-- 7. Planification (si pg_cron est disponible, comme visit-reminders/overdue-cron)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('push-emitter-minutely');
    exception when others then
      null; -- le job n'existait pas
    end;

    perform cron.schedule('push-emitter-minutely', '* * * * *', $cronjob$
      select net.http_post(
        url := coalesce(
          current_setting('app.settings.supabase_url', true),
          (select secret from public._cron_secrets where name = 'supabase_url')
        ) || '/functions/v1/push-emitter',
        headers := jsonb_build_object(
          'x-cron-secret',
          coalesce(
            (select secret from public._cron_secrets where name = 'push-emitter'),
            current_setting('app.settings.cron_secret', true)
          )
        ),
        body := '{}'::jsonb
      );
    $cronjob$);
  else
    raise notice 'pg_cron indisponible -> planning de push-emitter ignore (emetteur a deployer manuellement)';
  end if;
end $$;