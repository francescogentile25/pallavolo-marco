# Test di accettazione — chiusura Onda 1

Ultimo aggiornamento: 1 agosto 2026

Questa checklist verifica in produzione il profilo giocatore e la gestione utenti amministrativa.
L'Onda 1 può essere dichiarata `COMPLETATA` solo quando tutti i test obbligatori risultano superati.

## Ambiente e account necessari

- URL: <https://pallavolo-marco.vercel.app>
- un account `admin`, attivo;
- un account `Giocatore A`, attivo;
- un account `Giocatore B`, inizialmente inattivo;
- accesso al Supabase SQL Editor per la matrice RLS;
- viewport mobile impostato a 360 px oppure uno smartphone con larghezza equivalente.

Annotare gli UUID dei tre profili senza inserire password o token in questo documento:

| Identità | UUID | Stato iniziale | Ruolo iniziale |
| --- | --- | --- | --- |
| Admin |  | Attivo | `admin` |
| Giocatore A |  | Attivo | `giocatore` |
| Giocatore B |  | Inattivo | `giocatore` |

Per recuperare gli UUID dal SQL Editor:

```sql
select id, nome, cognome, email, ruolo, attivo
from public.profiles
order by created_at;
```

## 1. Autenticazione e route

### AUTH-01 — Deep link anonimo alla pagina admin

1. Aprire una finestra anonima.
2. Navigare direttamente a `/admin/utenti`.

Risultato atteso:

- la risposta HTTP non è un errore 404;
- l'app reindirizza a `/login?returnUrl=%2Fadmin%2Futenti`;
- la pagina login è leggibile e utilizzabile a 360 px.

Esito: [ ] Superato [ ] Fallito

### AUTH-02 — Giocatore non autorizzato

1. Accedere come Giocatore A.
2. Navigare direttamente a `/admin/utenti`.

Risultato atteso:

- il giocatore viene reindirizzato alla home;
- nell'header non compare l'azione “Gestione utenti”.

Esito: [ ] Superato [ ] Fallito

### AUTH-03 — Accesso amministratore

1. Accedere come Admin.
2. Aprire “Gestione utenti” dall'header.
3. Aggiornare direttamente la pagina `/admin/utenti`.

Risultato atteso:

- la pagina viene caricata sia tramite navigazione sia dopo refresh;
- non compaiono errori in console;
- elenco, filtri e azioni sono visibili.

Esito: [ ] Superato [ ] Fallito

## 2. Profilo giocatore

### PROF-01 — Lettura e layout mobile

1. Accedere come Giocatore A a 360 px.
2. Aprire `/profilo`.
3. Scorrere l'intera pagina.

Risultato atteso:

- nessun contenuto esce orizzontalmente dal viewport;
- nome, email, livello e affidabilità sono leggibili;
- form e grafici non sono coperti dal dock;
- tutti i controlli sono utilizzabili con touch.

Esito: [ ] Superato [ ] Fallito

### PROF-02 — Modifica e persistenza

1. Annotare i valori iniziali del profilo.
2. Modificare nome o cognome, lato preferito e autovalutazione.
3. Salvare.
4. Aggiornare la pagina.
5. Eseguire logout e un nuovo login.

Risultato atteso:

- compare il messaggio di salvataggio riuscito;
- i valori modificati restano presenti dopo refresh e nuovo login;
- `livello` e `affidabilita` non cambiano direttamente;
- lo storico livello contiene un nuovo punto se l'autovalutazione è cambiata.

Esito: [ ] Superato [ ] Fallito

### PROF-03 — Validazione avatar

1. Inserire un URL che inizi con `http://`.
2. Tentare il salvataggio.
3. Inserire un URL HTTPS valido oppure svuotare il campo.

Risultato atteso:

- l'URL non HTTPS viene rifiutato;
- il form mostra un messaggio comprensibile;
- un URL HTTPS valido o il campo vuoto possono essere salvati.

Esito: [ ] Superato [ ] Fallito

### PROF-04 — Ripristino dati

Ripristinare i dati pubblici annotati prima del test, tranne l'autovalutazione se si desidera
conservare il punto storico creato.

Esito: [ ] Completato

## 3. Gestione utenti amministrativa

### ADM-01 — Elenco, ricerca e filtri

