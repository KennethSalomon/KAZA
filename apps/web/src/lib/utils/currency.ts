// note : Formatage monétaire officiel Bénin / UEMOA (Franc CFA - XOF)
const xofNumberFormatter = new Intl.NumberFormat('fr-BJ', {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/**
 * Formate un montant numérique ou chaîne en devise locale FCFA.
 * Exemple : formatFCFA(250000) -> "250 000 FCFA"
 */
export function formatFCFA(amount: number | string | null | undefined): string {
  const numericValue = typeof amount === 'number' ? amount : Number(amount ?? 0);
  if (Number.isNaN(numericValue)) return '0 FCFA';
  return `${xofNumberFormatter.format(numericValue)} FCFA`;
}

/**
 * Extrait un entier propre depuis une chaîne avec espaces ou symboles.
 * Exemple : parseFCFA("250 000 FCFA") -> 250000
 */
export function parseFCFA(input: string): number {
  const cleaned = input.replace(/[^0-9]/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}
