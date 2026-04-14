# Frontend Security Boundaries

The browser is an untrusted execution environment. Security decisions
made at the frontend layer are advisory only — they must always be
backed by server-side enforcement. However, frontend security
configurations meaningfully reduce the attack surface.

## Secure Token Storage

**Never use localStorage for auth tokens.**

localStorage is accessible to any JavaScript running on the page.
A single XSS vulnerability — in your code, a dependency, or a
third-party script — exposes every token stored there.

**Correct approach: HttpOnly cookies.**

```typescript
// Server sets the cookie — never accessible to JavaScript
res.cookie('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',  // use 'strict' only when OAuth/OIDC redirects are not involved
  maxAge: 3600000,
  path: '/',
});
```

**SameSite guidance:**
- `strict`: maximum protection, but blocks cookies on cross-site top-level
  navigation. Breaks OAuth/OIDC redirect flows where the IdP redirects back
  to your app after authentication. Use only for non-OAuth session cookies.
- `lax` (recommended default): allows cookies on top-level GET navigations
  (OAuth callbacks) while blocking cross-site POST requests. Compatible with
  all major OAuth/OIDC flows.
- `none`: requires `secure: true`, allows all cross-site requests.
  Use only for embedded widgets or cross-domain API calls.

**Auth.js v5 configuration:**
```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
    },
  },
});
```

**Clerk configuration:**
Clerk handles cookie security automatically for server-rendered
applications. For client-side rendering, use Clerk's SDK methods
(`useAuth()`, `getToken()`) — never extract and store the token manually.

---

## Content Security Policy (CSP)

CSP is a browser mechanism that restricts which resources can be
loaded and executed on a page. A correctly configured CSP eliminates
most XSS impact even when injection occurs.

**Strict CSP (recommended):**
```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'nonce-{random}';
  img-src 'self' data: https://cdn.example.com;
  connect-src 'self' https://api.example.com;
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

**Next.js CSP with nonce:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  // Use the global Web Crypto API and Edge-safe base64 encoding
  const array = new Uint8Array(16);
  globalThis.crypto.getRandomValues(array);
  const nonce = btoa(String.fromCharCode(...array));
  const cspHeader = `
    default-src 'none';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    connect-src 'self';
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, ' ').trim();

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);
  return response;
}
```

**Runtime note:** Next.js Middleware runs on the Edge runtime by default
where `node:crypto` is unavailable. The Web Crypto API (`crypto.getRandomValues`)
works in both Edge and Node.js runtimes. If you need Node.js runtime for
middleware, add `export const runtime = 'nodejs'` to the middleware file.

**CSP violation reporting:**
```
Content-Security-Policy-Report-Only: ...; report-uri /csp-violations
```
Run in report-only mode before enforcing to identify legitimate
violations before blocking them.

---

## CORS Configuration

CORS controls which origins can make cross-site requests to your API.

**Principle:** Never use `Access-Control-Allow-Origin: *` for
authenticated API endpoints.

```typescript
// Next.js API route CORS
const ALLOWED_ORIGINS = [
  'https://app.example.com',
  'https://admin.example.com',
];

export function corsMiddleware(req: Request, res: Response) {
  const origin = req.headers.get('origin');

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // Never reflect arbitrary origins — always validate against allowlist
}
```

**Common CORS mistakes:**
- Reflecting the `Origin` header without validation: allows any origin
- Including `Access-Control-Allow-Credentials: true` with wildcard origin:
  browsers reject this combination, but the intent is dangerous
- Allowing `null` origin: exploitable via sandboxed iframes

---

## Additional Security Headers

Every production application must set these headers:

```typescript
// next.config.ts
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];
```

**Strict-Transport-Security (HSTS):** Forces HTTPS for all future
requests. The `preload` directive submits the domain to browser
HSTS preload lists — this is irreversible, do not set without
understanding the commitment.