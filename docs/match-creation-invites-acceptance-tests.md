# Inviti durante la creazione di una partita

Ultimo aggiornamento: 2 agosto 2026

La migration `20260802020000_match_creation_invites.sql` espone soltanto nome, cognome, avatar e
livello dei giocatori attivi e iscrive organizzatore e invitati nella stessa transazione.

## Verifiche automatiche completate

- [x] Build Angular completata.
- [x] Suite Angular: 304 test superati.
- [x] Controllo statico del diff senza errori di whitespace.

## Matrice database

Usare un organizzatore A e tre giocatori attivi B, C e D.

1. A crea una partita invitando B e C: A, B e C devono risultare subito partecipanti.
2. Con capienza 4 non deve essere possibile invitare più di tre giocatori oltre ad A.
3. Un profilo inattivo, amministratore o inesistente deve essere rifiutato anche chiamando la RPC
   manualmente.
4. Un invitato fuori dalla fascia di livello scelta deve essere rifiutato.
5. Un invitato già impegnato in una partita sovrapposta deve essere rifiutato e la creazione non
   deve lasciare né la partita né partecipanti parziali.
6. Gli identificativi duplicati devono produrre una sola iscrizione.
7. Se organizzatore e invitati raggiungono la capienza, la nuova partita deve nascere `full`.
8. Nessuna email o ruolo deve essere esposto da `list_invitable_players`.

## Verifiche UI

- [ ] La ricerca PrimeNG trova un giocatore per nome o cognome.
- [ ] Cambiando capienza o fascia di livello, le selezioni non più valide vengono rimosse.
- [ ] Il riepilogo del passo 3 mostra correttamente gli invitati.
- [ ] Senza invitati il flusso di creazione resta invariato.

## Modifica e annullamento

La migration `20260802030000_match_editing.sql` mantiene l’annullamento soft e aggiunge la
modifica delle partite future.

- [ ] Solo l’organizzatore vede e può usare “Modifica partita”.
- [ ] Una partita iniziata, conclusa o annullata non può essere modificata.
- [ ] Campo, data, ora, durata, capienza, genere, livelli e note vengono aggiornati.
- [ ] La capienza non può scendere sotto gli iscritti attuali.
- [ ] La fascia di livello non può escludere un partecipante attuale.
- [ ] Il nuovo orario non può sovrapporsi agli altri impegni di nessun partecipante.
- [ ] L’annullamento continua a impostare `cancelled` senza cancellare lo storico.
