// note : Formats monétaires et dates — ré-exports et helpers KAZA
import { formatFCFA } from './currency';
import { formatDateFull, formatDateShort, getRelativeTime } from './date';

export const formatXof = formatFCFA;
export const formatDate = formatDateFull;
export { formatDateShort, getRelativeTime as timeAgo };

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
