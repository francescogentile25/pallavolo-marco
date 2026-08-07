import type { gsap as GsapNamespace } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

export interface Motion {
  gsap: typeof GsapNamespace;
  ScrollTrigger: typeof ScrollTriggerType;
}

let pending: Promise<Motion> | null = null;

/**
 * Carica GSAP solo quando serve davvero un'animazione. La libreria pesa piu di
 * cento kilobyte: tenerla fuori dal bundle iniziale accorcia il primo
 * caricamento, e chi ha chiesto di ridurre il movimento non la scarica affatto.
 * La promessa e condivisa: i plugin si registrano una volta sola.
 */
export function loadMotion(): Promise<Motion> {
  pending ??= (async () => {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  })();
  return pending;
}