1. Accedere come Admin.
2. Aprire `/admin/utenti`.
3. Cercare Giocatore B per nome, cognome e parte dell'email.
4. Provare i filtri `Attivi`, `In attesa`, `Giocatori` e `Amministratori`.
5. Combinare ricerca, stato e ruolo.

Risultato atteso:

- il conteggio dei risultati si aggiorna correttamente;
- ogni filtro mostra solo gli utenti coerenti;
- combinando i filtri non compaiono risultati estranei;
- lo stato vuoto è leggibile quando non esistono corrispondenze.

Esito: [ ] Superato [ ] Fallito

### ADM-02 — Attivazione giocatore

1. Individuare Giocatore B, inizialmente inattivo.
2. Premere “Attiva” e confermare.
3. Accedere in una nuova finestra come Giocatore B.

Risultato atteso:

- lo stato diventa `Attivo` senza usare il SQL Editor;
- compare un messaggio di successo;
- Giocatore B riesce ad accedere all'app.

Esito: [ ] Superato [ ] Fallito

### ADM-03 — Disattivazione giocatore

1. Come Admin, disattivare Giocatore B e confermare.
2. Nella sessione di Giocatore B aggiornare la pagina.
3. Tentare un nuovo login come Giocatore B.

Risultato atteso:

- lo stato diventa `In attesa`;
- dopo refresh la sessione del giocatore non consente più l'accesso protetto;
- un nuovo login mostra il messaggio di profilo in attesa di attivazione.

Esito: [ ] Superato [ ] Fallito

### ADM-04 — Cambio ruolo

1. Riattivare Giocatore B.
2. Cambiarne il ruolo da `giocatore` ad `admin` e confermare.
3. Eseguire un nuovo login come Giocatore B.
4. Verificare l'accesso a `/admin/utenti`.
5. Come Admin originale, ripristinare Giocatore B al ruolo `giocatore`.

Risultato atteso:

- il cambio ruolo è persistito dopo un nuovo login;
- da admin, Giocatore B può aprire la pagina utenti;
- dopo il ripristino non può più accedervi;
- il ruolo finale di Giocatore B è `giocatore`.

Esito: [ ] Superato [ ] Fallito

### ADM-05 — Protezione del proprio account

1. Individuare la card dell'Admin attualmente autenticato.
2. Controllare i comandi di ruolo e attivazione.

Risultato atteso:

- i comandi che potrebbero disattivare o declassare il proprio account sono disabilitati;
- non è possibile causare un self-lockout dalla UI.

Esito: [ ] Superato [ ] Fallito

### ADM-06 — Audit amministrativo

1. Dopo ADM-02, ADM-03 e ADM-04, aprire “Ultime modifiche”.
2. Confrontare le righe con le operazioni appena eseguite.
3. Aggiornare la pagina.

Risultato atteso:

- ogni modifica effettiva genera una riga;
- sono corretti attore, destinatario, data, stato precedente/nuovo e ruolo precedente/nuovo;
- le righe restano presenti dopo refresh;
- un'operazione senza cambiamenti non genera un audit duplicato.

Esito: [ ] Superato [ ] Fallito

### ADM-07 — Layout mobile

1. Aprire `/admin/utenti` come Admin a 360 px.
2. Provare ricerca, filtri, select ruolo, conferme e pulsanti di attivazione.
3. Scorrere fino alla sezione audit.

Risultato atteso:

- nessun overflow orizzontale;
- card, dialog e controlli restano leggibili;
- i target touch sono sufficientemente grandi;
- il dock non copre le ultime righe.

Esito: [ ] Superato [ ] Fallito

## 4. Matrice RLS nel Supabase SQL Editor

Sostituire i placeholder `UUID_GIOCATORE_A`, `UUID_GIOCATORE_B` e `UUID_ADMIN` con gli UUID reali.
Eseguire ogni blocco separatamente. Tutti i blocchi usano `rollback`, quindi non devono lasciare
modifiche nel database.

### RLS-01 — Il giocatore legge soltanto il proprio profilo

```sql
begin;
select set_config('request.jwt.claim.sub', 'UUID_GIOCATORE_A', true);
set local role authenticated;

select id, email, ruolo, attivo
from public.profiles
order by email;

rollback;
```

