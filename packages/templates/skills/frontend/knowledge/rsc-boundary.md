# React Server Components and the Network Boundary

The RSC architecture introduces a strict serialization boundary between
server and client execution environments. Understanding this boundary
is the prerequisite for all Next.js App Router development.

## The Boundary Defined

Server Components execute on the server and never ship JavaScript to
the client. Client Components execute on the client (and during SSR
on the server). The boundary is declared with `'use client'`.

```
Server Component → renders → serialized UI description → network → Client Component hydrates
```

The critical constraint: only serializable values can cross this boundary.
The server cannot pass a function reference to a client component because
functions cannot be serialized to JSON.

---

## What Can Cross the Boundary

**Serializable (safe to pass as props):**
- Primitives: string, number, boolean, null, undefined
- Plain objects and arrays containing only serializable values
- Dates serialized as ISO strings (not Date instances)
- BigInt values
- JSX (React elements — these are serialized as a special format)

**Non-serializable (will throw or cause silent failures):**
- Ordinary functions, arrow functions, and event handlers passed as props
- Class instances (including Date objects, Map, Set, RegExp)
- DOM nodes
- Symbols
- React hooks (useState, useReducer, useEffect) — hooks only run
  in Client Components and cannot be called in Server Components
  or passed across the boundary

**Special case — Server Actions:**
Server Actions are functions defined with `'use server'` that *can*
be passed from Server Components to Client Components. They are not
serialized as function references — Next.js replaces them with a
special network reference (an RPC stub) at build time. This is why
they work across the boundary while ordinary functions do not.

```typescript
// Server Action — crosses the boundary as a special RPC reference
'use server'
async function submitForm(formData: FormData) { ... }

// Passing a Server Action as a prop is allowed
<ClientForm action={submitForm} /> // ✓ works — submitForm is an RPC stub

// Passing an ordinary function as a prop is not allowed
const handler = () => console.log('clicked');
<ClientComponent onClick={handler} /> // ✗ fails — not serializable
```

```typescript
// Server Component — WRONG
async function ServerComponent() {
  const date = new Date(); // Date instance — not serializable
  const handler = () => console.log('clicked'); // function — not serializable

  return <ClientComponent date={date} onClick={handler} />;
  // ^ Both props will fail at the boundary
}

// Server Component — CORRECT
async function ServerComponent() {
  const dateString = new Date().toISOString(); // string — serializable

  return <ClientComponent dateString={dateString} />;
  // onClick must be defined inside the Client Component
}
```

---

## The Cost of Every Client Boundary

Every `'use client'` directive marks a boundary where JavaScript
is included in the client bundle. Everything imported by a Client
Component also becomes client JavaScript.

```typescript
// This makes ALL of heavy-library available to the client bundle
'use client'
import { HeavyComponent } from 'heavy-library'; // 200KB added to bundle
```

**Minimize client boundaries by pushing them to leaf nodes:**

```
// Anti-pattern: boundary too high
'use client' // Everything below is client JS
export function ProductPage() {
  return (
    <div>
      <StaticHeader />      // Could be a Server Component
      <ProductDetails />    // Could be a Server Component
      <AddToCartButton />   // Only this needs to be a Client Component
    </div>
  );
}

// Correct: boundary at the leaf
// ProductPage, StaticHeader, ProductDetails remain Server Components
// Only AddToCartButton is 'use client'
```

---

## Passing Data Across the Boundary

**Pattern 1: Serialize at the server, deserialize at the client**
```typescript
// Server Component
async function OrderSummary() {
  const order = await db.orders.findUnique({ where: { id } });

  return (
    <OrderClient
      // Pass only what the client needs — not the entire DB record
      orderId={order.id}
      totalCents={order.totalCents}
      status={order.status}
      // Never pass: order.internalNotes, order.paymentMethodId
    />
  );
}
```

**Pattern 2: Lifting data fetching to the server**
```typescript
// Instead of fetching in a Client Component (requires useEffect):
'use client'
export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  useEffect(() => { fetch(`/api/users/${userId}`).then(...) }, [userId]);
  // ^ Waterfall: render → useEffect → fetch → render
}

// Fetch in a Server Component and pass the data down:
async function UserProfile({ userId }: { userId: string }) {
  const user = await db.users.findUnique({ where: { id: userId } });
  return <UserProfileClient name={user.name} avatarUrl={user.avatarUrl} />;
  // ^ No waterfall, no client-side fetch, no loading state needed
}
```

**Pattern 3: Server Actions for mutations**
```typescript
// Mutations cross the boundary via Server Actions — not API routes
'use server'
export async function updateProfile(formData: FormData) {
  const name = formData.get('name') as string;
  await db.users.update({ where: { id: getCurrentUserId() }, data: { name } });
  revalidatePath('/profile');
}

// Client Component uses the action directly
'use client'
export function ProfileForm() {
  return (
    <form action={updateProfile}>
      <input name="name" />
      <button type="submit">Save</button>
    </form>
  );
}
```

---

## When to Use Client Components

Use `'use client'` only when the component requires:
- Browser APIs (window, document, navigator, localStorage)
- React state (useState, useReducer)
- React effects (useEffect, useLayoutEffect)
- Event handlers that need closure over state
- Third-party libraries that use the above

If none of these apply, the component should be a Server Component.

---

## Next.js App Router Caching

Next.js caches aggressively at multiple layers:

| Cache | What it stores | Invalidation |
|---|---|---|
| Request memoization | `fetch()` results per request | Automatic per request |
| Data cache | `fetch()` results across requests | `revalidatePath()`, `revalidateTag()`, time-based |
| Full route cache | Rendered HTML and RSC payload | On deployment, `revalidatePath()` |
| Router cache | RSC payload in browser | Navigation, `router.refresh()` |

Understanding cache invalidation is required before any data mutation.
Calling `revalidatePath('/dashboard')` after a mutation ensures the
next request gets fresh data instead of stale cached HTML.