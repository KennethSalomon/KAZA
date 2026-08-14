/**
 * Générateur de PDF minimal — 100 % autonome (aucune dépendance).
 * A4 (595.28 x 841.89 pt), Helvetica, encodage WinAnsi, signature visuelle
 * + empreinte SHA-256 (WebCrypto : disponible en Deno, Node ≥ 18 et navigateur).
 * Pur TypeScript : testable directement en Vitest.
 */

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

export interface PdfTextSpec {
  x: number;
  /** Distance depuis le haut de la page (pt) */
  y: number;
  text: string;
  size?: number;
  bold?: boolean;
  color?: readonly [number, number, number];
}

export interface PdfRectSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  color?: readonly [number, number, number];
}

export interface PdfLineSpec {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
  color?: readonly [number, number, number];
}

export interface PdfSpec {
  texts: PdfTextSpec[];
  rects?: PdfRectSpec[];
  lines?: PdfLineSpec[];
}

export interface BuiltPdf {
  bytes: Uint8Array;
  sha256: string;
}

const FALLBACKS: Record<string, string> = {
  'œ': 'oe', 'Œ': 'OE', 'æ': 'ae', 'Æ': 'AE',
  '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...',
  '–': '-', '—': '-', '€': 'EUR', '°': ' deg', '•': '-',
};

function normalize(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff) {
      out += ch;
    } else {
      out += FALLBACKS[ch] ?? '?';
    }
  }
  return out;
}

function escapePdfString(s: string): string {
  // CR/LF/tabulation : un retour-chariot dans un full_name (champ
  // contrôlé par l'utilisateur) casserait l'opérateur Tj du PDF.
  return s.replace(/[\\()\r\n\t]/g, (m) =>
    m === '\r' || m === '\n' ? ' ' : `\\${m}`);
}

function textBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    out[i] = s.charCodeAt(i) & 0xff;
  }
  return out;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildPdf(spec: PdfSpec): Uint8Array {
  const width = PAGE_W;
  const height = PAGE_H;
  const chunks: Uint8Array[] = [];
  const push = (s: string) => chunks.push(textBytes(s));

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const fontIds = new Map<string, number>();
  const streamOps: string[] = [];

  for (const t of spec.texts) {
    const fontKey = t.bold ? 'F2' : 'F1';
    const [r, g, b] = t.color ?? [24, 26, 32];
    const size = t.size ?? 10;
    const yPdf = height - t.y;
    const text = escapePdfString(normalize(t.text));
    streamOps.push(
      `BT /${fontKey} ${size} Tf ${(r / 255).toFixed(4)} ${(g / 255).toFixed(4)} ${(b / 255).toFixed(4)} rg ${t.x} ${yPdf} Tm (${text}) Tj ET`,
    );
    void fontIds;
  }

  for (const r of spec.rects ?? []) {
    const [rr, rg, rb] = r.color ?? [241, 245, 249];
    const yPdf = height - r.y - r.h;
    streamOps.push(
      `${(rr / 255).toFixed(4)} ${(rg / 255).toFixed(4)} ${(rb / 255).toFixed(4)} rg ${r.x} ${yPdf} ${r.w} ${r.h} re f`,
    );
  }

  for (const l of spec.lines ?? []) {
    const [lr, lg, lb] = l.color ?? [212, 175, 55];
    const width = l.width ?? 1;
    const y1Pdf = height - l.y1;
    const y2Pdf = height - l.y2;
    streamOps.push(
      `${(lr / 255).toFixed(4)} ${(lg / 255).toFixed(4)} ${(lb / 255).toFixed(4)} RG ${width} w ${l.x1} ${y1Pdf} m ${l.x2} ${y2Pdf} l S`,
    );
  }

  const contents = streamOps.join('\n') + '\n';

  // Objets PDF
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`;
  objects[3] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
    `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`;
  objects[4] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[5] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[6] = `<< /Length ${contents.length} >>\nstream\n${contents}endstream`;

  const offsets = new Array<number>(7).fill(0);
  for (let i = 1; i <= 6; i++) {
    offsets[i] = chunks.reduce((sum, c) => sum + c.length, 0);
    push(`${i} 0 obj ${objects[i]} endobj\n`);
  }

  const xrefStart = chunks.reduce((sum, c) => sum + c.length, 0);
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let i = 1; i <= 6; i++) {
    push(`${offsets[i].toString().padStart(10, '0')} 00000 n \n`);
  }
  push(
    `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export interface ReceiptPdfData {
  receiptNumber: string;
  landlordName: string;
  landlordPhone: string | null;
  tenantName: string;
  tenantPhone: string | null;
  residenceTitle: string;
  residenceLocation: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  paidOn: string;
  sha256?: string;
}

const INK: readonly [number, number, number] = [24, 26, 32];
const MUTED: readonly [number, number, number] = [100, 116, 139];
const GOLD: readonly [number, number, number] = [212, 175, 55];
const PANEL: readonly [number, number, number] = [241, 245, 249];

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatAmountFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export function buildReceiptPdf(data: ReceiptPdfData): BuiltPdf {
  const texts: PdfTextSpec[] = [];
  const lines: PdfLineSpec[] = [];
  const rects: PdfRectSpec[] = [];

  // En-tête
  texts.push({ x: 50, y: 58, text: 'KAZA.BJ', size: 20, bold: true, color: GOLD });
  texts.push({ x: 50, y: 74, text: 'Quittance de loyer', size: 13, bold: true });
  texts.push({ x: 545, y: 58, text: 'N° ' + data.receiptNumber, size: 10, bold: true });
  lines.push({ x1: 50, y1: 88, x2: 545, y2: 88, width: 2, color: GOLD });

  // Bailleur / Locataire
  texts.push({ x: 50, y: 122, text: 'BAILLEUR', size: 8, color: MUTED });
  texts.push({ x: 50, y: 138, text: data.landlordName, size: 12, bold: true });
  if (data.landlordPhone) {
    texts.push({ x: 50, y: 154, text: data.landlordPhone, size: 9, color: MUTED });
  }
  texts.push({ x: 305, y: 122, text: 'LOCATAIRE', size: 8, color: MUTED });
  texts.push({ x: 305, y: 138, text: data.tenantName, size: 12, bold: true });
  if (data.tenantPhone) {
    texts.push({ x: 305, y: 154, text: data.tenantPhone, size: 9, color: MUTED });
  }

  // Bien
  texts.push({ x: 50, y: 196, text: 'BIEN LOUÉ', size: 8, color: MUTED });
  texts.push({ x: 50, y: 212, text: data.residenceTitle, size: 12, bold: true });
  if (data.residenceLocation) {
    texts.push({ x: 50, y: 228, text: data.residenceLocation, size: 9, color: MUTED });
  }

  // Montant
  rects.push({ x: 50, y: 258, w: 495, h: 66, color: PANEL });
  texts.push({ x: 66, y: 276, text: 'Montant payé', size: 9, color: MUTED });
  texts.push({ x: 66, y: 300, text: formatAmountFcfa(data.amount), size: 17, bold: true, color: GOLD });
  texts.push({
    x: 529, y: 300, text: `Du ${formatDateFr(data.periodStart)} au ${formatDateFr(data.periodEnd)}`,
    size: 9, color: MUTED, bold: false,
  });

  // Mention légale
  texts.push({ x: 50, y: 356, text: 'Objet : paiement du loyer couvrant la période ci-dessus.', size: 10 });
  texts.push({
    x: 50, y: 372,
    text: 'Conforme à la Loi 2022-30 du Bénin — caution plafonnée à 3 mois de loyer.',
    size: 9, color: MUTED,
  });
  texts.push({
    x: 50, y: 388,
    text: `Paiement enregistré sur KAZA.BJ le ${formatDateFr(data.paidOn)}.`,
    size: 9, color: MUTED,
  });

  // Zone de signature visuelle
  texts.push({ x: 50, y: 640, text: 'Signature du bailleur', size: 8, color: MUTED });
  lines.push({ x1: 50, y1: 668, x2: 300, y2: 668, width: 1, color: [203, 213, 225] });
  texts.push({ x: 50, y: 684, text: data.landlordName, size: 11, bold: true });
  texts.push({ x: 50, y: 700, text: `Le ${formatDateFr(data.paidOn)}`, size: 9, color: MUTED });

  // Pied de page
  texts.push({ x: 50, y: 786, text: 'Document généré par KAZA.BJ — quittance dématérialisée à valeur probante.', size: 8, color: MUTED });
  if (data.sha256) {
    texts.push({ x: 50, y: 800, text: `Empreinte SHA-256 : ${data.sha256}`, size: 7, color: MUTED });
  }

  return {
    bytes: buildPdf({ texts, rects, lines }),
    sha256: '',
  };
}

/**
 * Construit la quittance puis y ajoute son empreinte SHA-256 en pied de page.
 */
export async function buildSignedReceiptPdf(data: ReceiptPdfData): Promise<BuiltPdf> {
  const pre = buildReceiptPdf(data);
  const hash = await sha256Hex(pre.bytes);
  const final = buildReceiptPdf({ ...data, sha256: hash });
  return { bytes: final.bytes, sha256: hash };
}
