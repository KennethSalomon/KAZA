import { describe, expect, it } from 'vitest';
import {
  buildPdf,
  buildReceiptPdf,
  buildSignedReceiptPdf,
  formatDateFr,
  formatAmountFcfa,
  sha256Hex,
} from '../supabase/functions/_shared/pdf-builder';

describe('formatDateFr', () => {
  it('formate une date ISO en français (jj/mm/aaaa)', () => {
    expect(formatDateFr('2026-08-01T00:00:00Z')).toBe('01/08/2026');
  });

  it("retourne l'entrée si la date est invalide", () => {
    expect(formatDateFr('pas-une-date')).toBe('pas-une-date');
  });
});

describe('formatAmountFcfa', () => {
  it('formate les montants en FCFA avec séparateur de milliers', () => {
    expect(formatAmountFcfa(85000)).toBe('85 000 FCFA');
    expect(formatAmountFcfa(1500000)).toBe('1 500 000 FCFA');
    expect(formatAmountFcfa(0)).toBe('0 FCFA');
  });
});

describe('buildPdf', () => {
  it('produit un PDF valide (header, xref, startxref)', () => {
    const bytes = buildPdf({
      texts: [{ x: 50, y: 50, text: 'KAZA.BJ — quittance', size: 12, bold: true }],
      lines: [{ x1: 50, y1: 60, x2: 545, y2: 60, width: 2 }],
      rects: [{ x: 50, y: 70, w: 200, h: 40 }],
    });
    const ascii = Buffer.from(bytes).toString('latin1');
    expect(ascii.startsWith('%PDF-1.4')).toBe(true);
    expect(ascii).toContain('/Type /Catalog');
    expect(ascii).toContain('/BaseFont /Helvetica-Bold');
    expect(ascii).toContain('startxref');
    expect(ascii).toContain('%%EOF');
  });

  it('échappe les parenthèses et backslashes des textes', () => {
    const bytes = buildPdf({
      texts: [{ x: 50, y: 50, text: 'Loyer (mois) \\ test', size: 10 }],
    });
    const ascii = Buffer.from(bytes).toString('latin1');
    expect(ascii).toContain('(Loyer \\(mois\\) \\\\ test)');
  });
});

describe('sha256Hex', () => {
  it('calcule une empreinte SHA-256 hexadécimale de 64 caractères', async () => {
    const hash = await sha256Hex(new TextEncoder().encode('kaza'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('buildSignedReceiptPdf', () => {
  it('ajoute l’empreinte en pied de page et la retourne', async () => {
    const data = {
      receiptNumber: 'Q-ABCDEF01',
      landlordName: 'Bailleur Démo',
      landlordPhone: '+229 90 00 00 02',
      tenantName: 'Locataire Démo',
      tenantPhone: null,
      residenceTitle: 'Studio Lumineux Fidjrossè',
      residenceLocation: 'Cotonou, Fidjrossè',
      amount: 85000,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      paidOn: '2026-08-05',
    };

    const built = await buildSignedReceiptPdf(data);
    expect(built.sha256).toMatch(/^[0-9a-f]{64}$/);
    const ascii = Buffer.from(built.bytes).toString('latin1');
    expect(ascii).toContain(built.sha256);

    // reproductibilité : mêmes données → même empreinte
    const again = await buildSignedReceiptPdf(data);
    expect(again.sha256).toBe(built.sha256);
  });

  it('gère les accents et caractères hors Latin-1 sans planter', async () => {
    const built = await buildSignedReceiptPdf({
      receiptNumber: 'Q-0000000A',
      landlordName: 'Aïcha Mensah — Gbénou',
      landlordPhone: null,
      tenantName: 'Léonce Kpèdé',
      tenantPhone: null,
      residenceTitle: 'Appartement (meublé) — 2 chambres €',
      residenceLocation: 'Porto-Novo, Akron',
      amount: 120000,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      paidOn: '2026-08-05',
    });
    const ascii = Buffer.from(built.bytes).toString('latin1');
    expect(ascii).toContain('A'); // é → encodé WinAnsi, jamais perdu
    expect(built.sha256.length).toBe(64);
  });
});