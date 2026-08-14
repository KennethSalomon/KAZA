import { handleOptions, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { getAdminClient } from '../_shared/db.ts';
import { buildSignedReceiptPdf, formatDateFr, type BuiltPdf } from '../_shared/pdf-builder.ts';

/**
 * Signature de quittance par le bailleur (ou admin).
 *  - génère le PDF (signature visuelle), calcule l'empreinte SHA-256
 *  - dépose le fichier dans le bucket « receipts »
 *  - met à jour la quittance (signed, signed_by, signature_hash)
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions(req);
  if (req.method !== 'POST') return errorResponse('Méthode non autorisée', 405);

  try {
    const user = await requireUser(req);
    const { receipt_id } = await req.json() as { receipt_id: string };
    if (!receipt_id) return errorResponse('receipt_id requis');

    const supabase = getAdminClient();

    const { data: receipt, error: recErr } = await supabase
      .from('receipts')
      .select('id, amount, period_start, period_end, status, created_at, landlord_id, tenant_id, lease_id')
      .eq('id', receipt_id)
      .maybeSingle();

    if (recErr || !receipt) return errorResponse('Quittance introuvable', 404);
    if (receipt.status === 'signed') return errorResponse('Quittance déjà signée', 409);
    if (receipt.landlord_id !== user.id && user.role !== 'admin') {
      return errorResponse('Seul le bailleur (ou l\'admin) signe les quittances', 403);
    }

    const [leaseRes, landlordRes, tenantRes] = await Promise.all([
      supabase
        .from('leases')
        .select('residence_id')
        .eq('id', receipt.lease_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', receipt.landlord_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', receipt.tenant_id)
        .maybeSingle(),
    ]);

    const residence =
      leaseRes.data?.residence_id != null
        ? (
            await supabase
              .from('residences')
              .select('title, city, zone')
              .eq('id', leaseRes.data.residence_id)
              .maybeSingle()
          ).data
        : null;

    const receiptNumber = `Q-${receipt.id.slice(0, 8).toUpperCase()}`;
    const location = residence
      ? [residence.city, residence.zone].filter(Boolean).join(', ')
      : '';

    const built: BuiltPdf = await buildSignedReceiptPdf({
      receiptNumber,
      landlordName: landlordRes.data?.full_name ?? 'Bailleur',
      landlordPhone: landlordRes.data?.phone ?? null,
      tenantName: tenantRes.data?.full_name ?? 'Locataire',
      tenantPhone: tenantRes.data?.phone ?? null,
      residenceTitle: residence?.title ?? 'Résidence',
      residenceLocation: location,
      amount: Number(receipt.amount),
      periodStart: receipt.period_start,
      periodEnd: receipt.period_end,
      paidOn: receipt.created_at ?? new Date().toISOString(),
    });

    const path = `receipts/${receipt.id}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('receipts')
      .upload(path, built.bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (upErr) return errorResponse(`Upload PDF échoué : ${upErr.message}`, 500);

    const publicUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;

    const { error: updErr } = await supabase
      .from('receipts')
      .update({
        file_url: publicUrl,
        signature_hash: built.sha256,
        signed_by: user.id,
        signed_at: new Date().toISOString(),
        status: 'signed',
      })
      .eq('id', receipt.id);
    if (updErr) return errorResponse('Mise à jour de la quittance échouée', 500);

    return jsonResponse({
      receipt_id: receipt.id,
      file_url: publicUrl,
      signature_hash: built.sha256,
      signed_at: new Date().toISOString(),
      period: `du ${formatDateFr(receipt.period_start)} au ${formatDateFr(receipt.period_end)}`,
    });
  } catch (err) {
    console.error('Erreur signature quittance', err);
    return errorResponse('Erreur interne', 500);
  }
});