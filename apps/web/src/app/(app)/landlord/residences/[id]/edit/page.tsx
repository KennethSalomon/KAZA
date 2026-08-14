'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Rocket, KeyRound } from 'lucide-react';
import {
  getResidence,
  updateResidence,
  createLease,
  listTenants,
  ApiError,
} from '@/lib/supabase-api';
import type { Lease, Profile, Residence } from '@/lib/types';
import { formatXof } from '@/lib/format';
import { ResidenceForm } from '@/components/property/residence-form';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

const STATUS_OPTIONS = [
  { value: 'libre', label: 'Libre' },
  { value: 'occupee', label: 'Occupée' },
  { value: 'en_visite', label: 'En visite' },
  { value: 'maintenance', label: 'En maintenance' },
];

export default function EditResidencePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [residence, setResidence] = useState<Residence | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('libre');
  const [published, setPublished] = useState(false);
  const [leaseModal, setLeaseModal] = useState(false);
  const [tenants, setTenants] = useState<Profile[]>([]);

  useEffect(() => {
    getResidence(id)
      .then((r) => {
        setResidence(r);
        setStatus(r.status);
        setPublished(r.is_published);
      })
      .catch(() => toast.error('Bien introuvable'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const loadTenants = useCallback(async () => {
    const all = await listTenants().catch(() => []);
    setTenants(all);
  }, []);

  async function updateStatus(next: string) {
    setStatus(next);
    try {
      await updateResidence(id, { status: next as Residence['status'] });
      toast.success('Statut mis à jour');
    } catch {
      toast.error('Mise à jour impossible');
      setStatus(residence?.status ?? 'libre');
    }
  }

  async function togglePublish() {
    const next = !published;
    try {
      await updateResidence(id, { is_published: next });
      setPublished(next);
      toast.success(next ? 'Bien envoyé en modération' : 'Bien retiré de la recherche');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Limite du plan gratuit', '1 bien en ligne — passez au Premium pour en publier plus.');
      } else toast.error('Action impossible');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!residence) return null;

  return (
    <div>
      <button onClick={() => router.push('/landlord')} className="mb-5 flex items-center gap-2 text-sm text-kaza-muted hover:text-kaza-text">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Retour à mes biens
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">{residence.title}</h1>
          <p className="mt-1 text-sm text-kaza-muted">
            {residence.zone ?? ''} {residence.city} · {formatXof(residence.price_monthly)}/mois
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setLeaseModal(true)} data-testid="create-lease">
            <KeyRound className="h-4 w-4" aria-hidden />
            Créer un bail
          </Button>
          <Button variant={published ? 'secondary' : 'primary'} onClick={() => void togglePublish()} data-testid="publish-toggle">
            <Rocket className="h-4 w-4" aria-hidden />
            {published ? 'Retirer de la recherche' : 'Publier'}
          </Button>
        </div>
      </div>

      {/* Statut */}
      <div className="mt-5 max-w-xs">
        <Select
          label="Statut du bien"
          value={status}
          onChange={(e) => void updateStatus(e.target.value)}
          options={STATUS_OPTIONS}
        />
        <p className="mt-1.5 text-xs text-kaza-faint">
          Seuls les biens « Libre » apparaissent dans la recherche des locataires.
        </p>
      </div>

      <div className="mt-8">
        <ResidenceForm existing={residence} />
      </div>

      <CreateLeaseModal
        open={leaseModal}
        onClose={() => setLeaseModal(false)}
        residence={residence}
        onLoadTenants={loadTenants}
        tenants={tenants}
        onCreated={() => {
          setLeaseModal(false);
          setStatus('occupee');
          toast.success('Bail créé', 'Le bien est maintenant « Occupée ».');
        }}
      />
    </div>
  );
}

function CreateLeaseModal({
  open,
  onClose,
  residence,
  tenants,
  onLoadTenants,
  onCreated,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  residence: Residence;
  tenants: Profile[];
  onLoadTenants: () => Promise<void>;
  onCreated: () => void;
}>) {
  const toast = useToast();
  const [form, setForm] = useState({ tenant_id: '', start_date: '', end_date: '', monthly_rent: '', deposit: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (open && tenants.length === 0) void onLoadTenants();
    if (open) {
      setForm((f) => ({
        ...f,
        monthly_rent: String(residence.price_monthly),
        deposit: String(residence.deposit),
        start_date: new Date().toISOString().slice(0, 10),
      }));
    }
  }, [open, tenants.length, onLoadTenants, residence]);

  async function handleCreateLease(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      await createLease({
        residence_id: residence.id,
        tenant_id: form.tenant_id,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        monthly_rent: Number(form.monthly_rent),
        deposit: Number(form.deposit || 0),
      });
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else toast.error(err instanceof ApiError ? err.message : 'Bail impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Créer un bail" wide>
      <form onSubmit={(e) => void handleCreateLease(e)} className="space-y-4">
        <Select
          label="Locataire"
          required
          value={form.tenant_id}
          onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}
          options={[
            { value: '', label: 'Choisir un locataire…' },
            ...tenants.map((t) => ({ value: t.id, label: `${t.full_name} — ${t.email ?? t.phone ?? ''}` })),
          ]}
          error={errors.tenant_id?.[0]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Début" type="date" required value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          <Input label="Fin (facultatif)" type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
          <Input
            label="Loyer mensuel (FCFA)"
            type="number"
            required
            value={form.monthly_rent}
            onChange={(e) => setForm((f) => ({ ...f, monthly_rent: e.target.value }))}
            error={errors.monthly_rent?.[0]}
          />
        </div>
        <Input
          label="Caution (FCFA)"
          type="number"
          min={0}
          value={form.deposit}
          onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value }))}
          hint="Maximum 3 mois de loyer (Loi 2022-30 du Bénin)"
          error={errors.deposit?.[0]}
        />
        <p className="text-xs leading-relaxed text-kaza-faint">
          Le bien passera automatiquement en statut « Occupée ». Le locataire pourra payer son loyer et
          recevoir ses quittances signées depuis son espace.
        </p>
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Créer le bail et mettre le bien en location
        </Button>
      </form>
    </Modal>
  );
}