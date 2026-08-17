import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!);

serve(async (req) => {
  const auth = await requireUser(req, supabase);
  if (!auth) return new Response('Unauthorized', { status: 401 });

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Visites confirmées dans 24h (± 1h) ou 2h (± 15min)
  const { data: visits24h } = await supabase
    .from('visits')
    .select('id, conversation_id, slot_start, proposed_by, confirmed_by')
    .eq('status', 'confirmed')
    .gte('slot_start', new Date(in24h.getTime() - 3600000).toISOString())
    .lte('slot_start', new Date(in24h.getTime() + 3600000).toISOString());

  const { data: visits2h } = await supabase
    .from('visits')
    .select('id, conversation_id, slot_start, proposed_by, confirmed_by')
    .eq('status', 'confirmed')
    .gte('slot_start', new Date(in2h.getTime() - 900000).toISOString())
    .lte('slot_start', new Date(in2h.getTime() + 900000).toISOString());

  const allVisits = [...(visits24h ?? []), ...(visits2h ?? [])];

  for (const v of allVisits) {
    const hoursLeft = Math.round((new Date(v.slot_start).getTime() - now.getTime()) / 3600000);
    const label = hoursLeft <= 2 ? '2 heures' : '24 heures';

    // Notif locataire
    await supabase.from('notifications').insert({
      user_id: v.proposed_by,
      type: 'visit',
      title: `Rappel visite dans ${label}`,
      body: `Votre visite est prévue ${label}.`,
      data: { visit_id: v.id, conversation_id: v.conversation_id },
    });

    // Notif bailleur
    if (v.confirmed_by) {
      await supabase.from('notifications').insert({
        user_id: v.confirmed_by,
        type: 'visit',
        title: `Rappel visite dans ${label}`,
        body: `Vous recevez un locataire ${label}.`,
        data: { visit_id: v.id, conversation_id: v.conversation_id },
      });
    }

    // Email Brevo (optionnel, via app_settings)
    // TODO: appeler sendEmail si configuré
  }

  return new Response(JSON.stringify({ processed: allVisits.length }), { status: 200 });
});