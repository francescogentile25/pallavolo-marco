# Onda 4 — Specifica funzionale tornei

Ultimo aggiornamento: 2 agosto 2026

Stato: `IN VERIFICA`

Questo documento raccoglie le decisioni approvate e implementate per l'Onda 4. La verifica remota
di database e deploy resta necessaria prima di dichiarare l'onda completata.

## Obiettivo

Supportare l'intero ciclo di un torneo di beach volley mantenendo separate:

- l'esperienza del giocatore che cerca e si iscrive a un torneo;
- l'esperienza dell'organizzatore che pubblica il torneo, compone le coppie e gestisce gli incontri;
- la formula sportiva usata per calendario, classifica e tabellone.

L'organizzazione è consentita ai ruoli `organizzatore` e `admin`. Un utente comune può consultare
e iscriversi ai tornei, ma non crearli o gestirli.

## Decisioni approvate

### Due dimensioni indipendenti

La modalità d'iscrizione e la formula sportiva sono proprietà separate. Non devono essere fuse in
un unico campo generico "tipo di torneo".

Modalità d'iscrizione disponibili:

1. `Solo coppie`: l'iscrizione è valida soltanto con una coppia completa.
2. `Solo individuale`: i giocatori si iscrivono singolarmente e l'organizzatore forma le coppie.
3. `Ibrida`: possono iscriversi sia coppie già formate sia giocatori liberi.

Formule sportive disponibili:

1. `Gironi`;
2. `Eliminazione diretta`;
3. `Gironi + eliminazione diretta`.

La prima versione non include l'eliminazione doppia.

### Partecipanti e coppie

- Possono essere aggiunti soltanto utenti registrati e attivi nell'applicazione.
- Un giocatore può proporsi come libero oppure proporre una coppia invitando un altro utente.
- Un organizzatore può proporre coppie, abbinare giocatori liberi e invitare utenti registrati.
- L'inserimento da parte dell'organizzatore è sempre un invito: non deve forzare la partecipazione.
- Ogni utente aggiunto da un'altra persona deve accettare prima di risultare confermato.
- La prima versione usa abbinamento manuale da parte dell'organizzatore.
- La UI può mostrare livello e lato preferito come suggerimenti visivi, ma non esegue matchmaking
  automatico.
- Un giocatore non può occupare contemporaneamente più posti o appartenere a due coppie nello
  stesso torneo.

Stati funzionali da rappresentare:

- giocatore libero;
- invito in attesa;
- coppia proposta;
- coppia confermata;
- lista d'attesa;
- iscrizione ritirata o rifiutata.

### Capienza, chiusura iscrizioni e lista d'attesa

- La capienza del torneo è espressa in numero di coppie.
- Una coppia entra definitivamente nel torneo soltanto quando entrambi i componenti sono confermati.
- I giocatori liberi non diventano coppie confermate finché l'organizzatore non completa
  l'abbinamento e i componenti non lo accettano.
- Alla chiusura delle iscrizioni non possono rimanere giocatori liberi nel tabellone.
- I giocatori non abbinati devono essere collocati in lista d'attesa, ritirati o esclusi con uno
  stato esplicito e tracciabile.
- La lista d'attesa alimenta il torneo con coppie complete; non inserisce automaticamente un singolo
  giocatore in una coppia senza consenso.
- Calendario e tabellone possono essere generati soltanto dopo la chiusura delle iscrizioni e la
  conferma dell'elenco definitivo delle coppie.

### Pagamenti e cancellazioni

- Nell'Onda 4 il costo è soltanto informativo.
- Non sono previste transazioni online, incassi, rimborsi o integrazioni con provider di pagamento.
- Il ritiro è consentito fino alla chiusura delle iscrizioni.
- Un posto liberato può promuovere la prima coppia completa idonea dalla lista d'attesa.
- Le eccezioni successive alla chiusura vengono gestite dall'organizzatore e devono restare
  tracciabili.

## Esperienza organizzatore

La console organizzatore deve permettere di:

- creare una bozza e scegliere modalità d'iscrizione e formula sportiva separatamente;
- impostare titolo, descrizione, luogo, campi, date, orari, durata, costo informativo, livelli,
  capienza e numero di partite garantite;
- pubblicare, chiudere le iscrizioni, annullare e archiviare il torneo;
- vedere coppie confermate, proposte, inviti in attesa, giocatori liberi e lista d'attesa;
- invitare utenti registrati;
- formare e modificare coppie prima del blocco definitivo;
- confermare l'elenco delle coppie;
- generare calendario e tabellone;
- assegnare incontri a orario e campo;
- inserire o correggere risultati secondo le regole autorizzate;
- consultare classifica, avanzamento e anomalie ancora da risolvere.

Le azioni irreversibili o che rigenerano il calendario devono usare dialog PrimeNG stilizzate con
conseguenze esplicite. Non devono essere usati `alert`, `confirm` o dialog native del browser.

## Esperienza giocatore

Il giocatore deve poter:

- cercare e filtrare tornei;
- consultare dettagli, requisiti, costo, posti e stato iscrizioni;
- iscriversi come coppia o giocatore libero quando la modalità lo consente;
- invitare un compagno registrato;
- accettare o rifiutare inviti e proposte di coppia;
- ritirarsi entro i limiti previsti;
- vedere chiaramente conferma, attesa, compagno e prossimi incontri;
- consultare gironi, classifica, tabellone e risultati.

## Calendario, risultati e tabellone

La logica sportiva deve appartenere al dominio applicativo e al database. Una libreria grafica non
deve decidere accoppiamenti, avanzamenti, punteggi o vincitori e non deve essere il formato di
persistenza dei dati.

### Fase a gironi

