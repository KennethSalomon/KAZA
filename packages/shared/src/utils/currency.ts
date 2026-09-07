const xofNumberFormatter = new Intl.NumberFormat('fr-BJ', {
  maximumFractionDigits: 0,
  useGrouping: true,
});

export function formatFCFA(amount: number | string | null | undefined): string {
  const numericValue = typeof amount === 'number' ? amount : Number(amount ?? 0);
  if (Number.isNaN(numericValue)) return '0 FCFA';
  return `${xofNumberFormatter.format(numericValue)} FCFA`;
}

export function parseFCFA(input: string): number {
  const cleaned = input.replace(/[^0-9]/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}
