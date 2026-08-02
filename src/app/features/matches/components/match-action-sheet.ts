import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { BeachMatch } from '../models/match.model';
import { availableSpots, isUserJoined } from '../matches.utils';

@Component({
  selector: 'app-match-action-sheet', imports: [Button, Drawer, RouterLink], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p-drawer [visible]="visible()" (visibleChange)="visibleChange.emit($event)" position="bottom" [modal]="true" [dismissible]="true" styleClass="match-action-sheet" header="Azioni partita">@if(match();as current){<div class="heading"><strong>{{current.court.venue.name}}</strong><span>{{spots(current)}} posti disponibili</span></div><a pButton [routerLink]="['/partite',current.id]" (click)="visibleChange.emit(false)"><i class="pi pi-eye" pButtonIcon></i><span pButtonLabel>Vedi dettaglio</span></a>@if(canJoin()){<p-button fluid label="Iscriviti" icon="pi pi-user-plus" [loading]="busy()" (onClick)="join.emit(current.id)" />}@if(canWithdraw()){<p-button fluid severity="secondary" label="Ritirati" icon="pi pi-user-minus" [loading]="busy()" (onClick)="withdraw.emit(current.id)" />}@if(canCancel()){<p-button fluid severity="danger" [outlined]="true" label="Annulla partita" icon="pi pi-times" [loading]="busy()" (onClick)="cancel.emit(current.id)" />}}</p-drawer>`,
  styles: `
    :host { display: contents; }

    :host ::ng-deep .match-action-sheet {
      width: 100%;
      height: auto;
      max-height: min(78dvh, 470px);
      border-radius: 26px 26px 0 0;
    }

    :host ::ng-deep .match-action-sheet .p-drawer-content {
      display: grid;
      overflow-y: auto;
      align-content: start;
      gap: 10px;
      padding-bottom: calc(20px + var(--safe-bottom));
    }

    .heading { display: grid; gap: 4px; padding: 4px 0 12px; }
    .heading strong { font: 900 1.25rem/1.1 var(--display-font); }
    .heading span { color: var(--color-ink-muted); font-size: .78rem; }
    a[pButton] { justify-content: center; text-decoration: none; }

    @media (min-width: 700px) {
      :host ::ng-deep .match-action-sheet {
        top: 50%;
        right: auto;
        bottom: auto;
        left: 50%;
        width: min(460px, calc(100vw - 48px));
        max-height: min(80dvh, 560px);
        border: 1px solid var(--color-border);
        border-radius: 26px;
        box-shadow: 0 24px 70px rgb(0 0 0 / 24%);
        transform: translate(-50%, -50%);
        animation: none !important;
      }

      :host ::ng-deep .match-action-sheet .p-drawer-content {
        padding-bottom: 24px;
      }
    }
  `,
})
export class MatchActionSheet {
  visible=input(false);visibleChange=output<boolean>();match=input<BeachMatch|null>(null);userId=input<string|null>(null);busy=input(false);join=output<string>();withdraw=output<string>();cancel=output<string>();protected readonly spots=availableSpots;
  protected readonly canJoin=computed(()=>{const m=this.match();return !!m&&m.status==='open'&&availableSpots(m)>0&&!isUserJoined(m,this.userId());});
  protected readonly canWithdraw=computed(()=>{const m=this.match();return !!m&&m.creator_id!==this.userId()&&['open','full'].includes(m.status)&&isUserJoined(m,this.userId());});
  protected readonly canCancel=computed(()=>{const m=this.match();return !!m&&m.creator_id===this.userId()&&['draft','open','full'].includes(m.status);});
}