Risultato atteso: viene restituita una sola riga, quella di Giocatore A.

Esito: [ ] Superato [ ] Fallito

### RLS-02 — Il giocatore non legge gli storici altrui

```sql
begin;
select set_config('request.jwt.claim.sub', 'UUID_GIOCATORE_A', true);
set local role authenticated;

select *
from public.profile_level_history
where profile_id = 'UUID_GIOCATORE_B';

select *
from public.profile_reliability_history
where profile_id = 'UUID_GIOCATORE_B';

rollback;
```

Risultato atteso: entrambe le query restituiscono zero righe.

Esito: [ ] Superato [ ] Fallito

### RLS-03 — Il giocatore non legge l'audit admin

```sql
begin;
select set_config('request.jwt.claim.sub', 'UUID_GIOCATORE_A', true);
set local role authenticated;

select * from public.profile_admin_audit;

rollback;
```

Risultato atteso: la query restituisce zero righe.

Esito: [ ] Superato [ ] Fallito

### RLS-04 — Il giocatore non aggiorna direttamente ruolo o attivazione

```sql
begin;
select set_config('request.jwt.claim.sub', 'UUID_GIOCATORE_A', true);
set local role authenticated;

update public.profiles
set ruolo = 'admin', attivo = true
where id = 'UUID_GIOCATORE_A';

rollback;
```

Risultato atteso: `permission denied` sull'aggiornamento. Dopo l'errore eseguire `rollback;` se la
transazione resta aperta.

Esito: [ ] Superato [ ] Fallito

### RLS-05 — Il giocatore non invoca la funzione amministrativa

```sql
begin;
select set_config('request.jwt.claim.sub', 'UUID_GIOCATORE_A', true);
set local role authenticated;

select public.admin_update_profile_access(
  'UUID_GIOCATORE_B',
  true,
  'admin'::public.user_role
);

rollback;
```

Risultato atteso: errore `Operazione riservata agli amministratori`. Dopo l'errore eseguire
`rollback;` se necessario.

Esito: [ ] Superato [ ] Fallito

### RLS-06 — L'admin legge profili e audit

```sql
begin;
select set_config('request.jwt.claim.sub', 'UUID_ADMIN', true);
set local role authenticated;

select id, email, ruolo, attivo
from public.profiles
order by email;

select *
from public.profile_admin_audit
order by created_at desc;

rollback;
```

Risultato atteso:

- l'Admin vede tutti i profili;
- l'Admin vede le righe di audit create durante i test.

Esito: [ ] Superato [ ] Fallito

### RLS-07 — Il database impedisce il self-lockout

```sql
begin;
select set_config('request.jwt.claim.sub', 'UUID_ADMIN', true);
set local role authenticated;

select public.admin_update_profile_access(
  'UUID_ADMIN',
  false,
  'giocatore'::public.user_role
);

rollback;
```

Risultato atteso: errore `Non puoi modificare il tuo accesso amministrativo`. Dopo l'errore
eseguire `rollback;` se necessario.

Esito: [ ] Superato [ ] Fallito

## 5. Stato finale da ripristinare

Prima di chiudere i test verificare:

- [ ] Admin originale: `attivo = true`, `ruolo = admin`;
- [ ] Giocatore A: `attivo = true`, `ruolo = giocatore`;
- [ ] Giocatore B: stato concordato per l'uso futuro, `ruolo = giocatore`;
- [ ] nessuna password, token o chiave è stata copiata in file o screenshot;
- [ ] nessun errore bloccante è rimasto aperto.

## 6. Riepilogo esecuzione

| Campo | Valore |
| --- | --- |
| Data esecuzione |  |
| Eseguito da |  |
| Browser/dispositivo |  |
| Test superati |  / 21 |
| Test falliti |  |
| Issue aperte |  |
| Esito finale | [ ] Onda 1 approvata [ ] Onda 1 non approvata |

Note e anomalie:

```text

```

## Criterio di chiusura

Se tutti i test risultano superati:

1. aggiornare `docs/project-status.md`;
2. impostare l'Onda 1 a `COMPLETATA` in `docs/implementation-plan.md`;
3. registrare data, dispositivi e risultato nel registro verifiche;
4. eseguire commit e push della chiusura;
5. iniziare l'Onda 2 — campi, creazione e ricerca partite.
