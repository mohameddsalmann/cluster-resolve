# ADR-0001 — Next.js version and proxy.ts convention

## Status

- **VERIFIED**: Next.js 16.3.0 is the current stable release.
- **VERIFIED**: `proxy.ts` is the Next.js 16 replacement for `middleware.ts`.
- **VERIFIED**: `proxy.ts` runs only on the Node.js runtime.
- **VERIFIED**: `proxy.ts` is not an auth boundary.

## Source

- Next.js 16.3.0 release: https://nextjs.org/blog/next-16-3 (published August 3, 2026)
- Next.js 16 announcement: https://nextjs.org/blog/next-16
- Proxy convention docs: https://www.matthewswong.com/en/blog/nextjs-16-proxy-ts-migration/

## Resolution

- Installed `next@16.3.0`, `react@19.2.8`, `react-dom@19.2.8`, `eslint-config-next@16.3.0`.
- `apps/web/proxy.ts` exports `proxy(request: NextRequest)`.
- Build output confirms `ƒ Proxy (Middleware)`.
- Runtime integration test in `apps/web/tests/integration/proxy.test.ts` proves:
  - `x-request-id` is injected
  - Existing `x-request-id` is preserved
  - `x-content-type-options: nosniff` is set
  - `x-frame-options: DENY` is set

## Implications

- No `middleware.ts` file is present and none will be added.
- Authorization logic lives in server guards, Route Handlers, and RLS.
- `proxy.ts` handles headers and request-id only.
