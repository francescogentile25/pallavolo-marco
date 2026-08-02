# Onda 4 — Test di accettazione

Prerequisiti: migration `20260802060000`–`20260802110000` applicate; un organizzatore, almeno
quattro giocatori attivi e almeno un campo disponibile.

## Autorizzazioni

- [ ] Un giocatore può consultare e iscriversi, ma non creare o gestire tornei.
- [ ] Organizzatore e admin possono creare, pubblicare e gestire un torneo.
- [ ] Le RPC rifiutano scritture organizzative eseguite da un giocatore comune.
- [ ] Le tabelle accettano scritture soltanto attraverso RPC autorizzate.

## Creazione e preset

- [ ] Il wizard è utilizzabile a 360, 390, 430 px e desktop senza overflow.
- [ ] Rapido, Classico ed Eliminazione applicano i valori documentati.
- [ ] Le regole avanzate restano nascoste inizialmente e sono modificabili nel preset Personalizzato.
- [ ] Date, livelli, campi, gironi e qualificate incompatibili bloccano la creazione.
- [ ] Pubblicazione e azioni irreversibili usano dialog PrimeNG stilizzate.

## Iscrizioni ibride

- [ ] Un giocatore può iscriversi come libero quando la modalità lo consente.
- [ ] Una coppia proposta diventa confermata soltanto dopo il consenso del compagno.
- [ ] L'organizzatore può invitare due utenti registrati senza forzarne la partecipazione.
- [ ] L'organizzatore può abbinare due giocatori liberi; entrambi devono accettare.
- [ ] Lo stesso utente non può essere libero e membro di una coppia, né appartenere a due coppie.
- [ ] Superata la capienza, la coppia completa entra in lista d'attesa.
- [ ] Se una coppia confermata si ritira, la prima coppia completa in attesa viene promossa.

## Calendario e torneo

- [ ] La chiusura viene rifiutata con giocatori liberi irrisolti o meno di quattro coppie.
- [ ] La chiusura blocca le regole e genera gironi o tabellone sui campi selezionati.
- [ ] L'organizzatore può spostare un incontro entro la finestra del torneo.
- [ ] Campo e orario già occupati vengono rifiutati.
- [ ] Tutte le coppie rispettano il riposo minimo configurato nel calendario iniziale.
- [ ] Una coppia non può avere incontri sovrapposti o senza il riposo minimo configurato.

## Risultati, classifica e tabellone

- [ ] I punteggi non validi rispetto a set, target e vantaggio vengono rifiutati.
- [ ] Quando la conferma è attiva, una persona per ciascuna coppia conferma il risultato.
- [ ] La classifica usa punti, vittorie, differenza set e differenza punti.
- [ ] La fase finale viene generata dalle qualificate dei gironi.
- [ ] Il vincitore avanza automaticamente e le semifinaliste sconfitte alimentano il terzo posto.
- [ ] Un risultato può essere corretto solo finché la fase dipendente non è iniziata.
- [ ] Su mobile il tabellone mostra un turno per volta; su desktop mostra più turni.
- [ ] La vista Partite offre sempre l'alternativa lineare accessibile.

## Realtime e rilascio

- [ ] Iscrizioni, conferme e risultati si aggiornano senza refresh manuale.
- [ ] Build di produzione e suite Angular superano i controlli.
- [ ] Lint Supabase non segnala errori.
- [ ] `/tornei`, `/tornei/organizza` e un deep link `/tornei/:id` rispondono su Vercel.
- [ ] La QA autenticata interattiva viene eseguita dall'utente, senza browser interno di Codex.
