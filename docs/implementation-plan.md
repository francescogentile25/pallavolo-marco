# Piano di implementazione

Ultimo aggiornamento: 2 agosto 2026

Questo documento descrive la roadmap funzionale di Pallavolo Marco. Il lavoro procede per
**onde**: ogni onda deve produrre un incremento utilizzabile, verificato su mobile e pubblicato
in produzione prima di iniziare la successiva.

Lo stato operativo corrente, i blocchi e il prossimo passo sono registrati in
[project-status.md](project-status.md).

## Regole di avanzamento

- Una sola onda può essere `IN CORSO`.
- Ogni modifica al database nasce come migration versionata in `supabase/migrations`.
- Ogni onda termina con build, test manuali mobile, deploy Vercel e aggiornamento dello status.
- La QA interattiva autenticata viene eseguita dall'utente: Codex non usa il browser interno né
  riutilizza credenziali o sessioni dell'utente per simulare click.
- Le funzionalità di scrittura devono avere policy RLS e invarianti database prima della UI.
- Le azioni principali devono essere raggiungibili con una mano e integrate nel mobile dock.
- Le specifiche tecniche sono adattate allo stack reale: Angular + Supabase, senza backend .NET.
- Una funzionalità è `COMPLETATA` solo quando funziona end-to-end in produzione.

## Legenda

| Stato | Significato |
| --- | --- |
| `COMPLETATA` | Implementata, verificata e pubblicata |
| `IN CORSO` | Onda attiva |
| `IN VERIFICA` | Implementata; restano verifiche end-to-end o di rilascio |
| `PRONTA` | Requisiti sufficienti per iniziare |
| `DA DEFINIRE` | Richiede decisioni funzionali |
| `DIFFERITA` | Fuori dall'MVP attuale |

## Onda 0 — Fondazioni

Stato: `COMPLETATA`

Obiettivo: rendere disponibile un'app mobile-first autenticata, con backend Supabase e deploy
continuo su Vercel.

Deliverable:

- progetto Angular standalone;
- tema Beach Volley Hub e home responsive;
- Supabase client configurato;
- registrazione e login email/password;
- conferma email e persistenza della sessione;
- profilo collegato a `auth.users`;
- ruoli `admin` e `giocatore`;
- attivazione obbligatoria del profilo;
- route guard per pagine pubbliche e protette;
- RLS iniziale sulla tabella `profiles`;
- shell mobile con bottom dock e controparte desktop;
- repository GitHub e deploy Vercel.

Criteri di accettazione raggiunti:

- registrazione, conferma email e login funzionano;
- un profilo inattivo non può accedere;
- aggiornando una pagina protetta la sessione resta valida;
- l'app è raggiungibile da telefono tramite Vercel.

## Onda 1 — Profilo giocatore e amministrazione utenti

Stato: `IN VERIFICA`

Obiettivo: rendere il profilo personale la base affidabile per partite e tornei.

### Database

- estendere `profiles` con lato preferito, avatar e informazioni pubbliche essenziali;
- distinguere autovalutazione e livello calcolato;
- creare lo storico delle variazioni di livello;
- creare lo storico dell'affidabilità;
- aggiungere funzioni SQL sicure per gli aggiornamenti consentiti all'utente;
- mantenere ruolo, attivazione e affidabilità modificabili solo da funzioni autorizzate/admin.

Scala livello iniziale:

| Valore | Fascia |
| --- | --- |
| 1–2 | Principiante |
| 3–4 | Intermedio |
| 5 | Intermedio avanzato |
| 6 | Avanzato |
| 7 | Pro player |

### Frontend

- pagina profilo mobile-first;
- modifica nome, cognome, lato preferito, avatar e autovalutazione;
- indicatore livello corrente;
- indicatore affidabilità;
- grafico storico valutazioni;
- pagina admin utenti;
- ricerca e filtro utenti;
- attivazione/disattivazione profilo;
- assegnazione ruolo;
- ruoli cumulativi: utente comune, organizzatore e amministratore;
- organizzazione tornei riservata a organizzatori e amministratori;
- azioni contestuali nel dock/pill.

