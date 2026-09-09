const fullDateFormatter = new Intl.DateTimeFormat('fr-BJ', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('fr-BJ', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const monthYearFormatter = new Intl.DateTimeFormat('fr-BJ', {
  month: 'long',
  year: 'numeric',
});

export function formatDateFull(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return fullDateFormatter.format(date);
}

export function formatDateShort(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return shortDateFormatter.format(date);
}

export function formatMonthYear(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return monthYearFormatter.format(date);
}

export function getRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;

  return formatDateShort(isoString);
}
