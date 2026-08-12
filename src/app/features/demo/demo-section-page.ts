import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

type DemoRole = 'giocatore' | 'organizzatore';
type DemoSection = 'partite' | 'tornei' | 'campi' | 'amici' | 'profilo' | 'notifiche';

@Component({
  selector: 'app-demo-section-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-section-page.html',
  styleUrl: './demo-section-page.scss',
})
export class DemoSectionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly role = computed<DemoRole>(() => this.params().get('ruolo') === 'organizzatore' ? 'organizzatore' : 'giocatore');
  protected readonly section = computed<DemoSection>(() => {
    const value = this.params().get('sezione');
    return ['partite', 'tornei', 'campi', 'amici', 'profilo', 'notifiche'].includes(value ?? '') ? value as DemoSection : 'partite';
  });
  protected readonly city = signal('Pescara');
  protected readonly friendRequested = signal(false);
  protected readonly favoriteCourt = signal(false);
  protected readonly notificationRead = signal(false);
  protected readonly message = signal<string | null>(null);

  protected link(section?: DemoSection): readonly string[] {
    return section ? ['/demo', this.role(), section] : ['/demo', this.role()];
  }

  protected changeRole(role: DemoRole): void {
    void this.router.navigate(['/demo', role, this.section()]);
  }

  protected setCity(city: string): void {
    this.city.set(city);
    this.say(`Città aggiornata: meteo ed eventi ora mostrano ${city}.`);
  }

  protected requestFriend(): void { this.friendRequested.set(true); this.say('Richiesta di amicizia inviata a Giulia.'); }
  protected toggleCourt(): void { this.favoriteCourt.update(value => !value); this.say(this.favoriteCourt() ? 'Campo aggiunto ai preferiti.' : 'Campo rimosso dai preferiti.'); }
  protected readNotifications(): void { this.notificationRead.set(true); this.say('Tutte le notifiche sono state segnate come lette.'); }

  private say(text: string): void {
    this.message.set(text);
    window.setTimeout(() => { if (this.message() === text) this.message.set(null); }, 3500);
  }
}
