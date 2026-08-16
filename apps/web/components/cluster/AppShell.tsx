'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  FileStack,
  Menu,
  PackageSearch,
  ScrollText,
  ShieldCheck,
  Target,
  Truck,
  X,
} from 'lucide-react';
import {
  useState,
  type ReactNode,
} from 'react';
import { DatasetModeChip, SourceBadge } from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';
import { cn } from '@/lib/utils';

const nav = [
  { label: 'Overview', href: '/', icon: Target, exact: true },
  { label: 'Imports', href: '/imports', icon: FileStack },
  { label: 'Orders', href: '/orders', icon: PackageSearch },
  { label: 'Suppliers', href: '/suppliers', icon: Truck },
  { label: 'Pharmacies', href: '/pharmacies', icon: Building2 },
  { label: 'Regulatory', href: '/regulatory', icon: ScrollText },
  { label: 'Traceability', href: '/traceability', icon: ShieldCheck },
];

export function ClusterLogoMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-[10px] bg-white text-cluster-deep font-black text-xl tracking-tight shadow-sm', className)}>
        C
      </div>
    );
  }
  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      <div className="flex items-center justify-center h-8 w-8 rounded-[8px] bg-white text-cluster-deep font-extrabold text-lg shadow-sm">
        C
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-white leading-none">
          cluster
        </span>
        <span className="text-[0.625rem] font-semibold tracking-[0.18em] text-white/70 uppercase leading-tight mt-0.5">
          resolve
        </span>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href as never}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-[0.9375rem] font-medium transition-colors duration-200',
              active
                ? 'bg-white font-semibold text-cluster-deep'
                : 'text-white/80 hover:bg-white/12 hover:text-white'
            )}
          >
            <item.icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <p className="mt-auto pt-8 text-[0.6875rem] leading-relaxed text-white/55">
      Unofficial candidate prototype.
      <br />
      Not connected to Cluster production systems.
    </p>
  );
}

export function TopContextBar({
  title,
  subtitle,
  source,
}: {
  title: string;
  subtitle?: string;
  source?: string;
}) {
  const { datasets, activeDataset, activeDatasetId, setActiveDatasetId, isLoading } = useDataset();
  const sourceLabel = source ?? (
    activeDataset?.mode === 'SAMPLE'
      ? 'FOUNDER DEMO / SAMPLE'
      : activeDataset?.mode === 'IMPORTED_REAL'
        ? 'CUSTOMER DATA'
        : activeDataset?.mode === 'LIVE'
          ? 'LIVE DATASET'
          : 'Hosted Supabase'
  );

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold text-ink">{title}</p>
          {subtitle ? <p className="cl-meta truncate">{subtitle}</p> : null}
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {datasets.length > 0 ? (
            <label className="flex w-full min-w-0 items-center gap-1.5 text-xs text-body sm:w-auto">
              <span className="cl-meta hidden sm:inline">Dataset:</span>
              <select
                className="min-w-0 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-cluster-bright sm:w-auto sm:max-w-[20rem]"
                value={activeDatasetId}
                onChange={(e) => setActiveDatasetId(e.target.value)}
                disabled={isLoading}
                aria-label="Select active dataset"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.mode})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="cl-meta hidden sm:inline">
              {isLoading ? 'Loading datasets...' : 'No dataset available'}
            </span>
          )}

          {activeDataset ? (
            <DatasetModeChip mode={activeDataset.mode} />
          ) : (
            <DatasetModeChip mode="SAMPLE" />
          )}
          <SourceBadge label={sourceLabel} verified={activeDataset?.mode !== 'SAMPLE'} />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="fixed top-0 bottom-0 left-0 z-30 hidden w-[236px] flex-col bg-cluster-nav px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 block rounded-[8px] px-2" aria-label="Cluster Resolve home">
          <ClusterLogoMark />
        </Link>
        <p className="mb-3 px-3 text-[0.6875rem] font-bold tracking-[0.12em] text-white/60 uppercase">
          Resolve workspace
        </p>
        <NavList />
        <SidebarFooter />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-cluster-nav px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-white transition-colors duration-200 hover:bg-white/15 cursor-pointer"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link href="/" aria-label="Cluster Resolve home" className="shrink-0">
          <ClusterLogoMark />
        </Link>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/45 cursor-pointer"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-cluster-nav px-4 py-6"
          >
            <div className="mb-8 flex items-center justify-between">
              <ClusterLogoMark compact />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-white hover:bg-white/15 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            <SidebarFooter />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[236px]">{children}</div>
    </div>
  );
}

export function PageBody({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      className={cn(
        'mx-auto px-4 py-8 md:px-8 md:py-12',
        wide ? 'max-w-[1440px]' : 'max-w-[1200px]'
      )}
    >
      {children}
      <footer className="mt-16 border-t border-line pt-6">
        <p className="cl-meta">
          Unofficial candidate prototype. Not connected to Cluster production systems.
        </p>
      </footer>
    </main>
  );
}
