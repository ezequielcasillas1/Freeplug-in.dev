# Architecture Deep Reference

Full reference for the project's architectural decisions. Read this when you need to understand the overall system, not just a single task.

## Guiding Principles

1. **Feature-first over layer-first**: Code is organized by what it does (auth, dashboard, posts), not by what it is (components, hooks, services).
2. **Interface-first development**: Define contracts (TypeScript interfaces + Zod schemas) before writing implementations.
3. **Use-case pattern for business logic**: Every distinct user action lives in its own file inside `use-cases/`. Nothing else owns business logic.
4. **Middleware composition for cross-cutting concerns**: Error handling, logging, auth, and validation apply to use-cases via a compose chain — never duplicated.
5. **AI-safe by design**: Naming, structure, and schemas are explicit so AI agents cannot fabricate IDs, misplace logic, or invent abstractions.

---

## Full Directory Map

```
src/
├── app/                             # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx           # Server Component
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx               # Auth-guarded layout
│   │   └── page.tsx
│   ├── api/
│   │   └── {resource}/route.ts      # Route handlers
│   ├── globals.css
│   └── layout.tsx                   # Root layout
│
├── features/                        # All domain logic
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── use-cases/
│   │   ├── services/
│   │   ├── types/
│   │   └── index.ts
│   ├── {feature}/
│   │   └── ...same structure
│   └── shared/                      # Cross-feature shared logic (use sparingly)
│
├── components/
│   ├── ui/                          # CVA-based design system primitives
│   │   ├── button/
│   │   │   ├── Button.tsx
│   │   │   └── index.ts
│   │   ├── card/
│   │   ├── input/
│   │   └── badge/
│   └── shared/                      # Layout, navigation, page wrappers
│       └── PageTransition.tsx
│
├── lib/
│   ├── api/
│   │   └── index.ts                 # Typed API client
│   ├── auth/
│   │   └── session.ts               # Session utilities
│   ├── errors/
│   │   └── app-error.ts             # Error hierarchy
│   ├── middleware/
│   │   ├── compose.ts               # createUseCaseService
│   │   ├── auth.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── logger.middleware.ts
│   └── utils/
│       └── cn.ts                    # Tailwind class merger
│
└── types/
    └── global.d.ts                  # Global ambient types only
```

---

## The Middleware System

Cross-cutting concerns (auth, validation, logging, errors) are applied through a compose chain:

```ts
// src/lib/middleware/compose.ts
type Next<T, R> = (input: T) => Promise<R>
type Middleware<T, R> = (next: Next<T, R>) => Next<T, R>

export function createUseCaseService<T, R>(...middlewares: Middleware<T, R>[]) {
  return function execute(useCase: Next<T, R>, input: T): Promise<R> {
    const composed = middlewares.reduceRight((acc, mw) => mw(acc), useCase)
    return composed(input)
  }
}

// Pre-composed services for common combinations
export const publicService = createUseCaseService(loggerMiddleware, errorMiddleware)
export const authService = createUseCaseService(loggerMiddleware, errorMiddleware, authMiddleware)
export const adminService = createUseCaseService(loggerMiddleware, errorMiddleware, authMiddleware, adminRoleMiddleware)
```

Usage in a feature's hook or server action:

```ts
import { authService } from '@/lib/middleware/compose'
import { createPost } from '../use-cases/create-post'

// Validation + auth + logging + error handling — applied automatically
const post = await authService(createPost, { title: 'Hello', body: '...' })
```

---

## Data Flow

```
User Action (form submit / button click)
        ↓
Server Action or API Route Handler
        ↓
Middleware Chain (auth → validate → log)
        ↓
Use Case (business logic, single responsibility)
        ↓
Service (API call / server fetch)
        ↓
Repository (data access interface)
        ↓
API Response → Zod validation → typed entity returned
        ↓
React Server Component fetches + passes data to Client Component
        ↓
UI renders with Tailwind + CVA + Framer Motion
```

---

## ID Lifecycle

```
Server assigns id (UUID v4 from DB)
        ↓
API response returns { id: "...", ...data }
        ↓
Zod schema validates: id must be z.string().uuid()
        ↓
Frontend stores id in React Query cache (never in useState as a new entity)
        ↓
id is passed as prop only to components that need to route or reference it
        ↓
userId comes from session.user.id only — never generated, never stored separately
```

**The frontend is a READ ONLY consumer of IDs. It receives them; it never creates them.**

---

## Dependency Direction

```
app/ (pages)
    ↓ imports from
features/ (domain modules)
    ↓ imports from
lib/ (utilities, middleware, API client)
    ↓ imports from
types/ (global types)

✅ Direction always flows downward.
❌ lib/ must NEVER import from features/
❌ features/ must NEVER import from app/
❌ One feature must NEVER deep-import another feature's internals
```

---

## State Management Decision Tree

```
Is the data from the server?
  → YES: Use React Server Components (no useState) or TanStack Query (useQuery)
  → NO:
      Is it local to one component?
        → YES: useState / useReducer
        → NO:
            Is it global UI state (theme, modals)?
              → YES: React Context or Zustand
              → NO: Evaluate if you actually need global state (you probably don't)
```

---

## Testing Approach

- **Unit tests**: Use-cases and services only. Input → output, no UI.
- **Component tests**: Use React Testing Library. Test behavior (what the user sees), not implementation.
- **No snapshot tests**: They are brittle and teach AI nothing useful.
- **Mock at the repository level**: Swap `MockUserRepository` for real repo in tests without touching business logic.
