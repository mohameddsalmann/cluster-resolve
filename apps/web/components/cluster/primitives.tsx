import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ---------------- Icon chip ---------------- */

const chipSizes = {
  compact: 'h-10 w-10 rounded-[10px] [&>svg]:h-5 [&>svg]:w-5',
  standard: 'h-12 w-12 rounded-[12px] [&>svg]:h-6 [&>svg]:w-6',
  feature: 'h-16 w-16 rounded-[16px] [&>svg]:h-7 [&>svg]:w-7',
  large: 'h-20 w-20 rounded-[20px] [&>svg]:h-9 [&>svg]:w-9',
} as const;

export function ClusterIconChip({
  icon: Icon,
  size = 'standard',
  tone = 'brand',
  className,
}: {
  icon: LucideIcon;
  size?: keyof typeof chipSizes;
  tone?: 'brand' | 'soft' | 'deep';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        chipSizes[size],
        tone === 'brand' && 'bg-cluster-bright text-white',
        tone === 'deep' && 'bg-cluster-deep text-white',
        tone === 'soft' && 'bg-surface text-cluster-bright',
        className
      )}
    >
      <Icon strokeWidth={2} />
    </span>
  );
}

/* ---------------- Button ---------------- */

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50';

const buttonVariants = {
  primary: 'cl-wipe bg-cluster-deep text-white hover:bg-cluster-nav',
  secondary: 'bg-white border border-cluster-bright text-cluster-bright hover:bg-surface',
  tertiary: 'bg-transparent text-cluster-bright hover:bg-surface',
  ghost: 'bg-white border border-line text-ink hover:border-cluster-bright hover:text-cluster-bright',
} as const;

const buttonSizes = {
  sm: 'h-10 px-4 text-[0.875rem]',
  md: 'h-12 px-6 text-[0.9375rem]',
} as const;

export function ClusterButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function linkButtonClass(
  variant: keyof typeof buttonVariants = 'primary',
  size: keyof typeof buttonSizes = 'md',
  className?: string
) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

/* ---------------- Chips & badges ---------------- */

const chipTones = {
  neutral: 'bg-surface text-body border-line',
  brand: 'bg-[rgba(15,110,255,0.08)] text-cluster-bright border-[rgba(15,110,255,0.22)]',
  success: 'bg-[rgba(6,118,71,0.08)] text-success border-[rgba(6,118,71,0.2)]',
  caution: 'bg-[rgba(181,71,8,0.08)] text-warning border-[rgba(181,71,8,0.2)]',
  danger: 'bg-[rgba(217,45,32,0.08)] text-danger border-[rgba(217,45,32,0.2)]',
} as const;

export type ChipTone = keyof typeof chipTones;

export function StatusChip({
  label,
  tone = 'neutral',
  icon: Icon,
  className,
}: {
  label: string;
  tone?: ChipTone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap',
        chipTones[tone],
        className
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' }) {
  const tone: ChipTone =
    severity === 'HIGH'
      ? 'danger'
      : severity === 'MEDIUM'
        ? 'caution'
        : severity === 'LOW'
          ? 'brand'
          : 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] uppercase',
        chipTones[tone]
      )}
    >
      {severity}
    </span>
  );
}

export function DatasetModeChip({ mode }: { mode: 'SAMPLE' | 'IMPORTED_REAL' | 'IMPORTED REAL' | 'LIVE' }) {
  const normalized = mode === 'IMPORTED REAL' ? 'IMPORTED_REAL' : mode;
  const tone: ChipTone = normalized === 'LIVE' ? 'success' : normalized === 'IMPORTED_REAL' ? 'brand' : 'neutral';
  const displayLabel = normalized === 'IMPORTED_REAL' ? 'IMPORTED REAL' : normalized;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-bold tracking-[0.08em] uppercase',
        chipTones[tone]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {displayLabel}
    </span>
  );
}

export function SourceBadge({ label, verified = false }: { label: string; verified?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold',
        verified ? chipTones.brand : chipTones.neutral
      )}
    >
      {label}
    </span>
  );
}

export function FindingBadge({ kind }: { kind: 'BLOCKING' | 'ADVISORY' | 'NEEDS VERIFICATION' }) {
  const tone: ChipTone = kind === 'BLOCKING' ? 'danger' : kind === 'ADVISORY' ? 'caution' : 'brand';
  return <StatusChip label={kind} tone={tone} />;
}

/* ---------------- Metrics ---------------- */

export function Metric({
  label,
  value,
  coverage,
  state,
  evidence,
}: {
  label: string;
  value: string;
  coverage?: string;
  state?: { label: string; tone?: ChipTone };
  evidence?: { label: string; href: string };
}) {
  return (
    <div className="cl-panel flex flex-col gap-2 p-4 transition-shadow duration-200 hover:shadow-cluster-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-semibold text-body">{label}</p>
        {state ? <StatusChip label={state.label} tone={state.tone ?? 'neutral'} /> : null}
      </div>
      <p className="text-[1.75rem] leading-none font-bold tracking-[-0.02em] text-ink">{value}</p>
      {coverage ? <p className="cl-meta">{coverage}</p> : null}
      {evidence ? <EvidenceLink label={evidence.label} href={evidence.href} /> : null}
    </div>
  );
}

