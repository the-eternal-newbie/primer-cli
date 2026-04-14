# /setup-auth-provider

Configure an identity provider integration with OIDC/OAuth2,
SSO, and MFA support.

## Before executing

Read `docs/skills/auth/knowledge/attack-vectors.md` sections on
identification failures and JWT confusion attacks.
Read `docs/skills/auth/knowledge/frontend-security.md` section on
secure token storage and cookie configuration.

## Steps

1. Select the appropriate provider tier for the project:
   - **Managed (Clerk):** Use for Next.js/React projects requiring
     rapid setup, built-in multi-tenancy, passkeys, and App Router
     support. Zero infrastructure overhead.
   - **Self-hosted (Auth.js v5):** Use when vendor lock-in is
     unacceptable, database-backed sessions are required, or
     full customization is needed.
   - **Framework-agnostic (Better-Auth):** Use for TypeScript
     projects outside the React ecosystem requiring 2FA, RBAC,
     and passkeys without vendor dependency.

2. For Clerk integration:
```typescript
   // Install: pnpm add @clerk/nextjs

   // app/layout.tsx
   import { ClerkProvider } from '@clerk/nextjs';
   export default function RootLayout({ children }) {
     return <ClerkProvider>{children}</ClerkProvider>;
   }

   // middleware.ts
   import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
   const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/api(.*)']);
   export default clerkMiddleware((auth, req) => {
     if (isProtectedRoute(req)) auth().protect();
   });
```

3. For Auth.js v5 integration:
```typescript
   // auth.ts
   import NextAuth from 'next-auth';
   import { PrismaAdapter } from '@auth/prisma-adapter';

   export const { handlers, auth, signIn, signOut } = NextAuth({
     adapter: PrismaAdapter(prisma),
     providers: [/* configure providers */],
     session: { strategy: 'jwt', maxAge: 3600 },
     cookies: {
       sessionToken: {
         options: {
           httpOnly: true,
           secure: process.env.NODE_ENV === 'production',
           sameSite: 'lax', // 'strict' breaks OAuth redirect callbacks
           path: '/',
         },
       },
     },
     callbacks: {
       jwt({ token, user }) {
         if (user) token.role = user.role;
         return token;
       },
       session({ session, token }) {
         session.user.role = token.role;
         return session;
       }
     }
   });
```

4. Configure MFA enforcement:
   - **Clerk:** Enable in Clerk Dashboard → User & Authentication →
     Multi-factor. Enforce via `auth().protect({ role: 'org:member' })`
   - **Auth.js:** Implement TOTP using `otplib` — generate secret,
     store encrypted in user record, verify on each login
   - Prefer TOTP (authenticator app) over SMS OTP — SMS is vulnerable
     to SIM-swap attacks

5. Configure callback and redirect URIs:
   - Register exact callback URIs with the provider — never use
     wildcards or partial matches
   - Validate the `state` parameter on OAuth2 callbacks to prevent
     CSRF attacks
   - Validate `redirect_uri` against an allowlist before redirecting

6. Verify the integration:
```bash
   # Test authentication flow end-to-end
   # Verify HttpOnly cookie is set (not accessible via document.cookie)
   # Verify token is not present in localStorage
   # Verify protected routes return 401/403 without valid session
```

7. Document the auth architecture in `docs/CANONICAL_ARCHITECTURE.md`
   including provider choice rationale, session strategy, and MFA policy.

## Do not

- Never store tokens in localStorage or expose them to client JavaScript
- Never accept `alg: none` JWTs or multiple algorithm types
- Never use SMS as the sole MFA factor for high-security applications
- Never skip state parameter validation on OAuth2 callbacks
- Never use wildcard redirect URIs with any identity provider