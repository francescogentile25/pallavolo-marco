# Onda 2 — Verifiche di accettazione

Ultimo aggiornamento: 1 agosto 2026

Questa checklist accompagna la migration `20260801030000_matches_wave_2.sql` e i flussi Angular
in `features/matches`. La parte automatica locale, la migration remota e il deploy production
sono completati; resta da eseguire la matrice Supabase multiutente.

## Verifiche automatiche completate

- [x] Build Angular sviluppo.
- [x] Build Angular produzione; resta il warning noto sul budget iniziale.
- [x] Suite preesistente: 296 test superati.
- [x] Utility di ricerca, disponibilità e iscrizione: 3 test superati.
- [x] Route lazy per lista, creazione, dettaglio e pagina personale.
- [x] Migration Supabase applicata e cronologia locale/remota allineata.
- [x] Deploy Vercel production `READY` e deep link pubblici HTTP 200.

## Matrice database da eseguire

Usare due giocatori attivi A e B, un giocatore inattivo C e un amministratore.

1. A crea un luogo/campo e una partita da quattro posti; A deve comparire come organizzatore e
   primo partecipante.
2. B vede partita, campo e partecipanti ma non può modificare direttamente nessuna tabella.
3. C non può leggere né creare dati tramite API, anche invocando manualmente le RPC.
4. B si iscrive una volta; il secondo tentativo deve fallire senza creare duplicati.
5. Portare una partita a un solo posto libero e inviare due `join_match` concorrenti da utenti
   diversi: una sola transazione deve riuscire e il totale non deve superare `capacity`.
6. Un partecipante si ritira da una partita completa: lo stato torna `open` e il posto riappare
   sugli altri client senza refresh.
7. Il creatore non può ritirarsi; può annullare la partita e tutti i client vedono `cancelled`.
8. Un non-creatore non può invocare `cancel_match`.
9. Un giocatore fuori fascia livello non può iscriversi né creare una partita che lo esclude.
10. Un giocatore non può creare o raggiungere due partite con orari sovrapposti.

## Verifiche UI mobile

- [ ] Lista e filtri a 360, 390 e 430 px.
- [ ] Creazione completa con anagrafica campi inizialmente vuota.
- [ ] Action sheet utilizzabile con una mano e chiudibile con gesto/escape.
- [ ] Dettaglio aggiornato su due sessioni contemporanee.
- [ ] Link diretto `/partite/:id` dopo refresh su Vercel.
- [ ] `Le mie partite` separa correttamente prossime e archivio.
- [ ] Focus visibile, ordine tastiera e lettura screen reader.
