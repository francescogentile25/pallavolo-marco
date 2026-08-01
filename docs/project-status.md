# Stato del progetto

Ultimo aggiornamento: 1 agosto 2026

Questo è il registro operativo dello stato **reale** di Pallavolo Marco. Va aggiornato dopo ogni
incremento significativo e alla chiusura di ogni onda. La roadmap completa è in
[implementation-plan.md](implementation-plan.md).

## Snapshot

| Voce | Stato |
| --- | --- |
| Ambiente locale | Operativo |
| Supabase | Operativo |
| Autenticazione | Verificata end-to-end |
| Database iniziale | Migration applicata |
| GitHub | Collegato a `francescogentile25/pallavolo-marco` |
| Vercel | Produzione operativa |
| URL produzione | https://pallavolo-marco.vercel.app |
| Onda corrente | Onda 1 — Profilo e amministrazione utenti |
| Blocchi correnti | Nessuno |

## Funzionalità completate

### Infrastruttura

- [x] Repository Git dedicato alla sola applicazione frontend.
- [x] Build Angular di produzione.
- [x] Deploy Vercel collegato al branch `main`.
- [x] Variabili `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` su Vercel.
- [x] Rewrite SPA per le route Angular.
- [x] Configurazione URL locale e produzione in Supabase Auth.
- [x] Nessuna chiave `secret` o `service_role` nel frontend.

### Autenticazione e profili

- [x] Registrazione email/password.
- [x] Conferma email.
- [x] Login e logout.
- [x] Ripristino sessione al refresh.
- [x] Route pubbliche e protette.
- [x] Creazione automatica del profilo da `auth.users`.
- [x] Ruoli `admin` e `giocatore`.
- [x] Nuovo profilo inattivo per impostazione predefinita.
- [x] Blocco dell'accesso finché `attivo = true`.
- [x] Primo account amministratore configurato.
- [x] RLS iniziale sulla tabella `profiles`.

### Interfaccia

- [x] Identità visiva Beach Volley Hub.
- [x] Home responsive.
- [x] Login e registrazione mobile-first.
- [x] Header con utente e logout.
- [x] Bottom dock mobile montato nella shell.
- [x] Floating action pill desktop montata nella shell.
- [x] Registro globale delle azioni pagina.
- [x] Placeholder navigabili per partite, tornei, profilo e notifiche.

## Implementazione parziale

### Mobile dock

Stato: struttura principale implementata; specifica non ancora completata integralmente.

- [x] Modello azione e service globale.
- [x] Renderer mobile.
- [x] Renderer desktop.
- [x] Mount unico nella shell.
- [ ] Pagina detail reale che registra azioni contestuali.
- [ ] Action sheet per liste complesse.
- [ ] Varianti label corte e i18n.
- [ ] QA completa safe-area, stacking e screen reader.

### Profilo

- [x] Dati base: nome, cognome, email, ruolo, attivo, livello, affidabilità.
- [x] Lettura del profilo dell'utente autenticato.
- [ ] Pagina profilo reale.
- [ ] Modifica dei campi consentiti.
- [ ] Lato preferito e avatar.
- [ ] Storico livello e affidabilità.
- [ ] Grafici.

### Amministrazione

- [x] Ruolo admin nel database.
- [x] Policy di lettura admin sui profili.
- [ ] Elenco utenti.
- [ ] Attivazione/disattivazione da interfaccia.
- [ ] Cambio ruolo da interfaccia.
- [ ] Audit delle modifiche amministrative.

## Non iniziato

- modello dati e flussi delle partite;
- campi e luoghi;
- iscrizioni alle partite;
- valutazioni post-partita;
- affidabilità/no-show;
- tornei;
- notifiche persistite e realtime;
- chat;
- PWA;
- god panel/sandbox.

## Prossimo incremento

Onda 1, incremento 1: **profilo giocatore modificabile**.

Ordine di lavoro:

1. nuova migration per lato preferito, avatar e storici;
2. funzioni SQL e policy RLS per aggiornamenti sicuri;
3. modelli, service e SignalStore Angular;
4. pagina profilo mobile-first;
5. modifica dati e autovalutazione;
6. registrazione delle azioni nel dock/pill;
7. test con giocatore e admin;
8. deploy e aggiornamento di questo file.

Subito dopo: incremento 2, **gestione utenti per admin**, per eliminare l'attivazione manuale via
SQL Editor.

## Debito tecnico noto

- bundle iniziale circa 905 kB, sopra il budget di warning ma sotto quello bloccante;
- alcune route mostrano ancora una pagina `coming-soon`;
- attivazione utenti ancora manuale tramite SQL;
- manca una suite end-to-end;
- alcune stringhe UI non sono ancora centralizzate in un sistema i18n;
- la Publishable key di sviluppo è nel file environment: è consentito, ma le policy RLS restano
  obbligatorie;
- dominio personalizzato non configurato.

## Decisioni registrate

| Data | Decisione | Motivazione |
| --- | --- | --- |
| 2026-08-01 | Supabase è il backend applicativo | Il progetto non necessita della cartella BE |
| 2026-08-01 | Il progetto Fulgaro è solo riferimento | Nessun codice o segreto Fulgaro viene distribuito |
| 2026-08-01 | Nuovi utenti inattivi | L'accesso richiede approvazione amministrativa |
| 2026-08-01 | Publishable key nel client | È una chiave pubblica; la sicurezza è nelle RLS |
| 2026-08-01 | Mobile-first come vincolo | Il telefono è il canale d'uso principale |
| 2026-08-01 | Sviluppo per onde | Ogni onda deve essere verificabile e distribuibile |
| 2026-08-01 | God panel differito | La specifica .NET richiede una riprogettazione Supabase |

## Decisioni ancora aperte

- avatar caricato su Supabase Storage oppure avatar predefiniti;
- visibilità dei profili fra giocatori non ancora incontrati;
- formula esatta del livello calcolato;
- formula e soglie dell'affidabilità;
- chi può dichiarare un no-show e come si gestisce una contestazione;
- regole complete dei tornei;
- eventuale dominio pubblico personalizzato.

## Registro verifiche

| Data | Verifica | Risultato |
| --- | --- | --- |
| 2026-08-01 | Build Angular sviluppo | Superata |
| 2026-08-01 | Build Angular produzione/Vercel | Superata con warning bundle |
| 2026-08-01 | Registrazione e conferma email | Superata |
| 2026-08-01 | Login locale | Superata |
| 2026-08-01 | Login produzione | Superata |
| 2026-08-01 | Deploy Vercel | `Ready` |

## Protocollo di aggiornamento

Quando cambia il progetto:

1. aggiornare lo stato dei checkbox coinvolti;
2. aggiornare `Ultimo aggiornamento`;
3. aggiungere decisioni architetturali o funzionali;
4. aggiornare debito, blocchi e prossimo incremento;
5. alla chiusura di un'onda, aggiornare anche `implementation-plan.md`.
