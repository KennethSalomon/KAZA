/** Formats monétaires et date — locale fr-BJ (FCFA). */
export function formatXof(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return `${n.toLocaleString('fr-FR')} FCFA`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'hier';
  if (d < 7) return `il y a ${d} jours`;
  return formatDateShort(iso);
}

export const STATUS_LABELS: Record<string, string> = {
  libre: 'Libre',
  occupee: 'Occupée',
  en_visite: 'En visite',
  maintenance: 'Maintenance',
};

export const TYPE_LABELS: Record<string, string> = {
  studio: 'Studio',
  chambre: 'Chambre',
  appartement: 'Appartement',
  villa: 'Villa',
  magasin: 'Magasin',
  terrain: 'Terrain',
};

export const PROVIDER_LABELS: Record<string, string> = {
  mtn: 'MTN MoMo',
  moov: 'Moov Money',
  celtiis: 'Celtiis',
  cash: 'Espèces',
};