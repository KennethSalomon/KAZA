-- ============================================================
-- 002_security_hardening.sql — Correctifs sécurité (audit)
-- 1. Buckets privés (quittances, PJ chat) + policies d'appartenance
-- 2. Expiration des paiements pending (FedaPay jamais rappelé)
-- 3. Garde-fou : montant/confirmation des paiements immutables
-- 4. Notifications : lecture seule (garde-fou)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Buckets privés : plus aucune lecture publique des données
--    personnelles (quittances) ni des PJ de chat.
-- ------------------------------------------------------------
update storage.buckets set public = false where id in ('receipts', 'chat-files');
update storage.buckets set public = true where id = 'residence-photos';

drop policy if exists "receipts-read" on storage.objects;
drop policy if exists "chat-files-read" on storage.objects;

-- Quittances : lecture réservée aux participants du bail (ou admin)
create policy "receipts-read-owner" on storage.objects
  for select using (
    bucket_id = 'receipts' and exists (
      select 1 from public.receipts r
      join public.leases l on l.id = r.lease_id
      where r.file_url like '%' || name
        and (l.tenant_id = auth.uid() or l.landlord_id = auth.uid()
             or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- PJ chat : lecture réservée aux participants des conversations liées
create policy "chat-files-read-owner" on storage.objects
  for select using (
    bucket_id = 'chat-files' and exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
        and exists (select 1 from unnest(m.attachments) a where a like '%' || name)
    )
  );

-- PJ chat : upload réservé à un participant de la conversation
-- (le chemin est préfixé par l'user id de l'expéditeur, qui doit être l'auteur)
drop policy if exists "chat-files-upload" on storage.objects;
create policy "chat-files-upload-participant" on storage.objects
  for insert with check (
    bucket_id = 'chat-files' and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 2. Expiration des paiements pending : une transaction FedaPay
--    jamais rappelée expire au bout de 2 h (scan par overdue-cron).
-- ------------------------------------------------------------
alter table public.payments
  add column if not exists expires_at timestamptz default now() + interval '2 hours';

-- ------------------------------------------------------------
-- 3. Garde-fou : un paiement confirmé ne peut plus être modifié
--    (montant, période, statut, méthodes) — immutabilité totale.
-- ------------------------------------------------------------
create or replace function public.payments_guard_immutable()
returns trigger language plpgsql
as $$
begin
  if old.status = 'confirmed' then
    raise exception 'Un paiement confirmé est immuable' using errcode = '42501';
  end if;
  -- Le statut reste cohérent : confirmed exige confirmed_at
  if new.status = 'confirmed' and new.confirmed_at is null then
    raise exception 'confirmed_at requis pour confirmer' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_before_update on public.payments;
create trigger payments_before_update before update on public.payments
  for each row execute procedure public.payments_guard_immutable();

-- ------------------------------------------------------------
-- 4. Notifications : le destinataire ne modifie que read_at.
-- ------------------------------------------------------------
create or replace function public.notifications_guard_read_only()
returns trigger language plpgsql
as $$
begin
  new.user_id := old.user_id;
  new.title := old.title;
  new.body := old.body;
  new.type := old.type;
  new.data := old.data;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists notifications_before_update on public.notifications;
create trigger notifications_before_update before update on public.notifications
  for each row execute procedure public.notifications_guard_read_only();

-- ------------------------------------------------------------
-- 5. Freemium : le garde-fou INSERT (001_init.sql) est contournable
--    en basculant is_published = true sur un 2e bien
--    -> garde-fou complémentaire sur UPDATE (règle identique).
-- ------------------------------------------------------------
create or replace function public.enforce_freemium_limit_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  p_is_premium boolean;
  p_role public.user_role;
  n int;
begin
  if not new.is_published or old.is_published = new.is_published then
    return new;
  end if;
  select is_premium, role into p_is_premium, p_role from public.profiles where id = auth.uid();
  if coalesce(p_is_premium, false) or coalesce(p_role, 'visiteur') = 'admin' then
    return new;
  end if;
  select count(*) into n from public.residences
   where owner_id = auth.uid() and is_published = true and id <> new.id;
  if n >= 1 then
    raise exception 'Limite du plan gratuit atteinte (1 bien). Passez au Premium.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists residences_before_update on public.residences;
create trigger residences_before_update before update on public.residences
  for each row execute procedure public.enforce_freemium_limit_update();
