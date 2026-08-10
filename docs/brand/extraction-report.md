# Brand extraction report

## Status

- **NOT EXTRACTED**: No official Cluster brand guidelines, color palette, typography, spacing, gradients, shadows, or logo assets have been obtained.
- **HOLD**: All Cluster-specific brand tokens remain unverified until Phase 0/brand extraction is completed with official source material.

## What is known from public sources

- Company name: Cluster / Cluster Intelligence Hub
- Website: https://clusterapp.net/
- Dev preview: https://dev.clusterapp.net/
- LinkedIn: https://www.linkedin.com/company/clusterintelligencehub
- Location: Giza, Egypt
- Industry: B2B pharmaceutical procurement marketplace, AI-driven supply chain.
- Brand narrative: AI automation, pharmacy-supplier matching, cost reduction, emerging markets.

## What is NOT known

- Official brand colors (primary, secondary, neutral, semantic).
- Typography scale and font family.
- Spacing, border-radius, shadow, and gradient specifications.
- Logo files, mark, usage rules.
- Official tone-of-voice and content style guide.

## Current design tokens

Only semantic status colors are present in `packages/design-tokens/src/index.ts` and `apps/web/app/globals.css`:
- `critical: #dc2626`
- `high: #ea580c`
- `medium: #d97706`
- `low: #ca8a04`
- `ok: #16a34a`
- `neutral: #64748b`
- `unknown: #94a3b8`

These are generic semantic colors, not Cluster-derived.

## Implications

- UI will use a neutral Tailwind slate palette until official brand extraction.
- `packages/design-tokens` currently exports `statusTokens` only.
- `brandTokens` will be added only after official source is reviewed.
- No invented colors should be presented as Cluster brand.

## Next step

Obtain official brand guidelines from Cluster (design system, style guide, or at minimum the website's CSS/custom properties) before Phase 3–6 UI work.
