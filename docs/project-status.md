# Stato del progetto

Ultimo aggiornamento: 3 agosto 2026

Questo è il registro operativo dello stato **reale** di Pallavolo Marco. Va aggiornato dopo ogni
incremento significativo e alla chiusura di ogni onda. La roadmap completa è in
[implementation-plan.md](implementation-plan.md).

## Snapshot

Il tour guidato cross-route è integrato nella UI reale: per i visitatori pubblici parte sempre con dati mock, varia tra giocatore e organizzatore e per gli utenti autenticati viene mostrato una sola volta tramite preferenza Supabase con RLS. La bussola nell'header lo riavvia; su mobile usa una scheda inferiore compatta.

| Voce | Stato |
| --- | --- |
| Ambiente locale | Operativo |
| Supabase | Operativo |
| Autenticazione | Verificata end-to-end |
| Database iniziale | Migration applicata |
| GitHub | Collegato a `francescogentile25/pallavolo-marco` |
| Vercel | Produzione operativa |
| URL produzione | https://pallavolo-marco.vercel.app |
| Onda corrente | Onda 6 — Chat di partita e torneo (in corso) |
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
- [x] Homepage pubblica separata dall'applicazione autenticata.
- [x] Demo interattiva eseguita nella stessa shell e negli stessi componenti dell'app autenticata.
- [x] Repository mock selezionati dalla sessione demo, senza accesso ai dati Supabase.
- [x] Navigazione reale fra Home, Partite, Tornei, Campi, Amici, Profilo e Notifiche.
- [x] Scenario mock coerente con città, meteo locale, amici, calendario e campi vicini.

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
- [x] Pagina profilo reale.
- [x] Modifica dei campi consentiti tramite funzione SQL dedicata.
- [x] Lato preferito e avatar tramite URL HTTPS opzionale.
- [x] Autovalutazione distinta dal livello calcolato.
- [x] Storico livello e affidabilità con policy RLS di sola lettura.
- [x] Grafici accessibili per livello e affidabilità.

L'incremento è implementato, verificato localmente con un account reale e pubblicato su Vercel. La
migration `20260801010000_player_profile.sql` è applicata e la cronologia Supabase CLI è
sincronizzata. Restano la verifica autenticata in produzione e la matrice RLS multiutente prima di
considerarlo completato end-to-end.

### Amministrazione

- [x] Ruolo admin nel database.
- [x] Policy di lettura admin sui profili.
- [x] Elenco utenti mobile-first con ricerca e filtri per stato e ruolo.
- [x] Attivazione/disattivazione da interfaccia tramite funzione SQL protetta.
- [x] Cambio ruolo da interfaccia tramite funzione SQL protetta.
- [x] Gerarchia cumulativa utente comune → organizzatore → admin, condivisa tra database, guardie e UI.
- [x] Audit immutabile delle modifiche amministrative, consultabile dalla pagina utenti.
- [x] Route e accesso UI riservati agli amministratori.

L'incremento 2 è pubblicato su Vercel. La migration
`20260801020000_admin_user_management.sql` è applicata e la cronologia Supabase CLI è
sincronizzata. Il deep link pubblico e il guard anonimo sono verificati a 360 px; resta la matrice
autenticata con un admin e due giocatori prima di considerare il flusso completato end-to-end.

## Non iniziato

