# Onda 3 — test di accettazione

Prerequisiti: migration `20260802010000_match_feedback_wave_3.sql` applicata; un organizzatore e
almeno due giocatori attivi iscritti alla stessa partita terminata.

## Chiusura

- [x] Prima dell'orario di fine la chiusura viene rifiutata.
- [x] Un partecipante non organizzatore non può chiudere la partita via RPC.
- [x] L'organizzatore chiude la partita dopo il termine; stato e `completed_at` sono coerenti.
- [x] Tutti i partecipanti ricevono una presenza iniziale `present`.

## Valutazioni

- [x] Un partecipante presente valuta ogni altro partecipante da 1 a 7.
- [x] Autovalutazione, voto verso estranei e voto da estranei sono rifiutati.
- [x] Il secondo voto sulla stessa coppia partita/valutatore/valutato è rifiutato.
- [x] Dopo 7 giorni il voto è rifiutato.
- [x] Livello corrente e storico del valutato si aggiornano dopo refresh.

## No-show e affidabilità

- [x] Solo l'organizzatore può registrare il no-show di un altro partecipante.
- [x] La motivazione è obbligatoria e il duplicato è rifiutato.
- [x] Dopo 48 ore la segnalazione è rifiutata.
- [x] L'affidabilità diminuisce di 1 senza scendere sotto 1 e lo storico conserva la motivazione.
- [x] I voti collegati al no-show restano in audit come invalidi e non incidono più sul livello.

## RLS, realtime e mobile

- [x] Le tabelle non accettano insert/update/delete diretti dal client autenticato.
- [x] Un utente estraneo non vede presenze e voti della partita.
- [x] Due sessioni vedono gli aggiornamenti senza reload manuale.
- [x] Il flusso è usabile a 360 px, con focus visibile e target touch adeguati.

## Rifiniture di chiusura

- [x] Lista e creazione partita usano i componenti PrimeNG disponibili per select, checkbox e pulsanti.
- [x] Il pannello azioni mantiene il bottom sheet su mobile ed è centrato e dimensionato sul contenuto su desktop.
- [x] Build Angular e suite completa da terminale superate dopo le rifiniture.