### Criteri di accettazione

- un giocatore modifica solo i propri campi consentiti;
- non può auto-attivarsi, cambiare ruolo o alterare direttamente l'affidabilità;
- un admin attiva un nuovo utente senza usare il SQL Editor;
- il profilo è leggibile e utilizzabile a 360 px di larghezza;
- storico e valori correnti sono coerenti dopo un refresh.

## Onda 2 — Campi, creazione e ricerca partite

Stato: `IN VERIFICA`

Obiettivo: completare il flusso principale `crea → trova → partecipa`.

### Database

- anagrafica luoghi/campi;
- tabella `matches`;
- tabella partecipanti;
- stato partita: bozza, aperta, completa, in corso, conclusa, annullata;
- genere ammesso: maschile, femminile, misto;
- fascia di livello ammessa;
- data, ora, durata, posti e note;
- vincoli anti-doppia-iscrizione e capienza;
- RLS e funzioni transazionali per iscrizione/ritiro.

### Frontend

- lista partite con ricerca e filtri;
- card ottimizzate per mobile;
- creazione guidata di una partita;
- dettaglio partita;
- iscrizione e ritiro;
- elenco partecipanti e posti disponibili;
- pagina personale `Le mie partite`;
- aggiornamento in tempo reale dei posti;
- azioni pagina integrate nel mobile dock;
- action sheet per le azioni sulle card.

### Criteri di accettazione

- due utenti non possono occupare l'ultimo posto contemporaneamente;
- non è possibile iscriversi due volte;
- creatore e partecipanti vedono lo stesso stato senza refresh manuale;
- i filtri fondamentali funzionano da mobile;
- un link diretto al dettaglio funziona dopo refresh su Vercel.

## Onda 3 — Chiusura partita, valutazioni e affidabilità

Stato: `COMPLETATA`

Obiettivo: trasformare le partite concluse in reputazione utile e verificabile.

### Database

- chiusura e conferma della partita;
- valutazioni da 1 a 7 per compagni e avversari;
- una sola valutazione per coppia valutatore/valutato/partita;
- divieto di autovalutazione;
- finestra temporale per votare;
- calcolo del livello aggregato;
- segnalazione presenza, assenza e no-show;
- eventi di affidabilità con motivazione;
- funzioni SQL che impediscano manipolazioni dal client.

### Frontend

- riepilogo partita conclusa;
- flusso di valutazione rapido da cellulare;
- stato delle valutazioni mancanti;
- curva del livello nel profilo;
- storico affidabilità;
- segnalazione no-show con motivazione predefinita;
- feedback chiaro sugli effetti della segnalazione.

### Criteri di accettazione

- si possono valutare solo partecipanti di una partita conclusa;
- nessun voto duplicato o verso sé stessi;
- livello e grafico vengono ricalcolati correttamente;
- ogni modifica di affidabilità è tracciabile;
- le policy impediscono scritture arbitrarie dalla console del browser.

## Onda 4 — Tornei

Stato: `COMPLETATA`

Specifica approvata: [wave-4-functional-spec.md](wave-4-functional-spec.md).

Obiettivo: supportare organizzatori e giocatori nell'intero ciclo di un torneo.

Requisiti già disponibili:

- luogo, orario e durata;
- costo;
- numero di partite garantite;
- livelli ammessi;
- separazione fra esperienza organizzatore e partecipante.

Decisioni principali definite:

- iscrizione configurabile: solo coppie, solo individuale o ibrida;
- coppie proposte da giocatori o organizzatore, sempre soggette a consenso;
- abbinamento manuale con suggerimenti visivi, senza matchmaking automatico;
- formula indipendente: gironi, eliminazione diretta o formato misto;
- capienza e lista d'attesa basate su coppie complete;
- pagamento soltanto informativo;
- PrimeNG per gironi e risultati;
- Bracketry candidata per la sola visualizzazione dell'eliminazione diretta;
- vista mobile a un turno per volta e vista lineare accessibile sempre disponibile.

