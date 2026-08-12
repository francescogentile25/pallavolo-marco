// Edge Function: crea un utente (solo admin) senza che si registri prima.
// Verifica che il chiamante sia admin attivo, poi crea l'utente con la service
// role key e attiva il profilo generato dal trigger.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: 'Non autenticato' });

    const { data: prof } = await caller.from('profiles').select('ruolo, attivo').eq('id', userData.user.id).single();
    if (!prof || prof.ruolo !== 'admin' || !prof.attivo) {
      return json(403, { error: 'Solo un amministratore può creare utenti' });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const nome = String(body.nome ?? '').trim();
    const cognome = String(body.cognome ?? '').trim();
    const password = String(body.password ?? '');
    if (!/.+@.+\..+/.test(email) || nome.length < 1 || cognome.length < 1 || password.length < 6) {
      return json(400, { error: 'Dati non validi: email, nome, cognome e password (min 6) obbligatori' });
    }

    const admin = createClient(url, serviceKey);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, cognome, created_by_admin: true },
    });
    if (createErr || !created?.user) return json(400, { error: createErr?.message ?? 'Creazione non riuscita' });

    // Il trigger crea il profilo inattivo: lo attivo subito.
    await admin.from('profiles').update({
      attivo: true,
      registration_completed_at: new Date().toISOString(),
    }).eq('id', created.user.id);

    return json(200, { id: created.user.id });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Errore interno' });
  }
});
