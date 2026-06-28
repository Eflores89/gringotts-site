@AGENTS.md

# Gringotts

Personal finance tracker. Next.js app replacing a Notion+Lambda stack.

## Dev commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # eslint
npx drizzle-kit push   # push schema changes to Turso DB
npx drizzle-kit studio # DB browser UI
```

## Environment variables

Required in `.env.local`:
```
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
AUTH_PASSWORD=
AUTH_SECRET=
```

Get values from Vercel env or ask Eduardo.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack) — read `node_modules/next/dist/docs/` before using any Next.js API
- **Database**: Turso (libSQL) + Drizzle ORM. Schema source of truth: `src/db/schema.ts`
- **UI**: shadcn/ui (new-york), Tailwind v4, radix-ui, lucide-react, recharts, @xyflow/react
- **Data fetching**: TanStack Query on the client, direct Drizzle calls in route handlers
- **Forms**: react-hook-form + zod
- **Auth**: Single shared password. JWT in httpOnly cookie via `jose`. `proxy.ts` (Next 16 middleware) does redirects. Every route handler calls `requireAuth()` from `src/lib/auth.ts`
- **Linter**: Biome (not ESLint for formatting)

## File structure

```
src/
  app/
    (app)/              # authenticated pages — each folder is a route
      budget/
      cashflow/
      spending/
      investments/
      allocations/
      categories/
      rules/
      controllership/   # company ownership graph + loans
      auxiliary/
    api/                # route handlers (one file per resource)
      budget/
      spending/
      investments/
      controllership/
      ...
    login/
    quick-spend/        # unauthenticated shortcut page
  components/
    shell/              # Sidebar, layout wrappers
    ui/                 # shadcn components (do not edit)
  db/
    index.ts            # Drizzle client (import `db` from here)
    schema.ts           # all tables defined here
  lib/
    auth.ts             # requireAuth(), createToken()
    utils.ts
    db/
      repos/            # one file per domain: spending.ts, budget.ts, etc.
  hooks/                # TanStack Query hooks, one per domain
proxy.ts                # Next 16 middleware (replaces middleware.ts)
drizzle/                # migration SQL files (generated, do not edit)
```

## Patterns

**Route handler auth:**
```ts
export async function GET(req: Request) {
  await requireAuth(req)
  // ...
}
```

**DB access:** Always go through `src/lib/db/repos/` — never write raw Drizzle queries in route handlers.

**Client data fetching:** Use the hook from `src/hooks/` for the domain. If none exists, create one following the same pattern as existing hooks.

**Adding a new feature:**
1. Add table(s) to `src/db/schema.ts`
2. Run `npx drizzle-kit push` to apply to DB
3. Add repo file in `src/lib/db/repos/`
4. Add API route handlers in `src/app/api/<feature>/`
5. Add TanStack Query hook in `src/hooks/`
6. Add page in `src/app/(app)/<feature>/`
7. Add sidebar link in `src/components/shell/Sidebar.tsx`

## UI conventions

- shadcn/ui only — no other component libraries
- Emerald/green accent (`emerald-*`) on pure neutral black backgrounds
- No colored tint on surfaces, cards, or tables — keep them neutral black/white
- Chart colors: emerald, gold, teal, sage, copper
- Saira font (already configured), `tabular-nums` on all numeric content
- Dark mode first; theme toggle available
- Toasts via `sonner`
