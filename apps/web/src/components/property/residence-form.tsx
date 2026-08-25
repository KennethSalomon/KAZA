'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createResidence, updateResidence, ApiError } from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-client';
import type { ResidenceWithRelations, ResidenceType } from '@/lib/types';
import { useToast } from '@/components/ui/toast';

const PROPERTY_TYPES: { id: ResidenceType; label: string }[] = [
  { id: 'chambre', label: 'Chambre salon' },
  { id: 'appartement', label: 'Appartement' },
  { id: 'villa', label: 'Villa' },
  { id: 'magasin', label: 'Boutique/Bureau' },
];

const NEIGHBORHOODS = ['Haie Vive', 'Fidjrossè', 'Cadjèhoun', 'Akpakpa', 'Menontin', 'Calavi', 'Agla', 'Zogbo'];

const MAX_PHOTOS = 8;
const MAX_FILE_SIZE = 8 * 1024 * 1024;

export function ResidenceForm({ existing }: Readonly<{ existing?: ResidenceWithRelations | null }>) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    type: (existing?.type ?? 'appartement') as ResidenceType,
    price_monthly: existing ? String(existing.price_monthly) : '',
    deposit: existing ? String(existing.deposit) : '',
    bedrooms: existing ? String(existing.bedrooms) : '1',
    bathrooms: existing ? String(existing.bathrooms) : '1',
    surface: existing?.surface != null ? String(existing.surface) : '',
    address: existing?.address ?? '',
    city: existing?.city ?? 'Cotonou',
    zone: existing?.zone ?? 'Haie Vive',
    phone: existing?.owner?.phone ?? '+229 ',
    isWhatsApp: true,
  });

  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos autorisées`);
      return;
    }
    const validFiles = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const bucket = supabase.storage.from('residence-photos');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ownerPrefix = user?.id ?? 'anonymous';

      for (const file of validFiles) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} dépasse 8 Mo`);
          continue;
        }
        const path = `${ownerPrefix}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
        const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
        if (error) {
          toast.error(`Échec de l'upload de ${file.name}`);
          continue;
        }
        const url = bucket.getPublicUrl(path).data.publicUrl;
        setPhotos((prev) => [...prev, url]);
      }
    } catch {
      toast.error('Upload impossible');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Le titre de l’annonce est requis');
      return;
    }
    if (!form.price_monthly || Number(form.price_monthly) <= 0) {
      toast.error('Veuillez entrer un loyer mensuel valide');
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      type: form.type,
      price_monthly: Number(form.price_monthly),
      deposit: Number(form.deposit || 0),
      bedrooms: Number(form.bedrooms || 1),
      bathrooms: Number(form.bathrooms || 1),
      surface: form.surface ? Number(form.surface) : null,
      address: form.address,
      city: form.city,
      zone: form.zone,
      photos,
    };

    try {
      if (existing) {
        await updateResidence(existing.id, payload);
        toast.success('Modifications enregistrées');
      } else {
        const created = await createResidence(payload);
        toast.success('Bien créé avec succès', 'Votre annonce est désormais enregistrée.');
        router.push(`/landlord`);
        return;
      }
      router.push('/landlord');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Enregistrement impossible');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-stack-lg pb-[120px]">
      {/* Photo Upload Horizontal Carousel */}
      <section>
        <h3 className="font-label-lg text-label-lg text-on-surface mb-2 font-semibold">
          Photos du bien ({photos.length}/{MAX_PHOTOS})
        </h3>
        <div className="flex gap-stack-md overflow-x-auto pb-2 hide-scroll">
          {/* Add Photo Card */}
          <label className="w-32 h-32 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-1 flex-shrink-0 bg-surface-container hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-primary text-3xl">
              {uploading ? 'sync' : 'add_a_photo'}
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant text-center px-1">
              {uploading ? 'Chargement...' : 'Ajouter (8 max)'}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              className="sr-only"
              onChange={(e) => void handleUploadPhotos(e.target.files)}
            />
          </label>

          {/* Uploaded Thumbnails */}
          {photos.map((url, idx) => (
            <div key={url} className="w-32 h-32 rounded-xl bg-surface-variant overflow-hidden flex-shrink-0 relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((p) => p !== url))}
                className="absolute top-1.5 right-1.5 w-7 h-7 bg-surface/80 backdrop-blur-sm rounded-full flex items-center justify-center text-error hover:bg-error-container transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Title & Type Selection */}
      <section className="flex flex-col gap-stack-md">
        <div>
          <label htmlFor="title" className="font-label-lg text-label-lg text-on-surface font-semibold block mb-1.5">
            Titre de l'annonce
          </label>
          <input
            id="title"
            type="text"
            required
            placeholder="Ex: Appartement F3 Moderne Haie Vive"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 bg-surface text-on-surface font-body-md focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="font-label-lg text-label-lg text-on-surface font-semibold block mb-2">
            Type de bien
          </label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((pt) => {
              const active = form.type === pt.id;
              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: pt.id }))}
                  className={`px-4 py-2.5 rounded-full font-label-md text-label-md transition-all ${
                    active
                      ? 'bg-primary text-on-primary font-semibold shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {pt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing & Terms */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
        <div>
          <label htmlFor="price" className="font-label-lg text-label-lg text-on-surface font-semibold block mb-1.5">
            Loyer mensuel (FCFA)
          </label>
          <div className="relative">
            <input
              id="price"
              type="number"
              min={1}
              required
              placeholder="Ex: 150000"
              value={form.price_monthly}
              onChange={(e) => setForm((f) => ({ ...f, price_monthly: e.target.value }))}
              className="w-full rounded-xl border border-outline-variant px-4 py-3 bg-surface text-on-surface font-body-md focus:border-primary focus:outline-none"
            />
            <span className="absolute right-4 top-3.5 text-on-surface-variant font-label-md">FCFA/mois</span>
          </div>
        </div>

        <div>
          <label htmlFor="deposit" className="font-label-lg text-label-lg text-on-surface font-semibold block mb-1.5">
            Caution exigée (FCFA)
          </label>
          <input
            id="deposit"
            type="number"
            min={0}
            placeholder="Ex: 450000 (Max 3 mois)"
            value={form.deposit}
            onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value }))}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 bg-surface text-on-surface font-body-md focus:border-primary focus:outline-none"
          />
        </div>
      </section>

      {/* Specs Specs Bedrooms & Bathrooms */}
      <section className="grid grid-cols-2 gap-stack-md">
        <div>
          <label htmlFor="bedrooms" className="font-label-lg text-label-lg text-on-surface font-semibold block mb-1.5">
            Nombre de chambres
          </label>
          <input
            id="bedrooms"
            type="number"
            min={0}
            value={form.bedrooms}
            onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 bg-surface text-on-surface font-body-md focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="bathrooms" className="font-label-lg text-label-lg text-on-surface font-semibold block mb-1.5">
            Salles de bain / Douches
          </label>
          <input
            id="bathrooms"
            type="number"
            min={0}
            value={form.bathrooms}
            onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 bg-surface text-on-surface font-body-md focus:border-primary focus:outline-none"
          />
        </div>
      </section>

      {/* Location Details */}
      <section className="flex flex-col gap-stack-md">
        <div>
          <label htmlFor="zone" className="font-label-lg text-label-lg text-on-surface font-semibold block mb-1.5">
            Quartier / Zone
          </label>
          <select
            id="zone"
            value={form.zone}
            onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 bg-surface text-on-surface font-body-md focus:border-primary focus:outline-none"
          >
            {NEIGHBORHOODS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="address" className="font-label-lg text-label-lg text-on-surface font-semibold block mb-1.5">
            Adresse détaillée (facultatif)
          </label>
          <input
            id="address"
            type="text"
            placeholder="Ex: Rue 2040, près de la pharmacie Haie Vive"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 bg-surface text-on-surface font-body-md focus:border-primary focus:outline-none"
          />
        </div>
      </section>

      {/* Contact Info & WhatsApp Toggle */}
      <section className="flex flex-col gap-stack-md bg-surface-container rounded-xl p-gutter">
        <div>
          <label htmlFor="phone" className="font-label-lg text-label-lg text-on-surface font-semibold block mb-1.5">
            Numéro de téléphone (+229)
          </label>
          <input
            id="phone"
            type="tel"
            required
            placeholder="+229 97 00 00 00"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 bg-surface text-on-surface font-body-md focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-label-lg text-label-lg text-on-surface font-semibold">Actif sur WhatsApp</p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Les locataires pourront vous contacter directement sur WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isWhatsApp: !f.isWhatsApp }))}
            className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
              form.isWhatsApp ? 'bg-primary justify-end' : 'bg-outline-variant justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </section>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-surface shadow-[0px_-4px_16px_rgba(0,0,0,0.06)] p-margin-mobile z-50">
        <div className="max-w-3xl mx-auto">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-on-primary rounded-xl py-3.5 font-label-lg text-label-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-md hover:bg-tertiary disabled:opacity-70"
          >
            {saving ? (
              'Création de l’annonce...'
            ) : (
              <>
                <span>Enregistrer & Publier</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}