export function CoverageMetric({
  label,
  value,
  total,
  state,
}: {
  label: string;
  value: number;
  total: number;
  state: 'AVAILABLE' | 'PARTIAL' | 'INSUFFICIENT DATA';
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : null;
  const tone: ChipTone =
    state === 'AVAILABLE' ? 'success' : state === 'PARTIAL' ? 'caution' : 'neutral';
  return (
    <div className="cl-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-semibold text-body">{label}</p>
        <StatusChip label={state} tone={tone} />
      </div>
      <p className="mt-2 text-[1.5rem] leading-none font-bold text-ink">
        {pct === null ? 'Not measurable' : `${pct}%`}
      </p>
      <p className="cl-meta mt-1">
        {total > 0 ? `${value} of ${total} records` : 'No records in this dataset yet'}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-cluster-bright transition-[width] duration-300"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export function ComparisonMetric({
  label,
  baseline,
  recent,
  direction = 'down-bad',
}: {
  label: string;
  baseline: string;
  recent: string;
  direction?: 'down-bad' | 'up-bad';
}) {
  return (
    <div className="cl-panel p-4">
      <p className="text-[0.8125rem] font-semibold text-body">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[1.25rem] font-semibold text-body">{baseline}</span>
        <ArrowRight className="h-4 w-4 text-body" aria-hidden="true" />
        <span
          className={cn(
            'text-[1.5rem] font-bold',
            direction === 'down-bad' ? 'text-danger' : 'text-danger'
          )}
        >
          {recent}
        </span>
      </div>
      <p className="cl-meta mt-1">Baseline → recent window</p>
    </div>
  );
}

/* ---------------- Links & states ---------------- */

export function EvidenceLink({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href as never}
      className="inline-flex w-fit items-center gap-1 rounded-[6px] text-[0.8125rem] font-semibold text-cluster-bright transition-colors duration-200 hover:text-cluster-deep"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="cl-panel flex flex-col items-center gap-4 px-6 py-16 text-center">
      <ClusterIconChip icon={icon} size="large" />
      <div className="max-w-md">
        <h3 className="cl-card-title">{title}</h3>
        <p className="mt-2 text-[0.9375rem] text-body">{description}</p>
      </div>
      {action ? <EvidenceLink label={action.label} href={action.href} /> : null}
    </div>
  );
}

export function LoadingState({ rows = 4, label = 'Loading...' }: { rows?: number; label?: string }) {
  return (
    <div className="cl-panel p-4" role="status" aria-live="polite" aria-label={label}>
      <div className="cl-skeleton h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="cl-skeleton h-10 w-10 rounded-[10px]" />
            <div className="flex-1 space-y-2">
              <div className="cl-skeleton h-3 w-2/3" />
              <div className="cl-skeleton h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="cl-panel border-[rgba(217,45,32,0.25)] p-6">
      <h3 className="cl-card-title text-danger">{title}</h3>
      {detail ? <p className="mt-2 text-[0.9375rem] text-body">{detail}</p> : null}
      {action ? (
        <div className="mt-4">
          <EvidenceLink label={action.label} href={action.href} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Timeline ---------------- */

export function Timeline({
  items,
}: {
  items: { label: string; time: string; detail?: string; tone?: ChipTone }[];
}) {
  return (
    <ol className="relative ml-2 border-l border-line pl-6">
      {items.map((item, i) => (
        <li key={i} className={cn('relative', i < items.length - 1 && 'pb-6')}>
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1 -left-[1.9375rem] h-3 w-3 rounded-full border-2 border-white',
              item.tone === 'danger'
                ? 'bg-danger'
                : item.tone === 'caution'
                  ? 'bg-caution'
                  : 'bg-cluster-bright'
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-[0.9375rem] font-semibold text-ink">{item.label}</p>
            <p className="cl-meta">{item.time}</p>
          </div>
          {item.detail ? <p className="mt-1 text-[0.875rem] text-body">{item.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/* ---------------- Headers ---------------- */

export function SectionHeader({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <h2 id={id} className="cl-section-title">
          {title}
        </h2>
        {description ? <p className="mt-1 text-[0.9375rem] text-body">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="cl-page-title">{title}</h1>
          {subtitle ? <p className="mt-2 text-[1.0625rem] text-body">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">{actions}</div> : null}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('cl-panel p-4 sm:p-6', className)}>
      {title ? (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="cl-card-title">{title}</h2>
            {description ? <p className="mt-1 text-[0.875rem] text-body">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
