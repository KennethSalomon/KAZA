-- ============================================================
-- Migration 030: landlord_dashboard_stats RPC (CORRIGÉ)
-- Statistiques agrégées pour le dashboard bailleur (P0)
-- Corrections:
-- 1. occupied = COUNT(DISTINCT residence_id) FROM leases WHERE status='active'
-- 2. collected_this_month = ventilation proportionnelle par mois couverts (period_start/period_end)
-- 3. upcoming_due_7d aligné sur list_upcoming_due (fenêtre [today, today+7])
-- ============================================================

create or replace function public.landlord_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_result jsonb;
begin
  -- Vérifier l'authentification
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  -- Vérifier le rôle (bailleur ou admin)
  select role into v_role from public.profiles where id = v_uid;
  if v_role not in ('bailleur', 'admin') then
    raise exception 'Accès réservé aux bailleurs' using errcode = '42501';
  end if;

  -- Calculer toutes les stats en une seule requête optimisée
  select jsonb_build_object(
    'total_properties', coalesce(prop_stats.total, 0),
    'occupied', coalesce(prop_stats.occupied, 0),
    'vacant', coalesce(prop_stats.vacant, 0),
    'in_visit', coalesce(prop_stats.in_visit, 0),
    'maintenance', coalesce(prop_stats.maintenance, 0),
    'total_monthly_rent', coalesce(lease_stats.total_monthly_rent, 0),
    'collected_this_month', coalesce(payment_stats.collected_this_month, 0),
    'overdue_total', coalesce(overdue_stats.overdue_total, 0),
    'overdue_count', coalesce(overdue_stats.overdue_count, 0),
    'pending_receipts', coalesce(receipt_stats.pending_count, 0),
    'upcoming_due_7d', coalesce(upcoming_stats.upcoming_count, 0)
  ) into v_result
  from (
    -- Stats des biens du bailleur
    select
      count(*)::int as total,
      -- occupied = nb de logements avec au moins un bail actif
      count(distinct l.residence_id)::int as occupied,
      count(*) filter (where r.status = 'libre')::int as vacant,
      count(*) filter (where r.status = 'en_visite')::int as in_visit,
      count(*) filter (where r.status = 'maintenance')::int as maintenance
    from public.residences r
    left join public.leases l
      on l.residence_id = r.id
     and l.landlord_id = r.owner_id
     and l.status = 'active'
    where r.owner_id = v_uid
  ) prop_stats
  cross join (
    -- Loyer mensuel total des baux actifs
    select coalesce(sum(monthly_rent), 0)::numeric(12,2) as total_monthly_rent
    from public.leases
    where landlord_id = v_uid and status = 'active'
  ) lease_stats
  cross join (
    -- Encaissé ce mois-ci : ventilation proportionnelle des paiements confirmed
    -- sur les mois couverts par period_start / period_end
    select coalesce(sum(allocated_amount), 0)::numeric(12,2) as collected_this_month
    from (
      select
        p.id,
        p.amount,
        p.period_start,
        p.period_end,
        -- Ventilation : montant * (jours dans le mois courant / jours total période)
        p.amount *
        (least(p.period_end, (date_trunc('month', now()) + interval '1 month - 1 day')::date) -
         greatest(p.period_start, date_trunc('month', now())::date) + 1)::numeric /
        nullif((p.period_end - p.period_start + 1)::numeric, 0) as allocated_amount
      from public.payments p
      where p.landlord_id = v_uid
        and p.status = 'confirmed'
        and p.period_start <= (date_trunc('month', now()) + interval '1 month - 1 day')::date
        and p.period_end >= date_trunc('month', now())::date
    ) allocated
  ) payment_stats
  cross join (
    -- Impayés : réutiliser la logique de list_overdue_leases
    select
      coalesce(sum(monthly_rent), 0)::numeric(12,2) as overdue_total,
      count(*)::int as overdue_count
    from public.leases l
    where l.landlord_id = v_uid
      and l.status = 'active'
      and l.date_fn_couverture < current_date
      and not exists (
        select 1 from public.payments p
        where p.lease_id = l.id
          and p.status = 'pending'
          and p.period_end >= l.date_fn_couverture
      )
  ) overdue_stats
  cross join (
    -- Quittances en attente de signature
    select count(*)::int as pending_count
    from public.receipts
    where landlord_id = v_uid
      and status = 'pending_signature'
  ) receipt_stats
  cross join (
    -- Échéances dans les 7 prochains jours : aligné sur list_upcoming_due(7) = fenêtre [today, today+7]
    select count(*)::int as upcoming_count
    from public.leases l
    where l.landlord_id = v_uid
      and l.status = 'active'
      and l.date_fn_couverture >= current_date
      and l.date_fn_couverture <= current_date + 7
  ) upcoming_stats;

  return v_result;
end;
$$;

revoke execute on function public.landlord_dashboard_stats() from public, anon;
grant execute on function public.landlord_dashboard_stats() to authenticated;

-- ============================================================
-- Correction de list_upcoming_due : fenêtre [today, today+N] au lieu d'égalité exacte
-- ============================================================
create or replace function public.list_upcoming_due(window_days int default 7)
returns table (
  lease_id uuid, tenant_id uuid, landlord_id uuid, monthly_rent numeric, due_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select l.id, l.tenant_id, l.landlord_id, l.monthly_rent, l.date_fn_couverture
  from public.leases l
  where l.status = 'active'
    and l.date_fn_couverture >= current_date
    and l.date_fn_couverture <= current_date + window_days
  order by l.date_fn_couverture asc;
end;
$$;

revoke execute on function public.list_upcoming_due(int) from public, anon;
grant execute on function public.list_upcoming_due(int) to authenticated;

-- Index de performance pour les requêtes du dashboard (si pas déjà existants)
create index if not exists payments_landlord_confirmed_month_idx
  on public.payments (landlord_id, status, period_start, period_end)
  where status = 'confirmed';

create index if not exists leases_landlord_active_due_idx
  on public.leases (landlord_id, status, date_fn_couverture)
  where status = 'active';

create index if not exists receipts_landlord_pending_idx
  on public.receipts (landlord_id, status)
  where status = 'pending_signature';

create index if not exists residences_owner_status_idx
  on public.residences (owner_id, status);

-- Index pour la jointure leases->residences dans le dashboard
create index if not exists leases_landlord_active_residence_idx
  on public.leases (landlord_id, residence_id)
  where status = 'active';