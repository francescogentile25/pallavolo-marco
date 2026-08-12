import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-google-auth-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-busy]': 'loading()' },
  template: `
    <button type="button" class="google-button" [disabled]="loading()" (click)="pressed.emit()">
      <span class="google-mark" aria-hidden="true">G</span>
      {{ label() }}
    </button>
  `,
  styles: `
    :host{display:block}
    .google-button{display:flex;width:100%;min-height:54px;align-items:center;justify-content:center;gap:12px;padding:0 18px;color:#18212a;border:1px solid rgb(255 255 255/.5);border-radius:16px;background:white;font:inherit;font-weight:850;cursor:pointer;transition:transform 160ms ease,box-shadow 160ms ease}
    .google-button:hover:not(:disabled){box-shadow:0 10px 28px rgb(3 16 22/.22);transform:translateY(-1px)}
    .google-button:focus-visible{outline:3px solid white;outline-offset:3px}
    .google-button:disabled{cursor:wait;opacity:.65}
    .google-mark{display:grid;width:24px;height:24px;place-items:center;color:#4285f4;border:1px solid #d9e1ea;border-radius:50%;font-family:Arial,sans-serif;font-size:.9rem;font-weight:800}
    @media(prefers-reduced-motion:reduce){.google-button{transition:none}}
  `,
})
export class GoogleAuthButton {
  readonly label = input('Continua con Google');
  readonly loading = input(false);
  readonly pressed = output<void>();
}
