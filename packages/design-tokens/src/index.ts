export const statusTokens = {
  status: {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#d97706',
    low: '#ca8a04',
    ok: '#16a34a',
    neutral: '#64748b',
    unknown: '#94a3b8',
  },
} as const;

export type StatusTokens = typeof statusTokens;
