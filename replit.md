# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── think-inn/          # React + Vite frontend (Think-Inn platform)
│   └── mockup-sandbox/     # Component preview server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.
- **IMPORTANT**: After modifying `lib/api-client-react/src/` (e.g. running orval codegen), always rebuild its declarations with `cd lib/api-client-react && npx tsc -p tsconfig.json` before typechecking the frontend. The generated `dist/` must stay in sync with the source.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Community routes: `src/routes/community/` — spaces, threads, posts (with reactions, moderation)
- Admin routes: `src/routes/admin/` — user management, department management
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `artifacts/think-inn` (`@workspace/think-inn`)

React + Vite frontend for the Think-Inn corporate innovation platform.

- **Chat-First philosophy**: all content created via AI chat, no forms
- **AI orchestrator**: Gemini 2.5 Flash with `thinkingConfig: { thinkingBudget: 0 }` for background calls
- **Pages**: VitrinePanel (main dashboard with ARAŞTIRMALAR/FİKİRLER/PROJELER tabs), CommunityPage, AuthPage, Admin pages (UserManagement, DepartmentManagement)
- **Modals**: CardDetailModal (5-tab: Genel Bakış/Araştırmalar/Değerlendirme/AI Analiz/Topluluk), ProjectAnalysisModal (with ProjectManagementSection)
- **3D Graph**: RelationGraph using @react-three/fiber + @react-three/drei + Three.js — glowing spheres, OrbitControls, travelling dot animations, connect mode
- **Features**: Category filter chips in VitrinePanel, CommunityThreadPanel in CardDetailModal, department management in admin, auto-created community threads for ideas/research/projects
- **authFetch**: returns `json.data` directly — never do `.then(r => r.data)` on top
- **API_ORIGIN**: imported from `@/lib/api-config` for direct fetch calls
- Colors: research=#22d3ee, idea=#e2e8f0, project=#c4b5fd; UI accent=#4f46e5

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)
- Key tables: usersTable (with department, role), researchTable (with category), ideasTable (with category, projectStatus, projectTeam, projectDocs, evaluationScores, architecturalAnalysis), departmentsTable, communitySpacesTable, communityThreadsTable (with linkedIdeaId/linkedResearchId), communityPostsTable

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
After codegen, rebuild declarations: `cd lib/api-client-react && npx tsc -p tsconfig.json`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useListResearch`, `useListIdeas`, `Research`, `Idea`).
- Package exports directly from `src/index.ts` (no build step needed for Vite)
- `dist/` contains compiled `.d.ts` declarations for TypeScript project references — must be rebuilt with `npx tsc -p tsconfig.json` after source changes

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
