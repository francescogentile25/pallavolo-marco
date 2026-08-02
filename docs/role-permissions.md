# Ruoli e permessi applicativi

Ultimo aggiornamento: 2 agosto 2026

I ruoli sono cumulativi e vengono assegnati esclusivamente da un amministratore. Un nuovo profilo
nasce come `giocatore` (utente comune) e deve essere attivato prima di poter utilizzare
l’applicazione.

| Capacità | Utente comune | Organizzatore | Admin |
|---|---:|---:|---:|
| Gestire il proprio profilo | Sì | Sì | Sì |
| Creare e modificare le proprie partite | Sì | Sì | Sì |
| Iscriversi alle partite | Sì | Sì | Sì |
| Iscriversi ai tornei | Sì | Sì | Sì |
| Creare e gestire tornei | No | Sì | Sì |
| Gestire utenti, ruoli e attivazioni | No | No | Sì |
| Accesso amministrativo completo | No | No | Sì |

La route `/tornei/organizza` è protetta dalla guardia organizzatore. L’area mostra ancora il
placeholder perché il dominio tornei verrà implementato nell’Onda 4; database e frontend sono già
predisposti per usare `can_organize_tournaments()` come autorizzazione server-side.

## Verifiche di accettazione

1. Un utente comune può aprire, modificare e annullare le proprie partite e iscriversi alle altre.
2. Un utente comune che apre `/tornei/organizza` viene riportato a `/tornei`.
3. Un organizzatore conserva tutte le capacità comuni e può aprire `/tornei/organizza`.
4. Un organizzatore non può aprire `/admin/utenti` né invocare RPC amministrative.
5. Un admin può utilizzare entrambe le aree e assegnare tutti e tre i ruoli.
6. Un profilo inattivo non ottiene capacità operative indipendentemente dal ruolo.
7. Organizzatori e admin possono essere invitati e partecipare alle partite come gli utenti comuni.
