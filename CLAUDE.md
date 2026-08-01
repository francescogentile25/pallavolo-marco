# Frontend — Beach Volley Hub

## Regole

- Angular 21 standalone, lazy routing e signals.
- `ChangeDetectionStrategy.OnPush` su ogni nuovo componente.
- `inject()` per le dipendenze; input/output signal-based.
- Control flow nativo (`@if`, `@for`, `@switch`).
- HTML semantico, focus visibile, touch target minimo 44 px e WCAG AA.
- Mobile-first: breakpoint principale a 768 px.
- Form nuovi con Signal Forms.
- Nessuna chiave Supabase secret/service-role nel frontend.
- Ogni tabella Supabase esposta deve avere RLS e policy least-privilege.

## Architettura

- `core/services/supabase.service.ts`: unico client Supabase.
- `core/services/page-actions.service.ts`: registro globale delle azioni contestuali.
- `shared/components/bottom-dock/`: renderer mobile.
- `shared/components/floating-action-pill/`: renderer desktop.
- `features/`: pagine lazy-loaded.

Le pagine che registrano azioni devono pulirle in `ngOnDestroy`. Il dock e la pill sono montati
una sola volta nella shell.

## Design

- Identità: Beach Volley Hub.
- Token globali in `src/styles.scss`.
- Preset PrimeNG in `src/assets/themes/beach-volley-light.ts`.
- Colori caratteristici: oceano, turchese e arancio torneo.

## Ambienti

Lo script `scripts/write-environment.mjs` genera
`src/environments/environment.production.ts` durante la build usando:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Il file generato è ignorato dal versionamento.
