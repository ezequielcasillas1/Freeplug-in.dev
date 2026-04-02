# Example Feature: Posts

A complete, working example of the `posts` feature following all architecture rules. Use this as a reference when scaffolding new features.

## File Tree

```
src/features/posts/
├── components/
│   ├── PostCard.tsx
│   ├── PostList.tsx
│   ├── PostForm.tsx
│   └── animations/
│       └── post.variants.ts
├── hooks/
│   └── use-posts.ts
├── use-cases/
│   ├── create-post.ts
│   ├── get-posts.ts
│   └── delete-post.ts
├── services/
│   └── post.service.ts
├── repositories/
│   ├── post.repository.ts
│   └── mock/
│       └── mock-post.repository.ts
├── types/
│   └── post.schema.ts
└── index.ts
```

---

## `types/post.schema.ts`

```ts
import { z } from 'zod'

export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  authorId: z.string().uuid(), // sourced from session only
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Post = z.infer<typeof PostSchema>

export const CreatePostDtoSchema = PostSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type CreatePostDto = z.infer<typeof CreatePostDtoSchema>

export const UpdatePostDtoSchema = PostSchema.pick({ title: true, body: true }).partial()
export type UpdatePostDto = z.infer<typeof UpdatePostDtoSchema>
```

---

## `repositories/post.repository.ts`

```ts
import type { Post, CreatePostDto } from '../types/post.schema'

export interface PostRepository {
  getAll(): Promise<Post[]>
  getById(id: string): Promise<Post | null>
  create(data: CreatePostDto): Promise<Post>
  delete(id: string): Promise<void>
}
```

---

## `services/post.service.ts`

```ts
import { api } from '@/lib/api'
import type { CreatePostDto, Post } from '../types/post.schema'

export const postService = {
  getAll: (): Promise<Post[]> => api.get('/posts'),
  create: (data: CreatePostDto): Promise<Post> => api.post('/posts', data),
  delete: (id: string): Promise<void> => api.delete(`/posts/${id}`),
}
```

---

## `use-cases/create-post.ts`

```ts
import { getServerSession } from 'next-auth'
import { UnauthorizedError } from '@/lib/errors/app-error'
import { CreatePostDtoSchema, type CreatePostDto } from '../types/post.schema'
import { postService } from '../services/post.service'

export async function createPost(input: CreatePostDto) {
  const session = await getServerSession()
  if (!session?.user?.id) throw new UnauthorizedError()

  // Validate — id NOT part of this schema, so it's impossible to pass one
  const validated = CreatePostDtoSchema.parse(input)

  return postService.create({
    ...validated,
    authorId: session.user.id, // ← only userId reference allowed
  })
}
```

---

## `components/animations/post.variants.ts`

```ts
import type { Variants } from 'framer-motion'

export const postCardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

export const postListStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
```

---

## `components/PostCard.tsx`

```tsx
'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { postCardVariants } from './animations/post.variants'
import type { Post } from '../types/post.schema'

interface PostCardProps {
  post: Post // receives post from server — id is already on the post object
  className?: string
}

export function PostCard({ post, className }: PostCardProps) {
  return (
    <motion.article
      variants={postCardVariants}
      className={cn('rounded-lg border bg-white p-4 shadow-sm', className)}
    >
      <h2 className="font-semibold text-gray-900">{post.title}</h2>
      <p className="mt-2 text-sm text-gray-600 line-clamp-3">{post.body}</p>
    </motion.article>
  )
}
```

---

## `components/PostList.tsx`

```tsx
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { postListStagger } from './animations/post.variants'
import { PostCard } from './PostCard'
import type { Post } from '../types/post.schema'

interface PostListProps {
  posts: Post[]
}

export function PostList({ posts }: PostListProps) {
  return (
    <motion.div
      variants={postListStagger}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <AnimatePresence>
        {posts.map((post) => (
          // ✅ key uses post.id from server — never generated here
          <PostCard key={post.id} post={post} />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
```

---

## `index.ts` (Public API)

```ts
// ONLY export what other features and app/ pages need
export { PostList } from './components/PostList'
export { PostCard } from './components/PostCard'
export { PostForm } from './components/PostForm'
export { usePosts } from './hooks/use-posts'
export type { Post, CreatePostDto } from './types/post.schema'

// ❌ Do NOT export: postService, postRepository, use-cases, internal schemas
```

---

## `src/app/(dashboard)/posts/page.tsx`

```tsx
// ✅ Server Component — fetches data, passes to client component
import { postService } from '@/features/posts/services/post.service'
import { PostList } from '@/features/posts'

export default async function PostsPage() {
  const posts = await postService.getAll()
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Posts</h1>
      <PostList posts={posts} />
    </main>
  )
}
```
