'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, Trash2 } from 'lucide-react';
import { createResidence, updateResidence, ApiError } from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-client';
import type { Residence, ResidenceType } from '@/lib/types';
import { TYPE_LABELS } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

const initial = {
  title: '',
  description: '',
  type: 'appartement' as ResidenceType,
  price_monthly: '',
  deposit: '',
  bedrooms: '1',
  bathrooms: '1',
  surface: '',
  address: '',
  city: 'Cotonou',
  zone: '',
};

export function ResidenceForm({ existing }: Readonly<{ existing?: Residence | null }>) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(() =>
    existing
      ? {
          title: existing.title,
          description: existing.description ?? '',
          type: existing.type,
          price_monthly: String(existing.price_monthly),
          deposit: String(existing.deposit),
          bedrooms: String(existing.bedrooms),
          bathrooms: String(existing.bathrooms),
          surface: existing.surface != null ? String(existing.surface) : '',
          address: existing.address ?? '',
          city: existing.city,
          zone: existing.zone ?? '',
        }
      : initial,
  );
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const bucket = supabase.storage.from('residence-photos');
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 8 Mo`);
        continue;
      }
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error(`Échec de l'upload de ${file.name}`);
        continue;
      }
      setPhotos((p) => [...p, bucket.getPublicUrl(path).data.publicUrl]);
    }
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    const payload = {
      ...form,
      price_monthly: Number(form.price_monthly),
      deposit: Number(form.deposit || 0),
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      surface: form.surface ? Number(form.surface) : null,
      photos,
    };
    try {
      if (existing) {
        await updateResidence(existing.id, payload);
        toast.success('Bien mis à jour');
      } else {
        const created = await createResidence(payload);
        toast.success('Bien créé', 'Publiez-le depuis votre espace pour le rendre visible.');
        router.push(`/landlord/residences/${created.id}/edit`);
        return;
      }
      router.push('/landlord');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error('Limite du plan gratuit', '1 bien en ligne pour le plan gratuit — passez au Premium.');
        else if (err.fields) setErrors(err.fields);
        else toast.error(err.message);
      } else toast.error('Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-6">
      {/* Photos */}
      <section aria-labelledby="photos-title">
        <h2 id="photos-title" className="kaza-label !text-sm font-semibold !text-kaza-text">
          Photos du bien
        </h2>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p} className="relative h-24 w-32 overflow-hidden rounded-kaza border border-kaza-border">
              <Image src={p} alt="" fill className="object-cover" sizes="128px" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((x) => x !== p))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-kaza-danger text-white"
                aria-label="Retirer la photo"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
          <label
            className="grid h-24 w-32 cursor-pointer place-items-center rounded-kaza border border-dashed border-kaza-border text-kaza-faint transition-colors hover:border-kaza-brand hover:text-kaza-brand"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).click()}
          >
            {uploading ? 'Upload…' : <Upload className="h-5 w-5" aria-hidden />}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              aria-label="Ajouter des photos"
              onChange={(e) => {
                setPendingPhoto(e.target.files?.[0] ?? null);
                void uploadPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-kaza-faint">Jusqu'à 12 photos, 8 Mo max chacune. La première sert de couverture.</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Titre" required placeholder="Ex: Villa 3 chambres Haie Vive" value={form.title} onChange={set('title')} error={errors.title?.[0]} />
        <Select
          label="Type de bien"
          value={form.type}
          onChange={set('type')}
          options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />
      </div>

      <Input
        label="Description"
        placeholder="Étages, équipements, proche de…"
        value={form.description}
        onChange={set('description')}
        className="min-h-24"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Loyer mensuel (FCFA)" type="number" min={0} required placeholder="100000" value={form.price_monthly} onChange={set('price_monthly')} error={errors.price_monthly?.[0]} />
        <Input label="Caution (FCFA)" type="number" min={0} placeholder="300000" value={form.deposit} onChange={set('deposit')} hint="Max 3 mois (Loi 2022-30)" />
        <Input label="Superficie (m²)" type="number" min={0} placeholder="120" value={form.surface} onChange={set('surface')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Chambres" type="number" min={0} value={form.bedrooms} onChange={set('bedrooms')} />
        <Input label="Salles de bain" type="number" min={0} value={form.bathrooms} onChange={set('bathrooms')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Ville" required value={form.city} onChange={set('city')} />
        <Input label="Quartier / zone" required placeholder="Haie Vive, Fidjrossè…" value={form.zone} onChange={set('zone')} />
      </div>
      <Input label="Adresse précise (facultatif)" value={form.address} onChange={set('address')} hint="Géolocalisation automatique depuis ville + zone (OpenStreetMap)." />

      <Button type="submit" loading={saving} size="lg" className="w-full sm:w-auto">
        {existing ? 'Enregistrer les modifications' : 'Créer le bien'}
      </Button>

      {/* préview de la photo en attente (masquée mais conforme à l'upload multi) */}
      {pendingPhoto && <span className="hidden">{pendingPhoto.name}</span>}
    </form>
  );
}