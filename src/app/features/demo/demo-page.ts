import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

type DemoRole = 'giocatore' | 'organizzatore';

interface DemoState {
  joinedMatch: boolean;
  pairedPlayers: boolean;
  resultPublished: boolean;
}

const INITIAL_STATE: DemoState = {
  joinedMatch: false,
  pairedPlayers: false,
  resultPublished: false,
};

@Component({
  selector: 'app-demo-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-page.html',
  styleUrl: './demo-page.scss',
})
export class DemoPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly role = computed<DemoRole>(() =>
    this.params().get('ruolo') === 'organizzatore' ? 'organizzatore' : 'giocatore',
  );
  protected readonly state = signal<DemoState>(this.loadState());
  protected readonly message = signal<string | null>(null);
  protected readonly freeSpots = computed(() => this.state().joinedMatch ? 0 : 1);
  protected readonly playerProgress = computed(() => this.state().joinedMatch ? 3 : 1);
  protected readonly organizerProgress = computed(() =>
    1 + Number(this.state().pairedPlayers) + Number(this.state().resultPublished),
  );

  protected changeRole(role: DemoRole): void {
    void this.router.navigate(['/demo', role]);
  }

  protected joinMatch(): void {
    if (this.state().joinedMatch) return;
    this.update({ joinedMatch: true });
    this.announce('Iscrizione confermata. La partita è ora nel tuo calendario.');
  }

  protected pairPlayers(): void {
    if (this.state().pairedPlayers) return;
    this.update({ pairedPlayers: true });
    this.announce('Coppia creata. Luca e Nina sono ora nel girone B.');
  }

  protected publishResult(): void {
    if (this.state().resultPublished) return;
    this.update({ resultPublished: true });
    this.announce('Risultato pubblicato. Classifica e tabellone aggiornati.');
  }

  protected reset(): void {
    this.state.set({ ...INITIAL_STATE });
    try { sessionStorage.removeItem('bvh:demo-state'); } catch { /* storage non disponibile */ }
    this.announce('Demo ripristinata allo scenario iniziale.');
  }

  private update(changes: Partial<DemoState>): void {
    this.state.update(current => ({ ...current, ...changes }));
    try { sessionStorage.setItem('bvh:demo-state', JSON.stringify(this.state())); } catch { /* storage non disponibile */ }
  }

  private loadState(): DemoState {
    try {
      const stored = JSON.parse(sessionStorage.getItem('bvh:demo-state') ?? 'null') as Partial<DemoState> | null;
      return stored ? { ...INITIAL_STATE, ...stored } : { ...INITIAL_STATE };
    } catch {
      return { ...INITIAL_STATE };
    }
  }

  private announce(message: string): void {
    this.message.set(message);
    window.setTimeout(() => {
      if (this.message() === message) this.message.set(null);
    }, 4200);
  }
}
