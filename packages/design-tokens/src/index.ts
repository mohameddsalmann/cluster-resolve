export const brandTokens = {
  color: {
    brand: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
    },
    surface: {
      base: '#ffffff',
      raised: '#f8fafc',
      sunken: '#f1f5f9',
    },
    border: {
      subtle: '#e2e8f0',
      default: '#cbd5e1',
      strong: '#94a3b8',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#94a3b8',
    },
    status: {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#d97706',
      low: '#ca8a04',
      ok: '#16a34a',
      neutral: '#64748b',
      unknown: '#94a3b8',
    },
  },
} as const;

export type BrandTokens = typeof brandTokens;
