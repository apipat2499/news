# Repository Guidelines

## Project Structure & Module Organization
Keep the repo predictable so new agents can ramp quickly. Source code lives in `src/`, grouped by domain (`src/features/articles`, `src/features/auth`, etc.) and backed by shared utilities in `src/lib`. UI primitives belong in `src/components`. Place integration-facing assets (icons, fonts, fixtures) inside `public/assets`. Tests mirror the tree under `tests/` using the same folder names so `src/features/articles/parser.ts` is validated by `tests/features/articles/parser.test.ts`. Automation or data-seeding helpers go in `scripts/` and should be idempotent.

## Build, Test, and Development Commands
Use Node 20.x with `pnpm` to ensure deterministic installs.
- `pnpm install` — hydrate dependencies after every branch switch.
- `pnpm run dev` — start the local server with hot reload; binds to `http://localhost:3000`.
- `pnpm run build` — create a production bundle and surface type errors.
- `pnpm run lint` — run ESLint plus TypeScript checks; fails on warnings.
- `pnpm run test` — execute the full test suite in watchless mode.

## Coding Style & Naming Conventions
Follow TypeScript strict mode with 2-space indentation. Prefer functional React components, hooks, and composition over inheritance. Name files with kebab-case (`news-feed.tsx`), hooks with `useX`, and utilities with verb-first names (`formatDate`). Keep CSS modules in the same directory as their components (`NewsFeed.module.css`). Run `pnpm run lint` before pushing; Prettier is enforced via `.prettierrc` defaults (semi-colons on, single quotes).

## Testing Guidelines
Jest + Testing Library drive unit and integration coverage; Vitest alternatives are acceptable only with approval. Co-locate mocks under `tests/__mocks__`. Name specs `*.test.ts` (unit) and `*.spec.ts` (integration). Aim for 80% line coverage overall and 100% around parsing, auth, and publishing flows. Run `pnpm run test -- --coverage` before opening a PR and attach the summary when coverage drops ≥2% from main.

## Commit & Pull Request Guidelines
Write conventional commits (`feat: add topic filter`, `fix: handle rss timeout`). Commits should be scoped to one logical change and include tests when behavior shifts. PRs must describe intent, implementation notes, manual test steps, and screenshots for UI work. Link Jira/GitHub issues via `Closes #123`. Request review from at least one code owner; label PRs with `feature`, `bug`, or `infra` to drive release notes.