Le regole sportive, i preset e le combinazioni vietate sono definiti e implementati. Restano le
verifiche remote, la pubblicazione e la QA autenticata dell'utente.

Deliverable previsti:

- creazione e pubblicazione torneo;
- iscrizioni e lista d'attesa;
- gestione partecipanti;
- generazione calendario/tabellone;
- inserimento risultati e classifica;
- vista giocatore e console organizzatore;
- notifiche sugli eventi di torneo.

## Onda 5 — Notifiche in-app e realtime

Stato: `IN CORSO`

Fonte: `MD Repository/NOTIFICHE-SPEC.md`, adattata a Supabase Realtime.

- notifiche persistite;
- badge non lette;
- dropdown nell'header;
- pagina notifiche;
- lettura singola e lettura totale;
- eventi per iscrizioni, ritiri, partite, valutazioni e tornei;
- preferenza utente;
- aggiornamento realtime e recupero dopo disconnessione;
- nessuna notifica all'attore dell'evento.

## Onda 6 — Chat di partita e torneo

Stato: `PRONTA`

Fonte: `MD Repository/CHAT-SPEC.md`, adattata a Supabase Realtime.

- chat associata a partita o torneo;
- messaggi, modifica ed eliminazione soft;
- risposte;
- reazioni;
- menzioni;
- autorizzazione limitata ai partecipanti;
- aggiornamento realtime;
- UX mobile con composer compatibile con tastiera virtuale.

## Onda 7 — Qualità mobile, PWA e osservabilità

Stato: `PRONTA`

- installazione PWA;
- manifest, icone e splash screen;
- comportamento con rete debole e stati di errore;
- accessibilità e touch target;
- test sui principali viewport;
- riduzione del bundle iniziale;
- monitoraggio errori;
- indici database e verifica query;
- backup e procedura di ripristino;
- checklist di rilascio.

## Onda 8 — God panel, impersonazione e sandbox

Stato: `DIFFERITA`

Fonte: `MD Repository/GODPANEL-SPEC.md`.

La specifica originale presuppone un backend .NET, middleware e SignalR. Nel progetto attuale
andrebbe riprogettata con Supabase, Edge Functions e policy dedicate. È esclusa dall'MVP fino a
conferma esplicita del valore funzionale e del modello di sicurezza.

## Requisiti trasversali

### Mobile-first

- progetto e QA partono da 360–430 px;
- safe area iOS rispettata;
- CTA primaria raggiungibile con il pollice;
- niente contenuti coperti dal dock;
- tastiera virtuale verificata sui form;
- desktop come adattamento, non come sorgente del layout.

### Componenti UI

- usare i componenti PrimeNG disponibili per select, input, pulsanti, dialog, tabelle e altri
  controlli interattivi;
- adattare PrimeNG al tema Beach Volley Hub tramite preset, token e classi locali, evitando di
  ricreare componenti nativi già coperti dalla libreria;
- ricorrere a componenti custom solo quando PrimeNG non copre il comportamento o compromette
  l'esperienza mobile richiesta.

### Sicurezza e dati

- mai usare chiavi `secret` o `service_role` nel browser;
- RLS attiva su ogni tabella esposta;
- operazioni sensibili tramite funzioni SQL/Edge Functions autorizzate;
- indici per le query frequenti;
- timestamp e storico per reputazione e decisioni amministrative.

### Definition of Done di ogni onda

- migration versionata e applicata;
- policy RLS verificate con almeno due utenti e un admin;
- build di produzione completata;
- flusso principale provato da smartphone;
- errori e stati vuoti gestiti;
- deploy Vercel `Ready`;
- roadmap e status aggiornati;
- commit pubblicato su `main`.
