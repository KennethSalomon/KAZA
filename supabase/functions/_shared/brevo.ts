/**
 * Envoi d'emails transactionnels via l'API Brevo (Sendinblue).
 * Silencieusement désactivé si BREVO_API_KEY n'est pas configuré (dev local).
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) return false;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: {
        email: Deno.env.get('BREVO_SENDER_EMAIL') ?? 'kaza@example.com',
        name: Deno.env.get('BREVO_SENDER_NAME') ?? 'KAZA.BJ',
      },
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
    }),
  });
  return res.ok;
}

export function layoutEmail(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string): string {
  const cta = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;background:#D4AF37;color:#0F172A;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin-top:16px;">${ctaLabel ?? 'Voir sur KAZA'}</a>`
    : '';
  return `
    <div style="font-family:Arial,sans-serif;background:#0F172A;padding:32px;color:#F8FAFC;">
      <div style="max-width:560px;margin:0 auto;background:#1E293B;border:1px solid #334155;border-radius:12px;padding:32px;">
        <div style="color:#D4AF37;font-weight:800;font-size:22px;letter-spacing:1px;">KAZA.BJ</div>
        <h1 style="font-size:18px;margin:16px 0 8px;">${title}</h1>
        <p style="color:#94A3B8;font-size:14px;line-height:1.6;">${bodyHtml}</p>
        ${cta}
        <p style="color:#64748B;font-size:12px;margin-top:24px;">Ce message est envoyé automatiquement depuis la plateforme KAZA.BJ.</p>
      </div>
    </div>`;
}

export function reminderDueIn3Days(tenantName: string, rent: number, dueOn: string, appUrl: string): EmailPayload {
  return {
    to: '',
    subject: 'Échéance de loyer dans 3 jours — KAZA.BJ',
    html: layoutEmail(
      'Échéance de loyer à venir',
      `Bonjour ${tenantName}, votre loyer de <strong>${rent.toLocaleString('fr-FR')} FCFA</strong> arrive à échéance le <strong>${dueOn}</strong>. Pensez à régler avant la date limite.`,
      `${appUrl}/dashboard`,
      'Payer mon loyer',
    ),
  };
}

export function reminderOverdueJ1(tenantName: string, rent: number, overdueDays: number, appUrl: string): EmailPayload {
  return {
    to: '',
    subject: 'Rappel de paiement — KAZA.BJ',
    html: layoutEmail(
      'Loyer en retard',
      `Bonjour ${tenantName}, votre loyer de <strong>${rent.toLocaleString('fr-FR')} FCFA</strong> est en retard de <strong>${overdueDays} jour(s)</strong>. Régularisez rapidement pour éviter une relance du bailleur.`,
      `${appUrl}/dashboard`,
      'Payer mon loyer',
    ),
  };
}

export function reminderOverdueJ7(tenantName: string, rent: number, overdueDays: number, appUrl: string): EmailPayload {
  return {
    to: '',
    subject: 'Loyer en retard de plus de 7 jours — KAZA.BJ',
    html: layoutEmail(
      'Relance bailleur engagée',
      `Bonjour ${tenantName}, votre loyer de <strong>${rent.toLocaleString('fr-FR')} FCFA</strong> est en retard de <strong>${overdueDays} jours</strong>. Une relance a été transmise à votre bailleur. Contactez-le pour convenir d'un échéancier.`,
      `${appUrl}/dashboard`,
      'Voir mon dossier',
    ),
  };
}