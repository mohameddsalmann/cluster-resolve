# Contributing to Cluster Resolve

Thanks for contributing to Cluster Resolve. This repository is a pnpm monorepo containing the Next.js application, deterministic domain logic, schemas, tests, and Supabase infrastructure used by the project.

## Development setup

### Prerequisites

- Node.js 22 or newer
- pnpm 10
- Git
- Supabase credentials when working on database-backed functionality

### Clone and install

```bash
git clone https://github.com/mohameddsalmann/cluster-resolve.git
cd cluster-resolve
pnpm install
```

### Environment variables

Copy the example environment file into the web app:

```bash
cp .env.example apps/web/.env.local
```

Then add the required Supabase credentials and any other local development values documented in `.env.example`.

### Run locally

```bash
pnpm dev
```

The application is available at:

```text
http://localhost:3000
```

## Repository structure

```text
cluster-resolve/
├── apps/
│   └── web/              # Next.js application, server actions, scripts and app-level tests
├── packages/
│   ├── core/             # Deterministic procurement, supplier, regulatory and traceability logic
│   ├── schemas/          # Shared domain schemas and validation contracts
│   └── design-tokens/    # Shared semantic design tokens
├── supabase/             # Database migrations and Supabase infrastructure
├── data/                 # Demo/reference data used by project scripts
└── docs/                 # Project documentation
```

## Before opening a pull request

Run the local validation pipeline:

```bash
pnpm ci:local
```

This runs:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For changes that touch database-backed behavior, also run:

```bash
pnpm test:db
```

For end-to-end changes, run:

```bash
pnpm test:e2e
```

## Useful project commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js development server |
| `pnpm build` | Build the web application |
| `pnpm typecheck` | Run TypeScript checks across the workspace |
| `pnpm lint` | Run linting across the workspace |
| `pnpm test` | Run unit tests |
| `pnpm test:db` | Run database integration tests |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm ci:local` | Run the standard local CI pipeline |
| `pnpm demo:data:generate` | Generate the deterministic Founder Demo dataset |
| `pnpm demo:data:validate` | Validate generated Founder Demo data |
| `pnpm demo:data:import` | Import the Founder Demo dataset |
| `pnpm regulatory:sync:eda` | Run live EDA notice synchronization |

## Data provenance and safety

The Founder Demo operational dataset is synthetic and deterministic. Do not describe generated demo orders, offers, decisions, outcomes, pharmacies, or supplier behavior as real production transactions.

When adding regulatory integrations or reference data:

- Preserve the original source URL when available.
- Clearly distinguish live official data from cached/reference fixtures.
- Do not silently promote fallback fixtures to official live data.
- Avoid committing patient data, credentials, payment information, or other sensitive information.

## Contribution guidelines

1. Create a focused branch from the latest `main`.
2. Keep each pull request scoped to one clear change.
3. Add or update tests when changing deterministic business logic.
4. Prefer factual, evidence-backed product copy over unsupported claims.
5. Preserve deterministic behavior in `packages/core`; LLM-generated text must not become the source of truth for calculations or classifications.
6. Update documentation when behavior, commands, schemas, or setup requirements change.

Example branch names:

```text
docs/data-provenance
fix/decision-replay
feat/supplier-risk
```

Example commit messages:

```text
docs: clarify founder demo data provenance
fix: preserve temporal integrity in decision replay
feat: add supplier product risk breakdown
```

## Pull request checklist

Before requesting review, confirm that:

- [ ] The change has a clear purpose and limited scope.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] Relevant database or E2E tests were run when needed.
- [ ] Documentation was updated if behavior or setup changed.
- [ ] No secrets or sensitive production data were committed.

## Reporting issues

When reporting a bug, include:

- A concise description of the problem.
- Steps to reproduce it.
- Expected behavior.
- Actual behavior.
- Relevant logs, screenshots, dataset mode, or failing test output when available.

Thanks for helping improve Cluster Resolve.
