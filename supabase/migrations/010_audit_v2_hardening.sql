-- ============================================================
-- 010_audit_v2_hardening.sql — Correctifs audit v2 (Niveau 1)
-- 1. RPC sensibles : revoke PUBLIC (la grant EXECUTE par défaut de
--    PostgreSQL rendait les revokes `from anon` inopérants) + grants.
-- 2. Storage : policies à correspondance EXACTE du basename
--    (le LIKE suffixe '%' || name était un anti-pattern) ; photos
--    des brouillons invisibles au public.
-- 3. payments_update_landlord : WITH CHECK verrouille l'ownership.
-- 4. messages : kind 'system'/'visit_agreed' réservés au bailleur.
-- 5. FK financières en on delete restrict (anti-destruction de
--    données financières de tiers à la suppression d'un compte).
-- 6. delete_my_account(p_user_id) : anonymisation + blocage auth
--    (la suppression directe de auth.users est désormais impossible
--    à cause des FK restrict — et c'est voulu).
-- ============================================================

-- ------------------------------------------------------------
-- 1. RPC — verrouillage effectif des EXECUTE
-- ------------------------------------------------------------
revoke execute on function public.list_overdue_leases() from public;
revoke execute on function public.list_upcoming_due(int) from public;
revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.list_tenants() from public, anon;
revoke execute on function public.set_my_role(public.user_role) from public, anon;
revoke execute on function public.open_conversation(uuid) from public, anon;
revoke execute on function public.get_residence(uuid) from public, anon;
revoke execute on function public.agree_visit(uuid, boolean, text) from public, anon;
revoke execute on function public.create_lease(uuid, uuid, date, numeric, numeric, date) from public, anon;
revoke execute on function public.terminate_lease(uuid) from public, anon;

grant execute on function public.set_my_role(public.user_role) to authenticated;
grant execute on function public.open_conversation(uuid) to authenticated;
grant execute on function public.get_residence(uuid) to authenticated;
grant execute on function public.agree_visit(uuid, boolean, text) to authenticated;
grant execute on function public.create_lease(uuid, uuid, date, numeric, numeric, date) to authenticated;
grant execute on function public.terminate_lease(uuid) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.list_tenants() to authenticated;
-- list_overdue_leases / list_upcoming_due : service_role uniquement
-- (déjà grantés en 004 ; la suppression du grant PUBLIC suffit).
-- search_residences reste PUBLIC par conception (recherche publique).
-- delete_my_account(uuid) : créée plus bas dans cette migration (la
-- signature uuid n'existe pas avant le create) → revoke/grant placés
-- après le create pour rester valide sur une base repartie de zéro.

-- ------------------------------------------------------------
-- 2. Storage — basename exact + brouillons invisibles
-- ------------------------------------------------------------
drop policy if exists "residence-photos-read" on storage.objects;
create policy "residence-photos-read" on storage.objects
  for select using (
    bucket_id = 'residence-photos' and (
      exists (
        select 1 from public.residences r
        where r.is_published = true and r.is_verified = true
          and exists (select 1 from unnest(r.photos) ph
                      where (regexp_match(ph, '[^/]+$'))[1] = (regexp_match(name, '[^/]+$'))[1])
      )
      or exists (
        select 1 from public.residences r
        where r.owner_id = auth.uid()
          and exists (select 1 from unnest(r.photos) ph
                      where (regexp_match(ph, '[^/]+$'))[1] = (regexp_match(name, '[^/]+$'))[1])
      )
    )
  );

drop policy if exists "chat-files-read-owner" on storage.objects;
create policy "chat-files-read-owner" on storage.objects
  for select using (
    bucket_id = 'chat-files' and exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
        and exists (select 1 from unnest(m.attachments) a
                    where (regexp_match(a, '[^/]+$'))[1] = (regexp_match(name, '[^/]+$'))[1])
    )
  );

drop policy if exists "receipts-read-owner" on storage.objects;
create policy "receipts-read-owner" on storage.objects
  for select using (
    bucket_id = 'receipts' and exists (
      select 1 from public.receipts r
      join public.leases l on l.id = r.lease_id
      where (l.tenant_id = auth.uid() or l.landlord_id = auth.uid()
             or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
        and (regexp_match(r.file_url, '[^/]+$'))[1] = (regexp_match(name, '[^/]+$'))[1]
    )
  );

-- ------------------------------------------------------------
-- 3. payments_update_landlord — ownership verrouillé dans le
--    WITH CHECK (plus de report vers un autre bail / auto-confirmation)
-- ------------------------------------------------------------
drop policy payments_update_landlord on public.payments;
create policy payments_update_landlord on public.payments
  for update using (landlord_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (
    (landlord_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    and (status in ('pending', 'rejected') or (status = 'confirmed' and confirmed_at is not null))
  );

-- ------------------------------------------------------------
-- 4. messages — kind système réservé au bailleur de la conversation
-- ------------------------------------------------------------
create or replace function public.messages_guard_kind()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.kind in ('system', 'visit_agreed') then
    if auth.role() <> 'service_role' then
      if not exists (
        select 1 from public.conversations c
        where c.id = new.conversation_id and c.landlord_id = auth.uid()
      ) then
        raise exception 'Messages système réservés au bailleur' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute procedure public.messages_guard_kind();

-- ------------------------------------------------------------
-- 5. FK financières — on delete restrict (la suppression d'un
--    compte ne peut plus emporter les données financières de tiers)
-- ------------------------------------------------------------
alter table public.leases
  drop constraint if exists leases_tenant_id_fkey,
  add constraint leases_tenant_id_fkey foreign key (tenant_id)
    references public.profiles (id) on delete restrict;
alter table public.leases
  drop constraint if exists leases_landlord_id_fkey,
  add constraint leases_landlord_id_fkey foreign key (landlord_id)
    references public.profiles (id) on delete restrict;
alter table public.payments
  drop constraint if exists payments_tenant_id_fkey,
  add constraint payments_tenant_id_fkey foreign key (tenant_id)
    references public.profiles (id) on delete restrict;
alter table public.payments
  drop constraint if exists payments_landlord_id_fkey,
  add constraint payments_landlord_id_fkey foreign key (landlord_id)
    references public.profiles (id) on delete restrict;
alter table public.receipts
  drop constraint if exists receipts_tenant_id_fkey,
  add constraint receipts_tenant_id_fkey foreign key (tenant_id)
    references public.profiles (id) on delete restrict;
alter table public.receipts
  drop constraint if exists receipts_landlord_id_fkey,
  add constraint receipts_landlord_id_fkey foreign key (landlord_id)
    references public.profiles (id) on delete restrict;

-- ------------------------------------------------------------
-- 6. delete_my_account — anonymisation + blocage (RGPD art. 17)
--    Appelée par l'edge function account-purge avec p_user_id.
--    NB : drop AVANT create (les signatures diffèrent — create or
--    replace ajouterait une seconde fonction au lieu de remplacer).
-- ------------------------------------------------------------
drop function if exists public.delete_my_account();

create or replace function public.delete_my_account(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() <> p_user_id and auth.role() <> 'service_role' then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  delete from public.notifications where user_id = p_user_id;
  delete from public.messages where sender_id = p_user_id;

  update public.profiles
     set email = null,
         phone = null,
         full_name = 'Compte supprimé',
         updated_at = now()
   where id = p_user_id;

  update auth.users
     set email = concat('deleted-', p_user_id::text, '@kaza.bj'),
         raw_user_meta_data = jsonb_build_object('deleted', true),
         banned_until = 'infinity',
         deleted_at = now(),
         updated_at = now()
   where id = p_user_id;
end;
$$;

-- Le create réaccorde EXECUTE à PUBLIC par défaut → on le retire
-- immédiatement (après le create, pour rester valide de zéro).
revoke execute on function public.delete_my_account(uuid) from public, anon;
grant execute on function public.delete_my_account(uuid) to authenticated;

-- Index négligés (audit v2 — section index)
create index if not exists payments_landlord_idx
  on public.payments (landlord_id, created_at desc);
create index if not exists receipts_landlord_idx
  on public.receipts (landlord_id, created_at desc);
create index if not exists receipts_lease_idx on public.receipts (lease_id);
create index if not exists payments_expires_pending_idx
  on public.payments (expires_at) where status = 'pending';