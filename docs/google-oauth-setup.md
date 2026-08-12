# Accesso Google

L'app usa Supabase Auth come intermediario OAuth. Il secret Google non deve
mai essere inserito nel frontend, nelle variabili Vercel o nel repository.

## Google Auth Platform

1. Creare o selezionare un progetto Google Cloud.
2. Configurare Branding, Audience e gli scope `openid`, email e profilo.
3. Creare un client OAuth di tipo **Web application**.
4. Inserire negli **Authorized JavaScript origins**:
   - `https://pallavolo-marco.vercel.app`
   - `http://localhost:4200`
5. Inserire negli **Authorized redirect URIs**:
   - `https://hgsluedylltwrtzcunoj.supabase.co/auth/v1/callback`
   - per Supabase locale: `http://127.0.0.1:54321/auth/v1/callback`

Durante la fase di test, se l'Audience Google e `External` e l'app non e
pubblicata, aggiungere gli indirizzi ammessi nella sezione Test users.

## Dashboard Supabase

In Authentication > Providers > Google:

1. abilitare Google;
2. inserire Client ID e Client Secret ottenuti da Google;
3. salvare.

In Authentication > URL Configuration:

- Site URL: `https://pallavolo-marco.vercel.app`
- Redirect URLs:
  - `https://pallavolo-marco.vercel.app/auth/callback`
  - `http://localhost:4200/auth/callback`
  - `http://127.0.0.1:4200/auth/callback`

## Supabase locale

In `supabase/config.toml`, impostare temporaneamente il client ID e
`enabled = true`. Il secret va passato soltanto tramite ambiente:

```powershell
$env:SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET='<client-secret>'
```

## Pubblicazione del codice

Dopo avere configurato i provider esterni:

1. applicare le migrazioni Supabase;
2. distribuire nuovamente la funzione `admin-create-user`;
3. distribuire il frontend Vercel;
4. provare un nuovo account Google fino alla richiesta della citta;
5. verificare che l'account resti in attesa e che l'admin possa attivarlo.