La fase a gironi viene resa con componenti Angular e PrimeNG:

- selezione del girone;
- classifica;
- elenco verticale degli incontri;
- card responsive per risultato, stato, orario e campo;
- dialog PrimeNG per inserire o correggere il risultato.

Su desktop può essere presente una tabella completa. Su mobile la vista principale usa classifica
compatta e card, evitando tabelle larghe che richiedano scrolling orizzontale.

### Eliminazione diretta

La libreria candidata è `Bracketry`, integrata dietro un componente-adapter Angular. La dipendenza
deve essere confermata con un piccolo spike tecnico prima dell'implementazione definitiva.

Responsabilità ammesse per la libreria:

- posizionamento visivo di turni, incontri e collegamenti;
- navigazione visuale fra turni;
- aggiornamento della rappresentazione quando cambiano i dati;
- evento di selezione di un incontro.

Responsabilità escluse:

- generazione del calendario;
- determinazione di vincitori e avanzamenti;
- validazione o salvataggio dei risultati;
- gestione di iscrizioni, coppie e autorizzazioni.

Comportamento responsive approvato:

- desktop: più turni visibili e collegati;
- mobile 360–430 px: un solo turno visibile, con controlli espliciti
  `Turno precedente` e `Turno successivo`;
- nessun tabellone completo rimpicciolito;
- nessuna scrollbar orizzontale incontrollata;
- pan e zoom non devono essere l'unico modo per orientarsi;
- toccando un incontro si apre lo stesso flusso PrimeNG usato nell'elenco delle partite.

### Accessibilità

Il tabellone grafico non è l'unica rappresentazione disponibile. Ogni fase a eliminazione deve
offrire:

- vista `Tabellone`, visuale;
- vista `Partite`, lineare, navigabile da tastiera e leggibile dagli screen reader.

Controlli, focus, contrasto, touch target e nomi accessibili restano responsabilità
dell'applicazione anche quando viene usata una libreria esterna.

## Realtime e notifiche

- Classifica, risultati, lista partecipanti e tabellone devono poter ricevere aggiornamenti tramite
  Supabase Realtime.
- L'Onda 4 produce gli eventi di dominio necessari alle notifiche sui tornei.
- Badge, centro notifiche e preferenze persistite appartengono all'Onda 5 e non devono bloccare
  l'implementazione dei tornei.

## Principi tecnici obbligatori

- Migrazioni Supabase versionate e RLS su ogni tabella esposta.
- Operazioni sensibili tramite RPC transazionali con autorizzazione server-side.
- Ruolo `organizzatore` o `admin` verificato nel database, non soltanto tramite route guard.
- Componenti Angular standalone, signal e `OnPush`.
- PrimeNG per button, select, multiselect, input, tab, table, dialog e controlli equivalenti.
- Nessuna dialog nativa del browser.
- Interfaccia progettata e verificata prima a 360–430 px, poi adattata al desktop.
- Il frontend non contiene `service_role` o altre chiavi segrete.

## Regole operative scelte

- Capienza configurabile da 4 a 32 coppie.
- Gironi configurabili da 3 a 6 coppie; qualificate da 1 fino a `dimensione girone - 1`.
- Incontri a un set o al meglio di tre, con set configurabili da 11 a 25 punti e tie-break da 7 a
  21; il vantaggio di due punti è configurabile.
- Classifica ordinata per punti, vittorie, differenza set e differenza punti, con ordinamento
  deterministico finale.
- Finale per il terzo posto configurabile.
- Conferma risultati configurabile: quando attiva, serve una conferma per ciascuna coppia.
- Nessuna sostituzione automatica dopo la chiusura; le eccezioni restano fuori dal flusso della
  prima versione e sono gestite dall'organizzatore.
- Tornei e tabellone sono visibili agli utenti autenticati; non vengono esposti ai visitatori
  anonimi.
- Riposo minimo configurabile da 0 a 120 minuti.
- Calendario generato automaticamente sui campi selezionati e successivamente modificabile
  dall'organizzatore entro le date del torneo.
- Dopo la chiusura delle iscrizioni le regole sportive sono bloccate; restano modificabili soltanto
  assegnazione di campo/orario e risultati.

Preset iniziali:

- `Rapido`: massimo 8 coppie, gironi da 4, un set a 15, 15 minuti di riposo.
- `Classico`: massimo 12 coppie, gironi da 4 con due qualificate, fase finale al meglio di tre,
  terzo posto e 20 minuti di riposo.
- `Eliminazione`: massimo 16 coppie fisse, incontri al meglio di tre, terzo posto e 25 minuti di
  riposo.
- `Personalizzato`: base classica con regole avanzate modificabili.

## Fuori ambito della prima versione

- pagamento online e rimborsi automatici;
- matchmaking automatico;
- utenti esterni non registrati;
- eliminazione doppia;
- chat del torneo;
- centro notifiche completo;
- trascinamento libero delle coppie nel tabellone come unico sistema di gestione.

## Implementazione del tabellone

L'installazione automatica di Bracketry non è stata disponibile nell'ambiente di sviluppo. Il
tabellone usa quindi un adapter Angular proprietario, senza logica sportiva al suo interno. Mantiene
il contratto previsto: un turno per volta su mobile, più turni su desktop e vista lineare alternativa.
La libreria potrà essere aggiunta in seguito senza modificare database, RPC o modelli di dominio.

## Verifiche residue

1. applicazione e lint delle migration remote `20260802060000`–`20260802110000`;
2. matrice RLS/RPC automatica con organizzatore, giocatore e profilo estraneo;
3. QA autenticata dell'utente a 360–430 px e desktop;
4. deploy Vercel e controllo dei deep link.
