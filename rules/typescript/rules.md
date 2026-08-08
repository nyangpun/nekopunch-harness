# TypeScript / React Rules

Applies when `tsconfig.json` is present (see `skills/agent-sort`).

- Prefer function components + hooks; no class components in new code.
- Co-locate FSD slices (`app/`, `pages/`, `widgets/`, `features/`, `entities/`, `shared/`).
- Server state goes through TanStack Query; do not duplicate it in Zustand.
- Zustand stores hold UI/client state only.
- React Flow node/edge types live in `entities/`, not inline in canvas components.

<!-- extend as conventions solidify -->
