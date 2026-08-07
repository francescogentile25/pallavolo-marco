import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tournament } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';

const MAX_BYTES = 2 * 1024 * 1024;

/** Logo della societa organizzante: caricabile e sostituibile dallo Studio in qualsiasi momento. */
@Component({
  selector: 'app-tournament-logo',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="logo-card">
      <span class="preview">
        @if (tournament().organizer_logo_url) {
          <img [src]="tournament().organizer_logo_url" alt="Logo attuale della societa organizzatrice" />
        } @else {
          <i class="pi pi-image" aria-hidden="true"></i>
        }
      </span>
      <div class="copy">
        <strong>{{ tournament().organizer_logo_url ? 'Logo attivo' : 'Nessun logo caricato' }}</strong>
        <span>Compare nella testata del torneo. PNG, JPG, WebP o SVG fino a 2 MB.</span>
        @if (error()) { <small role="alert">{{ error() }}</small> }
      </div>
      <div class="controls">
        <label class="upload">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="pick($event)" [disabled]="busy()" />
          <i class="pi pi-upload" aria-hidden="true"></i>{{ busy() ? 'Caricamento…' : (tournament().organizer_logo_url ? 'Cambia logo' : 'Carica logo') }}
        </label>
        @if (tournament().organizer_logo_url) {
          <p-button label="Rimuovi" severity="secondary" [text]="true" size="small" icon="pi pi-times" [disabled]="busy()" (onClick)="remove()" />
        }
      </div>
    </div>
  `,
  styles: `
    :host{display:block}
    .logo-card{display:grid;grid-template-columns:auto 1fr;gap:14px;padding:18px;border:1px solid #d9cdb4;border-radius:var(--radius-lg);background:#faf7f0}
    .preview{display:grid;width:72px;height:72px;place-items:center;overflow:hidden;padding:6px;color:var(--color-ink-muted);border:1px solid #d9cdb4;border-radius:var(--radius);background:#fff}
    .preview img{width:100%;height:100%;object-fit:contain}
    .copy{display:grid;align-content:center;gap:3px}
    .copy strong{font-size:.82rem}
    .copy span{color:var(--color-ink-muted);font-size:.66rem}
    .copy small{color:var(--color-danger);font-size:.66rem;font-weight:750}
    .controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;grid-column:1/-1}
    .upload{position:relative;display:inline-flex;min-height:44px;align-items:center;gap:8px;padding:0 16px;border:1px solid #d9cdb4;border-radius:var(--radius-pill);background:#fff;font-size:.76rem;font-weight:800;cursor:pointer}
    .upload:focus-within{outline:2px solid var(--color-focus);outline-offset:2px}
    .upload input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
    @media(min-width:760px){.logo-card{grid-template-columns:auto 1fr auto}.controls{grid-column:auto}}
  `,
})
export class TournamentLogoEditor {
  readonly tournament = input.required<Tournament>();
  private readonly store = inject(TournamentsStore);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Il file sale nello storage e l'indirizzo viene salvato solo se l'upload riesce. */
  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_BYTES) {
      this.error.set('Il logo deve essere un’immagine di massimo 2 MB.');
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    const url = await this.store.uploadLogo(file);
    if (url) await this.store.setLogo(this.tournament().id, url);
    this.busy.set(false);
  }

  protected async remove(): Promise<void> {
    this.busy.set(true);
    await this.store.setLogo(this.tournament().id, null);
    this.busy.set(false);
  }
}
