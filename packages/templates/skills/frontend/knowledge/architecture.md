# Feature-Sliced Design (FSD)

Feature-Sliced Design is a frontend architectural methodology that
organizes code by business domain rather than technical type.
It prevents circular dependencies, enables independent team ownership,
and provides AI agents with deterministic rules for where code belongs.

## Why FSD Over Traditional Organization

**Traditional organization (by type):**
```
src/
  components/   ← everything mixed together
  hooks/        ← all hooks regardless of domain
  utils/        ← grows into a dumping ground
  pages/        ← routing
```

Problems: circular dependencies appear naturally, no rule prevents
a `components/Button` from importing from `components/UserProfile`,
which imports from `components/PaymentForm`. Refactoring requires
understanding the entire graph.

**FSD organization (by domain and layer):**
```
src/
  app/          ← global setup, providers, routing
  pages/        ← page compositions
  widgets/      ← independent UI blocks
  features/     ← user interactions with business value
  entities/     ← business objects
  shared/       ← reusable infrastructure
```

The import direction rule eliminates circular dependencies:
**each layer can only import from layers below it.**

---

## The Six Layers

### app/
Global application setup. Providers, global styles, routing configuration,
middleware. Contains no business logic.

```
app/
  providers.tsx       ← QueryClientProvider, ThemeProvider, etc.
  layout.tsx          ← root layout
  globals.css         ← global styles
```

### pages/
Route-level components. Compose widgets and features. Contain no
business logic — they are pure compositions.

```
pages/
  dashboard/
    ui/
      DashboardPage.tsx   ← composes widgets
```

### widgets/
Self-contained UI blocks that combine multiple features and entities.
A widget is a meaningful piece of UI that could exist independently
on any page.

```
widgets/
  header/
    ui/
      Header.tsx
    index.ts            ← public API of the widget
  sidebar/
  product-card/
```

### features/
User interactions that deliver business value. A feature is something
a user does: "add to cart", "submit review", "toggle dark mode".

```
features/
  add-to-cart/
    ui/
      AddToCartButton.tsx
    model/
      add-to-cart.store.ts
    api/
      add-to-cart.api.ts
    index.ts
  auth-by-email/
  toggle-theme/
```

### entities/
Core business objects. An entity represents a domain concept:
User, Product, Order, Article. Entities contain the data shape
and basic UI representations of that object.

```
entities/
  user/
    ui/
      UserAvatar.tsx
      UserBadge.tsx
    model/
      user.types.ts
      user.store.ts
    api/
      user.api.ts
    index.ts
  product/
  order/
```

### shared/
Reusable infrastructure with no business logic. UI kit components,
API client configuration, utility functions, type utilities.

```
shared/
  ui/
    Button.tsx
    Input.tsx
    Modal.tsx
  api/
    client.ts         ← axios/fetch configuration
  lib/
    format-date.ts
    cn.ts             ← classnames utility
  config/
    env.ts
```

---

## The Import Direction Rule

```
app     → can import from: pages, widgets, features, entities, shared
pages   → can import from: widgets, features, entities, shared
widgets → can import from: features, entities, shared
features → can import from: entities, shared
entities → can import from: shared
shared  → cannot import from any other layer
```

**Violations to detect and refuse:**
```typescript
// shared importing from entities — VIOLATION
// shared/ui/Button.tsx
import { User } from '@/entities/user'; // ← shared cannot import entities

// entities importing from features — VIOLATION
// entities/user/ui/UserCard.tsx
import { AddToCartButton } from '@/features/add-to-cart'; // ← entities cannot import features

// features importing from widgets — VIOLATION
// features/auth/ui/LoginForm.tsx
import { Header } from '@/widgets/header'; // ← features cannot import widgets
```

---

## Segments Within a Slice

Each slice (within a layer) is further organized by technical segment:

| Segment | Contents |
|---|---|
| `ui/` | React components — presentation only |
| `model/` | State management, business logic, types |
| `api/` | Data fetching, server communication |
| `lib/` | Utilities specific to this slice |
| `config/` | Constants, configuration |
| `index.ts` | Public API — only exports from here are used externally |

**The public API rule:** External code only imports from a slice's
`index.ts`, never from internal files directly.

```typescript
// CORRECT — importing from the public API
import { UserAvatar } from '@/entities/user';

// WRONG — importing from an internal file
import { UserAvatar } from '@/entities/user/ui/UserAvatar';
```

---

## FSD with Next.js App Router

Next.js App Router uses a file-system router that conflicts with FSD's
`pages/` layer. The recommended reconciliation:

```
src/
  app/                  ← Next.js App Router (routing only)
    dashboard/
      page.tsx          ← thin: imports from @/pages/dashboard
    layout.tsx
  pages/                ← FSD pages layer (actual page logic)
    dashboard/
      ui/
        DashboardPage.tsx
  widgets/
  features/
  entities/
  shared/
```

Configure path aliases in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/app/*": ["./src/app/*"],
      "@/pages/*": ["./src/pages/*"],
      "@/widgets/*": ["./src/widgets/*"],
      "@/features/*": ["./src/features/*"],
      "@/entities/*": ["./src/entities/*"],
      "@/shared/*": ["./src/shared/*"]
    }
  }
}
```