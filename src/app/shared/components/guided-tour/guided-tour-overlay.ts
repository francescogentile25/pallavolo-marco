import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TourService } from '../../../core/tours/tour.service';

@Component({
  selector: 'app-guided-tour-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guided-tour-overlay.html',
  styleUrl: './guided-tour-overlay.scss',
  host: { '(window:keydown.escape)': 'tour.cancel()' },
})
export class GuidedTourOverlay {
  protected readonly tour = inject(TourService);
  protected readonly stageStyle = computed(() => {
    const rect = this.tour.activeStep()?.targetRect;
    if (!rect) return null;
    const gap = 7;
    return {
      left: `${Math.max(4, rect.left - gap)}px`,
      top: `${Math.max(4, rect.top - gap)}px`,
      width: `${Math.min(innerWidth - 8, rect.width + gap * 2)}px`,
      height: `${Math.min(innerHeight - 8, rect.height + gap * 2)}px`,
    };
  });
  protected readonly popoverStyle = computed(() => {
    const active = this.tour.activeStep();
    const rect = active?.targetRect;
    if (!active || !rect || innerWidth < 768 || active.step.side === 'over') return {};
    const width = 360;
    const gap = 18;
    const side = active.step.side ?? 'bottom';
    let left = rect.left + rect.width / 2 - width / 2;
    let top = rect.bottom + gap;
    if (side === 'top') top = rect.top - gap - 220;
    if (side === 'left') { left = rect.left - width - gap; top = rect.top; }
    if (side === 'right') { left = rect.right + gap; top = rect.top; }
    return {
      left: `${Math.max(16, Math.min(innerWidth - width - 16, left))}px`,
      top: `${Math.max(16, Math.min(innerHeight - 250, top))}px`,
    };
  });
}
