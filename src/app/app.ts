import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from "primeng/toast";
import { PrimeNG } from "primeng/config";
import { ConfirmDialog } from "primeng/confirmdialog";
import { ConfirmationService } from "primeng/api";
import { AuthStore } from './features/auth/store/auth.store';
import { GuidedTourOverlay } from './shared/components/guided-tour/guided-tour-overlay';
import { TourLauncherService } from './core/tours/tour-launcher.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, ConfirmDialog, GuidedTourOverlay],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  providers: [ConfirmationService]
})
export class App implements OnInit {
  private primeng = inject(PrimeNG);
  protected readonly authStore = inject(AuthStore);
  private readonly tourLauncher = inject(TourLauncherService);
  ngOnInit() {
    this.primeng.setTranslation({
      emptyMessage: 'Nessun risultato trovato',
      emptyFilterMessage: 'Nessun risultato trovato',
      dayNames: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
      dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
      dayNamesMin: ['Do', 'Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa'],
      monthNames: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
      monthNamesShort: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
      today: 'Oggi',
      weekHeader: 'Sett',
      firstDayOfWeek: 1,
      dateFormat: 'dd/mm/yy'
    });
  }
}
