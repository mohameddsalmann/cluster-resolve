# Brand extraction report

## Status

- `PUBLIC_SITE_DERIVED` — YES (in progress)
- `OFFICIAL_INTERNAL_GUIDELINES` — NO
- Exact color/spacing/shadow/radii values from CSS assets — NEEDS_VERIFICATION

## Provenance

- Public website: https://clusterapp.net
- Public dev site: https://dev.clusterapp.net
- A1 Gallery design analysis: https://www.a1.gallery/website/cluster
- Public descriptions: MIT Solve profile, LinkedIn, App Store

## Two-state model

| State | Source | Use in this prototype |
|---|---|---|
| `PUBLIC_SITE_DERIVED` | clusterapp.net markup, public screenshots, third-party design analysis | Allowed for candidate UI work |
| `OFFICIAL_INTERNAL_GUIDELINES` | Cluster design system / brand book | Not required before Phase UI work |

## Public-site-derived tokens

### Typography

- **Display / heading font**: `Season Serif` (source: A1 Gallery)
- **Body / UI font**: `Inter` (source: A1 Gallery)

### Visual style

From A1 Gallery style tags:

- Serif
- Elegant
- Animated / scroll animation
- Pattern
- Gradients
- Dark
- Isometric

### Logo / text mark

- Site text mark: `Cluster Intelligence Hub.`
- App store badges for Play Store and App Store
- No logo SVG/PNG asset extracted from public site

### Colors (NEEDS_CSS_VERIFICATION)

The public site uses a dark page style with animated gradients and patterns, but exact hex values, gradient stops, and accent colors have not been extracted from CSS assets. The candidate UI should use a neutral Tailwind `slate` base with a dark mode gradient until exact values are captured via browser dev tools on `https://clusterapp.net`.

### Spacing, radii, shadows (NEEDS_CSS_VERIFICATION)

No CSS asset has been downloaded. These tokens remain unverified.

## Current design tokens

Only semantic status colors are present in `packages/design-tokens/src/index.ts` and `apps/web/app/globals.css`:
- `critical: #dc2626`
- `high: #ea580c`
- `medium: #d97706`
- `low: #ca8a04`
- `ok: #16a34a`
- `neutral: #64748b`
- `unknown: #94a3b8`

No invented brand colors are added. Brand color extraction is documented above as `PUBLIC_SITE_DERIVED` and incomplete for color values.

## Implications

- UI may use `PUBLIC_SITE_DERIVED` fonts and style direction (`Season Serif` + `Inter`, dark + gradients).
- Brand colors must not be invented. Use Tailwind slate/emerald/amber default palette until CSS extraction is completed.
- The product must continue to display `Unofficial candidate prototype`.
- `packages/design-tokens` still exports `statusTokens` only. Brand tokens will be added only after exact color extraction.

## Next step

Extract exact color/gradient/shadow/radii values from `https://clusterapp.net` CSS using browser dev tools when network access is convenient.
