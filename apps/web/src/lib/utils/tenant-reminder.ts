// note : ouverture d'un lien WhatsApp deep-link pré-rempli en français pour
// que le bailleur relance manuellement un locataire. Fonctionne sans backend
// (aucune API tierce), donc pas de coût ni de dépendance à un provider SMS.
// Fallback SMS si le device supporte le protocole sms:.

import { formatXof } from '@/lib/format';

export interface TenantReminderContext {
  tenantName?: string | null;
  tenantPhone?: string | null;
  residenceTitle?: string | null;
  monthlyRent?: number | null;
  dueDate?: string | null;
}

function toWhatsappNumber(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!/^\+229\d{10}$/.test(cleaned)) return null;
  // whatsapp attend le numéro sans le +
  return cleaned.slice(1);
}

function buildMessage(ctx: TenantReminderContext): string {
  const parts = [
    `Bonjour ${ctx.tenantName ?? ''}`.trim() + ',',
    '',
    `Petit rappel amical concernant le loyer${ctx.residenceTitle ? ` du bien « ${ctx.residenceTitle} »` : ''}.`,
  ];
  if (ctx.monthlyRent) {
    parts.push(`Montant : ${formatXof(ctx.monthlyRent)}.`);
  }
  if (ctx.dueDate) {
    parts.push(`Échéance : ${ctx.dueDate}.`);
  }
  parts.push('', 'Vous pouvez régler directement dans l’app KAZA. Merci !');
  return parts.join('\n');
}

/** Ouvre WhatsApp (ou SMS en fallback) pour relancer un locataire en retard. */
export function openTenantReminder(ctx: TenantReminderContext): { channel: 'whatsapp' | 'sms' | 'none' } {
  const phone = ctx.tenantPhone ?? '';
  if (!phone) return { channel: 'none' };

  const message = buildMessage(ctx);
  const encoded = encodeURIComponent(message);

  const wa = toWhatsappNumber(phone);
  if (wa) {
    window.open(`https://wa.me/${wa}?text=${encoded}`, '_blank', 'noopener,noreferrer');
    return { channel: 'whatsapp' };
  }

  // Fallback : sms: — supporté sur mobile, ignoré sur desktop
  window.open(`sms:${phone}?body=${encoded}`, '_blank', 'noopener,noreferrer');
  return { channel: 'sms' };
}
