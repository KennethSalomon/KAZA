'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, Trash2 } from 'lucide-react';
import { createResidence, updateResidence, ApiError } from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-client';
import type { ResidenceWithRelations, ResidenceType } from '@/lib/types';
import { TYPE_LABELS } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

const initial = {
  title: '',
  description: '',
  type: 'appartement' as ResidenceType,
  price_monthly: '',
  charges_monthly: '0',
  deposit: '',
  bedrooms: '1',
  bathrooms: '1',
  surface: '',
  address: '',
  city: 'Cotonou',
  zone: '',
};

const MAX_PHOTOS = 12;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 Mo

function validateForm(form: typeof initial): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (!form.title.trim()) {
    errors.title = ['Le titre est requis'];
  } else if (form.title.trim().length < 3) {
    errors.title = ['Le titre doit contenir au moins 3 caractères'];
  }

  if (!form.price_monthly || Number(form.price_monthly) <= 0) {
    errors.price_monthly = ['Le loyer mensuel doit être supérieur à 0'];
  }

  // note : les charges sont facultatives mais ne peuvent pas être négatives.
  if (form.charges_monthly && Number(form.charges_monthly) < 0) {
    errors.charges_monthly = ['Les charges ne peuvent pas être négatives'];
  }

  const deposit = Number(form.deposit || 0);
  const price = Number(form.price_monthly || 0);
  if (deposit > price * 3) {
    errors.deposit = ['La caution ne peut pas dépasser 3 mois de loyer (Loi 2022-30)'];
  }

  if (Number(form.bedrooms) < 0) {
    errors.bedrooms = ['Le nombre de chambres ne peut pas être négatif'];
  }

  if (Number(form.bathrooms) < 0) {
    errors.bathrooms = ['Le nombre de salles de bain ne peut pas être négatif'];
  }

  if (!form.city.trim()) {
    errors.city = ['La ville est requise'];
  }

  if (!form.zone.trim()) {
    errors.zone = ['Le quartier / zone est requis'];
  }

  return errors;
}

export function ResidenceForm({ existing }: Readonly<{ existing?: ResidenceWithRelations | null }>) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(() =>
    existing
      ? {
          title: existing.title,
          description: existing.description ?? '',
          type: existing.type,
          price_monthly: String(existing.price_monthly),
          charges_monthly: String(existing.charges_monthly ?? 0),
          deposit: String(existing.deposit),
          bedrooms: String(existing.bedrooms),
          bathrooms: String(existing.bathrooms),
          surface: existing.surface != null ? String(existing.surface) : '',
          address: existing.address ?? '',
          city: existing.city ?? '',
          zone: existing.zone ?? '',
        }
      : initial,
  );
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    // Clear error for this field on change
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;

    // Check total photo count limit
    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos autorisées`);
      return;
    }

    const validFiles = Array.from(files).slice(0, remainingSlots);
    if (validFiles.length !== files.length) {
      toast.error(`Maximum ${MAX_PHOTOS} photos autorisées — ${files.length - validFiles.length} ignorée(s)`);
    }

    setUploading(true);
    const bucket = supabase.storage.from('residence-photos');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ownerPrefix = user?.id ?? 'anonymous';

    // Upload in parallel with concurrency limit of 4
    const concurrency = 4;
    for (let i = 0; i < validFiles.length; i += concurrency) {
      const batch = validFiles.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (file) => {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`${file.name} dépasse 8 Mo`);
            return;
          }
          const path = `${ownerPrefix}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
          const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
          if (error) {
            toast.error(`Échec de l'upload de ${file.name}`);
            return;
          }
          setPhotos((p) => [...p, bucket.getPublicUrl(path).data.publicUrl]);
        })
      );
    }
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    const payload = {
      ...form,
      price_monthly: Number(form.price_monthly),
      charges_monthly: Number(form.charges_monthly || 0),
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
    <form onSubmit={submit} className="max-w-3xl space-y-6">
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
                void uploadPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-kaza-faint">Jusqu’à {MAX_PHOTOS} photos, 8 Mo max chacune. La première sert de couverture.</p>
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

      <div>
        <label htmlFor="description" className="kaza-label !text-sm font-semibold !text-kaza-text">
          Description
        </label>
        <textarea
          id="description"
          placeholder="Étages, équipements, proche de…"
          value={form.description}
          onChange={set('description')}
          className="mt-1.5 block min-h-24 w-full rounded-kaza border border-kaza-border bg-white px-3.5 py-2.5 text-sm text-kaza-text placeholder:text-kaza-faint focus:border-kaza-brand focus:outline-none focus:ring-2 focus:ring-kaza-brand/20"
        />
      </div>

      <fieldset className="rounded-kaza border border-kaza-border/70 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-kaza-muted">
          Conditions financières
        </legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Loyer hors charges (FCFA)"
            type="number"
            min={1}
            required
            placeholder="100000"
            value={form.price_monthly}
            onChange={set('price_monthly')}
            error={errors.price_monthly?.[0]}
            hint="Montant du loyer sec, hors charges."
          />
          <Input
            label="Charges (FCFA)"
            type="number"
            min={0}
            placeholder="15000"
            value={form.charges_monthly}
            onChange={set('charges_monthly')}
            error={errors.charges_monthly?.[0]}
            hint="Eau, électricité, ordures — 0 si aucune."
          />
          <Input
            label="Dépôt de garantie (FCFA)"
            type="number"
            min={0}
            placeholder="300000"
            value={form.deposit}
            onChange={set('deposit')}
            hint="Max 3 mois (Loi 2022-30)"
            error={errors.deposit?.[0]}
          />
          <Input
            label="Superficie (m²)"
            type="number"
            min={0}
            placeholder="120"
            value={form.surface}
            onChange={set('surface')}
          />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Chambres" type="number" min={0} value={form.bedrooms} onChange={set('bedrooms')} error={errors.bedrooms?.[0]} />
        <Input label="Salles de bain" type="number" min={0} value={form.bathrooms} onChange={set('bathrooms')} error={errors.bathrooms?.[0]} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Ville" required value={form.city} onChange={set('city')} error={errors.city?.[0]} />
        <Input label="Quartier / zone" required placeholder="Haie Vive, Fidjrossè…" value={form.zone} onChange={set('zone')} error={errors.zone?.[0]} />
      </div>
      <Input label="Adresse précise (facultatif)" value={form.address} onChange={set('address')} hint="Géolocalisation automatique depuis ville + zone (OpenStreetMap)." />

      <Button type="submit" loading={saving} size="lg" className="w-full sm:w-auto">
        {existing ? 'Enregistrer les modifications' : 'Créer le bien'}
      </Button>
    </form>
  );
}