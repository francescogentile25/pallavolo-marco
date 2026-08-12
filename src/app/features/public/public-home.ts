import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { loadMotion } from '../../shared/motion/gsap-loader';

@Component({
  selector: 'app-public-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-home.html',
  styleUrl: './public-home.scss',
})
export class PublicHome implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  ngAfterViewInit(): void {
    const root = this.host.nativeElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const court = root.querySelector<HTMLElement>('.court-preview');
    const abort = new AbortController();

    if (court && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
      court.addEventListener('pointermove', event => {
        const rect = court.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        court.style.setProperty('--tilt-x', `${x * 7}deg`);
        court.style.setProperty('--tilt-y', `${y * -5}deg`);
      }, { signal: abort.signal });
      court.addEventListener('pointerleave', () => {
        court.style.setProperty('--tilt-x', '0deg');
        court.style.setProperty('--tilt-y', '0deg');
      }, { signal: abort.signal });
    }

    this.destroyRef.onDestroy(() => abort.abort());
    if (!reducedMotion) void this.setupMotion(root);
  }

  private async setupMotion(root: HTMLElement): Promise<void> {
    const { gsap } = await loadMotion();
    if (!root.isConnected) return;

    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.public-header', { opacity: 0, y: -20, duration: 0.7 })
        .from('.hero-copy > *', { opacity: 0, y: 42, duration: 0.85, stagger: 0.09 }, 0.15)
        .from('.court-shell', { opacity: 0, y: 70, rotateX: -8, scale: 0.9, duration: 1.25 }, 0.22)
        .from('.court-ball', { opacity: 0, y: -100, scale: 0.35, duration: 0.8, ease: 'bounce.out' }, 0.85);

      gsap.to('.hero-orbit--one', { rotation: 360, duration: 22, repeat: -1, ease: 'none' });
      gsap.to('.hero-orbit--two', { rotation: -360, duration: 30, repeat: -1, ease: 'none' });
      gsap.to('.court-ball', { y: -12, duration: 1.65, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('.court-ball .ball-core', { rotation: 360, duration: 7, repeat: -1, ease: 'none' });
      gsap.to('.hero-copy', { yPercent: 22, opacity: 0.25, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.7 } });
      gsap.to('.court-shell', { yPercent: -18, rotateZ: 3, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 } });

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => {
        gsap.from(element, { opacity: 0, y: 64, rotateX: 7, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 88%', once: true } });
      });

      gsap.timeline({ scrollTrigger: { trigger: '.story-track', start: 'top top', end: 'bottom bottom', scrub: 0.65 } })
        .to('.story-progress span', { scaleY: 1, duration: 3, ease: 'none' }, 0)
        .to('.story-court', { rotateX: 66, rotateZ: 8, scale: 0.88, duration: 1 }, 0)
        .to('.story-ball', { x: '32vw', y: '-10vh', duration: 1 }, 0)
        .to('.story-ball .ball-core', { rotation: 180, duration: 1 }, 0)
        .to('.chapter-one', { opacity: 0, y: -36, duration: 0.35 }, 0.65)
        .fromTo('.chapter-two', { opacity: 0, y: 42 }, { opacity: 1, y: 0, duration: 0.35 }, 0.85)
        .to('.story-court', { rotateX: 52, rotateZ: -7, scale: 1.04, duration: 1 }, 1)
        .to('.story-ball', { x: '-29vw', y: '14vh', duration: 1 }, 1)
        .to('.story-ball .ball-core', { rotation: 390, duration: 1 }, 1)
        .to('.chapter-two', { opacity: 0, y: -36, duration: 0.35 }, 1.65)
        .fromTo('.chapter-three', { opacity: 0, y: 42 }, { opacity: 1, y: 0, duration: 0.35 }, 1.85)
        .to('.story-court', { rotateX: 72, rotateZ: 0, scale: 0.76, duration: 1 }, 2)
        .to('.story-ball', { x: '0vw', y: '-18vh', scale: 1.6, duration: 1 }, 2)
        .to('.story-ball .ball-core', { rotation: 720, duration: 1 }, 2);

      gsap.from('.closing-ball', { scale: 0.08, rotation: -240, scrollTrigger: { trigger: '.closing', start: 'top 82%', end: 'center center', scrub: 0.6 } });
    }, root);

    this.destroyRef.onDestroy(() => context.revert());
  }
}
