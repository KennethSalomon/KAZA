import { describe, expect, it } from 'vitest';
import {
  overdueTier,
  isJ7,
  isJ1,
  isDueIn3Days,
  notificationTitle,
  notificationBody,
  landlordAlertBody,
} from '../supabase/functions/_shared/overdue-tiers';

describe('overdueTier (J-3 / J+1 / J+7)', () => {
  it('classifie les retards selon le nombre de jours', () => {
    expect(overdueTier(0)).toBe('due_j3');
    expect(overdueTier(1)).toBe('overdue_j1');
    expect(overdueTier(6)).toBe('overdue_j1');
    expect(overdueTier(7)).toBe('overdue_j7');
    expect(overdueTier(30)).toBe('overdue_j7');
  });

  it('isJ7 / isJ1', () => {
    expect(isJ7(7)).toBe(true);
    expect(isJ7(6)).toBe(false);
    expect(isJ1(1)).toBe(true);
    expect(isJ1(8)).toBe(false);
  });

  it('isDueIn3Days', () => {
    expect(isDueIn3Days(3)).toBe(true);
    expect(isDueIn3Days(2)).toBe(false);
    expect(isDueIn3Days(4)).toBe(false);
  });
});

describe('contenus de relance', () => {
  it('J-3 : rappel avec date d’échéance', () => {
    const t = notificationTitle({ tier: 'due_j3', daysOverdue: 0, monthlyRent: 85000, dueOn: '2026-08-17' });
    const b = notificationBody({ tier: 'due_j3', daysOverdue: 0, monthlyRent: 85000, dueOn: '2026-08-17' });
    expect(t).toContain('3 jours');
    expect(b).toContain('85000 FCFA');
    expect(b).toContain('2026-08-17');
  });

  it('J+1 : retard simple avec nombre de jours', () => {
    const b = notificationBody({ tier: 'overdue_j1', daysOverdue: 3, monthlyRent: 85000 });
    expect(b).toContain('3 jour');
    expect(b).not.toContain('bailleur');
  });

  it('J+7 : relance avec information du bailleur', () => {
    const b = notificationBody({ tier: 'overdue_j7', daysOverdue: 9, monthlyRent: 85000 });
    expect(b).toContain('9 jours');
    expect(b).toContain('bailleur');
  });

  it('alerte bailleur à J+7', () => {
    expect(landlordAlertBody('Kpèdé', { tier: 'overdue_j7', daysOverdue: 9, monthlyRent: 85000 })).toContain('Kpèdé');
  });
});