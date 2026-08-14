/**
 * Tiers de relance des impayés — logique pure TypeScript (testable en Vitest).
 * J-3 : rappel amiable avant échéance
 * J+1 : premier retard (notification + email)
 * J+7 : relance avec information du bailleur
 */

export type OverdueTier = 'due_j3' | 'overdue_j1' | 'overdue_j7';

export function overdueTier(daysOverdue: number): OverdueTier {
  if (daysOverdue >= 7) return 'overdue_j7';
  if (daysOverdue >= 1) return 'overdue_j1';
  return 'due_j3';
}

export function isJ7(daysOverdue: number): boolean {
  return overdueTier(daysOverdue) === 'overdue_j7';
}

export function isJ1(daysOverdue: number): boolean {
  return overdueTier(daysOverdue) === 'overdue_j1';
}

/** J-3 : échéance exactement dans 3 jours (relance amiable). */
export function isDueIn3Days(daysBeforeDue: number): boolean {
  return daysBeforeDue === 3;
}

export interface ReminderFacts {
  tier: OverdueTier;
  daysOverdue: number;
  monthlyRent: number;
  dueOn?: string;
}

export function notificationTitle(facts: ReminderFacts): string {
  switch (facts.tier) {
    case 'due_j3':
      return 'Échéance dans 3 jours';
    case 'overdue_j1':
      return 'Loyer en retard';
    case 'overdue_j7':
      return 'Loyer en retard de 7 jours';
  }
}

export function notificationBody(facts: ReminderFacts): string {
  const rent = facts.monthlyRent;
  switch (facts.tier) {
    case 'due_j3':
      return `Votre loyer de ${rent} FCFA arrive à échéance le ${facts.dueOn ?? 'bientôt'}.`;
    case 'overdue_j1':
      return `Votre loyer de ${rent} FCFA est en retard de ${facts.daysOverdue} jour(s).`;
    case 'overdue_j7':
      return `Votre loyer de ${rent} FCFA est en retard de ${facts.daysOverdue} jours. Une relance a été transmise à votre bailleur.`;
  }
}

export function landlordAlertBody(tenantName: string, facts: ReminderFacts): string {
  return `${tenantName} est en retard de ${facts.daysOverdue} jours (${facts.monthlyRent} FCFA).`;
}