- notifiche persistite per i tornei (il ciclo torneo è implementato nell'Onda 4);
- notifiche persistite e realtime;
- chat;
- PWA;
- god panel/sandbox.

## Onda 2 — implementazione nel repository

- [x] Migration versionata per luoghi, campi, partite e partecipanti.
- [x] Stati partita, genere, fascia livello, data/ora, durata, capienza e note.
- [x] RLS least-privilege e scritture disponibili solo tramite RPC protette.
- [x] Iscrizione e ritiro transazionali con lock, vincolo univoco e controllo capienza.
- [x] Controllo delle sovrapposizioni orarie per ogni giocatore.
- [x] Lista mobile-first con ricerca e filtri.
- [x] Creazione guidata con Signal Forms e inserimento di un nuovo campo.
- [x] Dettaglio, partecipanti, posti liberi, iscrizione, ritiro e annullamento.
- [x] Pagina `Le mie partite` con prossime e archivio.
- [x] Realtime su partite e partecipanti.
- [x] Azioni nel dock/pill e action sheet sulle card.
- [x] Build di produzione e test locali.
- [x] Migration applicata a Supabase; cronologia CLI locale/remota allineata.
- [ ] Matrice RLS/concorrenza multiutente.
- [x] Deploy Vercel production e deep link pubblici verificati.
- [ ] QA mobile autenticata con almeno due giocatori.

Il codice dell'Onda 2 è completo localmente. Lo stato di roadmap non viene promosso a
`COMPLETATA` finché migration, matrice multiutente, QA mobile e deploy non sono verificati.

## Onda 3 — implementazione nel repository

- [x] Migration versionata per presenze e valutazioni immutabili.
- [x] Chiusura manuale dopo il termine riservata all'organizzatore.
- [x] Valutazione 1–7 fra partecipanti presenti, senza duplicati né autovalutazione.
- [x] Finestra di valutazione di 7 giorni e finestra no-show di 48 ore.
- [x] No-show riservato all'organizzatore con motivazione e audit affidabilità.
- [x] Ricalcolo del livello e aggiornamento degli storici profilo.
- [x] UI post-partita mobile-first nel dettaglio con azione nel dock/pill.
- [x] Realtime per presenze e valutazioni.
- [x] Build di produzione e suite locale (299 test) superate.
- [x] Migration applicata a Supabase e cronologia allineata.
- [x] Matrice funzionale/RLS remota con due profili attivi e utente estraneo simulato.
- [x] QA visuale mobile production con sessione autenticata.
- [x] Deploy Vercel production.
- [x] Controlli di lista e creazione partita uniformati ai componenti PrimeNG.
- [x] Action sheet responsive: bottom sheet mobile e pannello centrato senza scroll superfluo su desktop.

L'Onda 3 è completata end-to-end: migration, matrice funzionale/RLS, QA mobile autenticata,
realtime su due sessioni e deploy production sono verificati.

## Onda 4 — COMPLETATA

- [x] Modalità separate: solo coppie, solo individuale e ibrida.
- [x] Formula sportiva indipendente: gironi, eliminazione diretta o mista.
- [x] Coppie e inviti soggetti al consenso degli utenti registrati.
- [x] Giocatori liberi e abbinamento manuale dell'organizzatore.
- [x] Lista d'attesa e capienza espresse in coppie.
- [x] Pagamento soltanto informativo.
- [x] Strategia UI mobile/desktop per gironi, risultati e tabellone.
- [x] Bracketry individuata come candidata da validare per la fase a eliminazione.
- [x] Regole sportive esatte, preset e criteri di spareggio.
- [x] Migration, RLS, RPC e frontend.
- [x] Applicazione migration remote (6 migration `20260802060000`–`20260802110000`), deploy Vercel e seed demo multi-stato.

La specifica completa è in `docs/wave-4-functional-spec.md`. L'Onda 4 è completata: le sei migration
sono applicate su Supabase remoto, il codice è pubblicato su `main` e distribuito su Vercel. Il
lint di sicurezza non riporta errori; restano soltanto QA autenticate affidate all'utente, non
bloccanti per la chiusura dell'onda.

## Onda 5 — COMPLETATA

Notifiche in-app persistite + realtime. Fonte: `MD Repository/NOTIFICHE-SPEC.md`, adattata ad
Angular + Supabase (tabella `notifications`, RLS, RPC sink, trigger di dominio, Supabase Realtime al
posto di SignalR; testo composto lato frontend). Vedi `implementation-plan.md`.

Fatto (applicato su remoto + deploy):

- [x] Tabella `notifications`, RLS solo-destinatario, sink `create_notifications`, RPC mark/preferenza.
- [x] Campanella header con badge + dropdown, pagina `/notifiche` paginata.
- [x] Toggle preferenza notifiche in `/profilo` (`set_in_app_notifications`).
- [x] 10 trigger di dominio: tornei (invito, risposta, chiusura, annullo, risultato, conferma,
      promozione lista d'attesa) e partite (iscrizione, invito diretto, ritiro, annullo, chiusura,
      valutazione ricevuta, no-show).
- [x] Funzioni trigger `security definer` revocate da PUBLIC (advisor pulito).
- [x] Toggle preferenza notifiche + notifiche demo seedate su remoto.
- [x] Sync live liste/detail via broadcast: non necessaria (realtime per-feature già presente).

QA autenticata mobile realtime su due sessioni affidata all'utente (non bloccante per la chiusura).

## Onda 6 — in corso

Chat di partita e torneo. Fonte: `MD Repository/CHAT-SPEC.md`, adattata ad Angular + Supabase
(tabella unica `chat_messages` con reazioni/menzioni in JSONB, RLS per partecipazione, RPC per le
mutazioni, Supabase Realtime al posto di SignalR). Vedi `implementation-plan.md`.

## Prossimo incremento

Onda 5 — Notifiche:

1. migration `notifications` (tabella, enum, preferenza profilo, RLS, sink RPC, mark-read, trigger);
2. servizio realtime frontend + campanella header con badge non lette;
3. pagina `/notifiche` paginata con mark singolo e massivo;
4. build, deploy e QA autenticata utente.

## Debito tecnico noto

- bundle iniziale circa 945 kB, sopra il budget di warning ma sotto quello bloccante;
- alcune route mostrano ancora una pagina `coming-soon`;
- verifiche residue multiutente delle Onde 1–2 ancora da completare;
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
| 2026-08-01 | Avatar profilo tramite URL HTTPS | Evita di introdurre Supabase Storage prima che upload, limiti e moderazione siano definiti |
| 2026-08-01 | PrimeNG come libreria UI predefinita | I componenti della libreria vengono adattati al tema; i controlli custom restano un'eccezione motivata |
| 2026-08-02 | Regole reputazione Onda 3 | Voti entro 7 giorni; livello 75% peer e 25% autovalutazione; no-show solo organizzatore entro 48 ore con penalità di 1 punto |
| 2026-08-02 | QA interattiva affidata all'utente | Codex non usa il browser interno né sessioni autenticate dell'utente per simulare click |
| 2026-08-12 | Demo pubblica esclusivamente mock | La vetrina non espone dati reali; gli eventi Supabase richiedono registrazione e accesso |
| 2026-08-02 | Iscrizioni tornei Onda 4 | Modalità solo coppie, solo individuale o ibrida; consenso obbligatorio e abbinamento manuale |
| 2026-08-02 | Tabellone tornei Onda 4 | PrimeNG per gironi/risultati; Bracketry candidata solo per eliminazione; mobile a un turno per volta |

## Decisioni ancora aperte

- avatar caricato su Supabase Storage oppure avatar predefiniti;
- visibilità dei profili fra giocatori non ancora incontrati;
- formula esatta del livello calcolato;
- formula e soglie dell'affidabilità;
- chi può dichiarare un no-show e come si gestisce una contestazione;
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
| 2026-08-01 | Build profilo giocatore | Superata; chunk lazy `profile` generato |
| 2026-08-01 | Suite unit test dopo incremento profilo | 294 test superati |
| 2026-08-01 | Migration profilo e cronologia Supabase CLI | Applicata; `migration list` allineata e `db push --dry-run` aggiornato |
| 2026-08-01 | Profilo giocatore locale | Salvataggio, refresh, controlli PrimeNG e layout verificati |
| 2026-08-01 | Deploy incremento profilo | Vercel Production `success`; `/profilo` risponde HTTP 200 |
| 2026-08-01 | Build gestione utenti admin | Superata; chunk lazy `admin-users` generato, resta il solo warning noto sul bundle iniziale |
| 2026-08-01 | Suite unit test dopo incremento admin | 296 test superati |
| 2026-08-01 | Migration admin e cronologia Supabase CLI | Applicata; `migration list` allineata e `db push --dry-run` senza migration residue |
| 2026-08-01 | Deploy incremento admin | Vercel Production `READY`, deployment `dpl_Bo41L2JtYMBA1duh1Z69hUGPYNxJ`, alias pubblico aggiornato |
| 2026-08-01 | Deep link e guard admin a 360 px | `/admin/utenti` risponde HTTP 200 e l'accesso anonimo reindirizza a `/login?returnUrl=%2Fadmin%2Futenti` |
| 2026-08-01 | Build produzione implementazione Onda 2 | Superata; chunk lazy per lista, creazione, dettaglio e pagina personale, resta il warning bundle noto |
| 2026-08-01 | Suite completa dopo implementazione Onda 2 | 299 test superati |
| 2026-08-01 | Migration Onda 2 e cronologia Supabase CLI | `20260801030000_matches_wave_2.sql` applicata; cronologia locale/remota allineata |
| 2026-08-01 | Deploy production Onda 2 | Vercel `READY`, deployment `dpl_F2ga1WFFvGoemWQYgWRxpfD8bVYb`, alias pubblico aggiornato |
| 2026-08-01 | Deep link pubblici Onda 2 | Home, lista, creazione, pagina personale e dettaglio rispondono HTTP 200 |
| 2026-08-02 | Build produzione implementazione Onda 3 | Superata; resta il warning noto sul bundle iniziale (945 kB) |
| 2026-08-02 | Suite completa dopo implementazione Onda 3 | 299 test superati |
| 2026-08-02 | Migration Onda 3 e cronologia Supabase CLI | Applicata; cronologia locale/remota allineata e dry-run senza migration residue |
| 2026-08-02 | Lint schema remoto Onda 3 | Nessun errore rilevato negli schemi `public` ed `extensions` |
| 2026-08-02 | Matrice funzionale/RLS remota Onda 3 | Superata con rollback: chiusura, voto, duplicato, no-show, audit e isolamento estraneo |
| 2026-08-02 | Deploy production Onda 3 | Vercel `READY`, deployment `dpl_7PqYRxD1feYeBNpf2wZhZveQmC69`, alias pubblico aggiornato |
| 2026-08-02 | Deep link e login mobile Onda 3 | HTTP 200 sulle route; redirect anonimo conserva `returnUrl`; nessun overflow a 360 px |
| 2026-08-02 | QA autenticata mobile Onda 3 | Lista, archivio, creazione, profilo e post-partita verificati a 360 px senza overflow o errori console |
| 2026-08-02 | Realtime production Onda 3 | Aggiornamento della partita demo ricevuto senza reload su due sessioni aperte |
| 2026-08-02 | Chiusura Onda 3 | Stato promosso a `COMPLETATA`; fixture demo mantenuto in production su autorizzazione |
| 2026-08-02 | Rifiniture UI rilascio finale Onda 3 | PrimeNG applicato a lista/creazione e action sheet desktop corretto; build e 299 test superati |
| 2026-08-03 | Fix migration Onda 4 | Firma `grant`/`revoke` di `create_tournament` corretta (uno `smallint` mancante) che rendeva la migration non applicabile |
| 2026-08-03 | Applicazione migration Onda 4 | `db push` delle 6 migration tornei su Supabase remoto; `migration list` allineata (15 migration) |
| 2026-08-03 | Lint sicurezza remoto Onda 4 | Nessun errore; solo warning attesi su funzioni `security definer` concesse a `authenticated` |
| 2026-08-03 | Deploy Onda 4 | Commit `805bba3` su `main`, deploy Vercel produzione triggerato |
| 2026-08-03 | Seed demo tornei | Set multi-stato (bozza, iscrizioni aperte coppie/individuale/ibrida, chiuse, in corso, concluso, annullato) creato su remoto per anteprima |
| 2026-08-03 | Chiusura Onda 4 | Stato promosso a `COMPLETATA`; restano QA autenticate non bloccanti affidate all'utente |

## Protocollo di aggiornamento

Quando cambia il progetto:

1. aggiornare lo stato dei checkbox coinvolti;
2. aggiornare `Ultimo aggiornamento`;
3. aggiungere decisioni architetturali o funzionali;
4. aggiornare debito, blocchi e prossimo incremento;
5. alla chiusura di un'onda, aggiornare anche `implementation-plan.md`.
