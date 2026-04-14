# /scaffold-architecture

Initialize a Next.js frontend with Feature-Sliced Design directory
structure, path aliases, and layer boundary enforcement.

## Before executing

Read `docs/skills/frontend/knowledge/architecture.md` in full —
particularly the "FSD with Next.js App Router" section.

## Steps

1. Create the FSD directory structure:
```bash
   mkdir -p src/app
   mkdir -p src/pages
   mkdir -p src/widgets
   mkdir -p src/features
   mkdir -p src/entities
   mkdir -p src/shared/{ui,api,lib,config}
```

2. Configure path aliases in `tsconfig.json`:
```json
   {
     "compilerOptions": {
       "baseUrl": ".",
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

3. Verify Next.js picks up the tsconfig.json path aliases automatically:
```bash
   pnpm build 2>&1 | grep -i "alias\|cannot find module"
```
   Next.js reads `tsconfig.json` `paths` automatically via its
   built-in webpack configuration — no additional `next.config.ts`
   changes are needed for path aliases. If imports fail to resolve,
   verify `baseUrl` is set to `"."` in `tsconfig.json` and restart
   the dev server.

   For non-Next.js setups or custom webpack configurations that do
   not read tsconfig paths automatically:
```typescript
   // next.config.ts (only needed if automatic resolution fails)
   import path from 'node:path';
   import type { NextConfig } from 'next';

   const config: NextConfig = {
     webpack(webpackConfig) {
       webpackConfig.resolve.alias = {
         ...webpackConfig.resolve.alias,
         '@/app': path.resolve('./src/app'),
         '@/pages': path.resolve('./src/pages'),
         '@/widgets': path.resolve('./src/widgets'),
         '@/features': path.resolve('./src/features'),
         '@/entities': path.resolve('./src/entities'),
         '@/shared': path.resolve('./src/shared'),
       };
       return webpackConfig;
     },
   };

   export default config;
```

4. Install and configure the FSD ESLint plugin to enforce
   import direction rules:
```bash
   pnpm add -D @feature-sliced/eslint-config
```

   Add to `eslint.config.js`:
```javascript
   import fsdPlugin from '@feature-sliced/eslint-config';

   export default [
     ...fsdPlugin.configs.recommended,
     {
       settings: {
         'import/resolver': {
           typescript: { alwaysTryTypes: true },
         },
       },
     },
   ];
```

5. Create the shared UI foundation:
```bash
   # Initialize Shadcn/ui
   pnpm dlx shadcn@latest init

   # Install core primitives
   pnpm dlx shadcn@latest add button input label card dialog
```

6. Create the shared API client:
```typescript
   // src/shared/api/client.ts
   export const apiClient = {
     get: async <T>(url: string): Promise<T> => {
       const response = await fetch(url, {
         headers: { 'Content-Type': 'application/json' },
       });
       if (!response.ok) throw new Error(`API error: ${response.status}`);
       return response.json();
     },
     post: async <T>(url: string, body: unknown): Promise<T> => {
       const response = await fetch(url, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(body),
       });
       if (!response.ok) throw new Error(`API error: ${response.status}`);
       return response.json();
     },
   };
```

7. Create index files for each layer with explicit public API comments:
```typescript
   // src/shared/ui/index.ts
   // Public API for shared UI components
   // Only export components intended for use across the application
   export { Button } from './Button';
   export { Input } from './Input';
```

8. Verify the setup by running the linter:
```bash
   pnpm lint
   # Should pass with no FSD import violations
```

## Do not

- Never import from a layer's internal files — only from index.ts
- Never place business logic in the shared layer
- Never create circular dependencies between slices in the same layer
- Never skip the ESLint plugin — manual enforcement degrades over time