# ID Rules — Complete Reference

This is the definitive guide to how identifiers work in this project. Every rule here exists to prevent AI agents from fabricating IDs.

## The Problem This Solves

AI coding agents routinely:
- Auto-generate `crypto.randomUUID()` for new entities on the client
- Add `id` fields to component `useState` initializers
- Create phantom `tempId` or `clientId` fields "for tracking"
- Sprinkle `uuid()` calls throughout hooks and utility files

All of these are **bugs**. They introduce fake data into the system, cause referential integrity failures, and are invisible until production.

## Rule Table

| Scenario | Correct Behavior | Forbidden Behavior |
|---|---|---|
| Creating a new entity | Send `CreateDTO` (no id) to server; server returns entity with `id` | ❌ `id: crypto.randomUUID()` on client |
| Identifying current user | Read `session.user.id` from auth session | ❌ Store userId in `useState` separately |
| Rendering a list | Use `item.id` from server data as React `key` | ❌ Use `index` as key for stable lists |
| Optimistic updates | Use a `_optimisticKey` (temp, non-entity) | ❌ Use a fabricated UUID as a real entity id |
| Routing to an entity page | Use `id` received from server data | ❌ Push to route with self-generated id |

## The One Exception: Optimistic Updates

For optimistic UI updates (showing a new item before the server confirms), use a **clearly named temporary key** that is NEVER treated as a real entity ID:

```ts
// hooks/use-posts.ts
import { useOptimistic } from 'react' // React 19+ / canary

export function usePosts(serverPosts: Post[]) {
  const [optimisticPosts, addOptimistic] = useOptimistic(
    serverPosts,
    (state, newPost: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>) => [
      ...state,
      {
        ...newPost,
        id: `__optimistic__${Date.now()}`, // ← clearly temporary, prefixed
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
  )

  async function create(dto: CreatePostDto, userId: string) {
    addOptimistic({ ...dto, authorId: userId }) // show immediately
    const real = await createPost(dto, userId)   // server assigns real id
    return real
  }

  return { posts: optimisticPosts, create }
}
```

Key: the `__optimistic__` prefix makes it obviously non-real. Never pass this to an API route, navigation, or store it in persistent state.

## Schema Enforcement

Every entity schema enforces this at the type level:

```ts
// The full entity — id is required (comes FROM server)
const PostSchema = z.object({
  id: z.string().uuid(),           // ← server-assigned, never client-generated
  title: z.string(),
  authorId: z.string().uuid(),     // ← comes from session.user.id
  createdAt: z.date(),
  updatedAt: z.date(),
})

// The create DTO — id is structurally impossible to include
const CreatePostDtoSchema = PostSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
// TypeScript will error if you try to pass `id` to a function accepting CreatePostDto
```

This means **TypeScript itself enforces the rule**. An AI agent that tries to include `id` in a create call gets a compile error.

## Session-Based userId

```ts
// ✅ Correct way to get userId in a Server Action or Route Handler
import { getServerSession } from 'next-auth'

export async function myAction(data: SomeDto) {
  const session = await getServerSession()
  const userId = session?.user?.id
  if (!userId) throw new UnauthorizedError()
  // Now use userId — it came from the auth provider, not fabricated
}

// ✅ Correct way in a Client Component hook (read-only reference)
import { useSession } from 'next-auth/react'

export function useCurrentUserId(): string {
  const { data: session } = useSession()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user.id // ← reading, not creating
}
```

## Checklist Before Merging Any PR

- [ ] No `crypto.randomUUID()`, `uuid()`, or `nanoid()` calls outside of test factories and mock repositories
- [ ] No `id` field in any `useState` initializer for a new (unsaved) entity
- [ ] No `id` prop on components that don't need it for routing
- [ ] All `CreateDtoSchema` definitions omit `id`, `createdAt`, `updatedAt`
- [ ] `userId` is always sourced from `session.user.id`, never from local state
