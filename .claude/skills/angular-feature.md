---
name: angular-feature
description: Use when the user needs to create/update an Angular feature (component + service + store + models + route) that consumes an existing backend endpoint — "crea pagina Angular per X", "nuovo componente con tabella Users", "add frontend for /api/orders", "collega FE al nuovo endpoint", "nuova feature frontend", "pagina di gestione X". Generates standalone component (OnPush, named export, inject()) + HTTP service + SignalStore (BaseEntityStore or custom) + request/response models + layout route. Trigger keywords - "angular feature", "nuovo componente", "crea pagina", "standalone component", "SignalStore", "sharedtable", "lista utenti", "form editing", "frontend per endpoint".
---

# Skill: Angular Feature Generator

> **Anatomia componenti, Signal Forms, BaseEntityStore = `PallavoloMarco.FE/CLAUDE.md`**. Questa skill = procedura passo-passo, NON ripete il codice.

## Quando Usare

- Nuova pagina/feature nel frontend
- Componente con tabella, form, dashboard
- Connettere frontend a endpoint backend esistente

## Input Richiesto

1. **Nome Feature** (es. `products`, `orders`)
2. **Tipo**: `list` (tabella), `form` (creazione/edit), `detail`, `dashboard`
3. **Endpoint Backend** (es. `GET /api/products` → `PageResponseDTO<ProductResponseDTO>`)
4. **Campi** da visualizzare/editare

## Procedura

### Step 1: Prerequisiti

```bash
ls PallavoloMarco.FE/src/app/features/{nome}/ 2>/dev/null || echo "Feature non esiste, la creo"
```

Riferimenti:
- `PallavoloMarco.FE/CLAUDE.md` — regole ALWAYS/NEVER, BaseEntityStore, Signal Forms anatomy, allineamento BE
- `PallavoloMarco.FE/src/app/__esempi_di_uso__/` — pattern tabella esempio
- `PallavoloMarco.FE/src/app/core/store/base.store.ts` — pattern store

### Step 2: Response Model

`PallavoloMarco.FE/src/app/features/{nome}/models/responses/{nome}.response.ts`:

```typescript
export interface {Nome}Response {
  id: number;
  // Allineato al ResponseDTO backend (verifica nullabilità!)
  campo1: string;
  campo2?: string;        // opzionale se backend ha string?
  isActive: boolean;
}
```

### Step 3: Request Models

`models/requests/create-{nome}.request.ts`:
```typescript
export interface Create{Nome}Request {
  // Allineato al Command backend (senza id)
  campo1: string;
  campo2?: string;
}
```

`models/requests/edit-{nome}.request.ts` (se serve):
```typescript
export interface Edit{Nome}Request {
  id: number;
  campo1: string;
  campo2?: string;
}
```

### Step 4: Service HTTP

`services/{nome}.service.ts` — implementa `BaseEntityService<TResponse, TCreateReq, TEditReq>`:

Metodi tipici (definisci solo quelli che servono):
- `getAll = ()` → `Observable<TResponse[]>`
- `getPage = (req: PageOptionsRequest)` → `Observable<PageOptionsModel<TResponse>>` (con `HttpParams` per page/pageSize/search/sortField/sortOrder)
- `getById = (id)` → `Observable<TResponse>`
- `add = (req)` → `Observable<TResponse>`
- `edit = (req)` → `Observable<TResponse>`
- `delete = (id)` → `Observable<void>`

Se serve **normalizzazione** (DTO BE != modello FE): `.pipe(map(items => items.map(i => this.normalize(i))))` con metodi privati `normalize()` / `normalizeArray()`.

`apiUrl = ${environment.apiUrl}/{endpoint}`. Inject `HttpClient` con `inject()`.

### Step 5: Store

**CRUD standard** — `store/{nome}.store.ts`:
```typescript
export const {Nome}Store = signalStore(
  { providedIn: 'root' },
  ...createEntityStoreConfig<{Nome}Response, Create{Nome}Request, Edit{Nome}Request>({
    storeName: '{Nome}',
    serviceToken: {Nome}Service,
    useBackendPagination: true,
  })
);
```

**Con metodi custom** — aggiungi `withMethods` DOPO base config:
```typescript
withMethods((store, service = inject({Nome}Service)) => ({
  loadByParentId$: rxMethod<number>(pipe(
    switchMap(parentId => service.getByParentId(parentId).pipe(
      tapResponse({
        next: (items) => patchState(store, setAllEntities(items), { loading: false }),
        error: (e: Error) => patchState(store, { error: e.message, loading: false })
      })
    ))
  )),
}))
```

### Step 6: Componente (Angular 21)

3 file: `{nome}.ts`, `{nome}.html`, `{nome}.scss`.

**Variante LIST** (`{nome}.ts`):
- `private store = inject({Nome}Store)`
- Signals: `entities`, `loading`, `error`, `totalResults` da store
- `ngOnInit`: `this.store.loadPage$({ page: 1, pageSize: 20 })`
- `onPageChange`: ricalcola page + `loadPage$()`
- `onDelete`: SEMPRE `p-confirmdialog` prima di `store.delete$(id)`

**Variante FORM** (Signal Forms):
- `state = signal<FormState<Create{Nome}Request>>({ ... })`
- `f = form(this.state, (p) => { required(p.campo1, ...); })`
- `onSubmit`: `submit(this.f, async () => { /* store.add$ o store.edit$ */ })`
- Template usa `[formField]="f.campo1"` + `@if (f.campo1().touched() && !f.campo1().valid()) { @for (err of f.campo1().errors(); ...) }`
- `imports: [FormField]` nel componente

**HTML LIST** — gestire 3 stati:
```html
@if (loading()) { <i class="pi pi-spinner pi-spin"></i> }
@else if (error(); as err) { <p-message severity="error" [text]="err" /> }
@else if (entities().length === 0) { <div>Nessun elemento</div> }
@else { <!-- SharedTable o tabella custom --> }
```

### Step 7: Registra Route

`PallavoloMarco.FE/src/app/features/_layout/layout.routes.ts`:
```typescript
{
  path: '{nome}',
  loadComponent: () => import('./../{nome}/{nome}').then(c => c.{NomePascal})
}
```

`PallavoloMarco.FE/src/app/features/_config/global-paths.config.ts`:
```typescript
const {nome}Url: string = '/{nome}';
export const globalPaths = { /* ... */, {nome}Url };
```

### Step 8: Verifica

```bash
cd Frontend && ng build 2>&1 | tail -5
```

## Checklist Finale

- [ ] Modelli response allineati al ResponseDTO backend (nullabilità!)
- [ ] Service implementa `BaseEntityService<T>` con tipi corretti
- [ ] Store con `createEntityStoreConfig` + `useBackendPagination: true`
- [ ] Componente gestisce 3 stati: loading, empty, error
- [ ] Named export (`export class {Nome}`, non default)
- [ ] `inject()` per DI (no constructor injection)
- [ ] Signal-based input/output (no `@Input()`/`@Output()`)
- [ ] Form usa **Signal Forms** (`@angular/forms/signals` + direttiva `FormField`)
- [ ] Control-flow nativo `@if/@for/@switch` (no `*ngIf`/`*ngFor`)
- [ ] Rotta registrata in `layout.routes.ts` + `global-paths.config.ts`
- [ ] Delete con conferma `p-confirmdialog`
- [ ] Zero `any` types
- [ ] Zero `subscribe()` manuale
- [ ] `ng build` passa
