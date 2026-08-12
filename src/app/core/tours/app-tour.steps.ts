import { Router } from '@angular/router';
import { AuthStore } from '../../features/auth/store/auth.store';
import { TourService } from './tour.service';
import { TourStep } from './tour.model';

type TourRole = 'giocatore' | 'organizzatore';

export function buildAppTourSteps(
  role: TourRole,
  router: Router,
  tour: TourService,
  auth: InstanceType<typeof AuthStore>,
  includePublicWelcome = false,
): TourStep[] {
  const open = (route: string, selector: string, enterDemo = false) => async () => {
    const path = router.url.split('?')[0];
    if (enterDemo && !auth.isAuthenticated()) {
      await tour.runGuidedNavigation(() => auth.enterDemo(role));
    } else if (path !== route) {
      await tour.runGuidedNavigation(() => router.navigateByUrl(route));
    }
    await waitFor(selector);
  };

  const steps: TourStep[] = [];
  if (includePublicWelcome) {
    steps.push({
      id: 'public-welcome',
      element: '[data-tour-page="public"]',
      title: 'Prova l’app, prima di iscriverti',
      description: 'Ti accompagniamo nell’app reale usando un profilo dimostrativo e dati simulati. Puoi saltare la guida in qualsiasi momento.',
      side: 'over',
    });
  }

  steps.push(
    {
      id: 'home',
      element: '[data-tour-page="home"]',
      title: 'La tua giornata di beach volley',
      description: 'La Home riunisce il prossimo impegno, il calendario, il meteo di Pescara e le attività vicine alla città scelta nel profilo.',
      side: 'over',
      beforeHighlight: open('/app', '[data-tour-page="home"]', includePublicWelcome),
    },
    {
      id: 'matches',
      element: '[data-tour-page="matches"]',
      title: 'Trova e organizza partite',
      description: 'Consulta le partite vicine, filtra per data e livello, apri i dettagli e iscriviti. Le tue attività restano nella tua agenda.',
      side: 'over',
      beforeHighlight: open('/partite', '[data-tour-page="matches"]'),
    },
    {
      id: 'tournaments',
      element: '[data-tour-page="tournaments"]',
      title: 'Tornei e iscrizioni',
      description: 'Scopri formule, disponibilità e luogo. Puoi entrare con una coppia oppure da solo, quando il torneo lo consente.',
      side: 'over',
      beforeHighlight: open('/tornei', '[data-tour-page="tournaments"]'),
    },
  );

  if (role === 'organizzatore') {
    steps.push({
      id: 'organizer-studio',
      element: '[data-tour-page="organize-tournament"]',
      title: 'La console dell’organizzatore',
      description: 'Configura formula, iscrizioni, visibilità, campo e identità del torneo. Le funzioni di gestione compaiono solo a chi ha questo ruolo.',
      side: 'over',
      beforeHighlight: open('/tornei/organizza', '[data-tour-page="organize-tournament"]'),
    });
  }

  steps.push(
    {
      id: 'courts',
      element: '[data-tour-page="courts"]',
      title: 'Campi vicino a te',
      description: 'Esplora le strutture della zona, controlla indirizzo, servizi e collegamenti prima di scegliere dove giocare.',
      side: 'over',
      beforeHighlight: open('/campi', '[data-tour-page="courts"]'),
    },
    {
      id: 'friends',
      element: '[data-tour-page="friends"]',
      title: 'Amici e nuovi compagni',
      description: 'Gestisci richieste, cerca giocatori e consulta i profili degli amici per costruire più facilmente una coppia.',
      side: 'over',
      beforeHighlight: open('/amici', '[data-tour-page="friends"]'),
    },
    {
      id: 'notifications',
      element: '[data-tour-page="notifications"]',
      title: 'Non perdere gli aggiornamenti',
      description: 'Inviti, conferme e cambiamenti di partite o tornei arrivano qui e ti portano direttamente all’attività interessata.',
      side: 'over',
      beforeHighlight: open('/notifiche', '[data-tour-page="notifications"]'),
    },
    {
      id: 'profile',
      element: '[data-tour-page="profile"]',
      title: 'Il profilo guida l’esperienza',
      description: 'Imposta città, livello, lato preferito e notifiche. Queste informazioni personalizzano meteo, distanze e suggerimenti.',
      side: 'over',
      beforeHighlight: open('/profilo', '[data-tour-page="profile"]'),
    },
    {
      id: 'complete',
      title: role === 'organizzatore' ? 'Pronto a creare il prossimo evento' : 'Pronto a scendere in campo',
      description: 'Ora puoi continuare a esplorare liberamente. Il pulsante con la bussola nella barra superiore riapre questa guida quando vuoi.',
      side: 'over',
    },
  );
  return steps;
}

async function waitFor(selector: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 3500) {
    if (document.querySelector(selector)) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
  }
}
