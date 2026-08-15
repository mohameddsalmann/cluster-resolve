import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import {
  FileStack,
  Menu,
  PackageSearch,
  ScrollText,
  ShieldCheck,
  Target,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import logo from "@/assets/cluster-logo.png.asset.json";
import cMark from "@/assets/cluster-c.png.asset.json";
import { DatasetModeChip, SourceBadge } from "@/components/cluster/primitives";
import { cn } from "@/lib/utils";

const nav: { label: string; to: NonNullable<LinkProps["to"]>; icon: typeof Target; exact?: boolean }[] = [
  { label: "Resolve", to: "/", icon: Target, exact: true },
  { label: "Orders", to: "/orders", icon: PackageSearch },
  { label: "Suppliers", to: "/suppliers", icon: Truck },
  { label: "Regulatory", to: "/regulatory", icon: ScrollText },
  { label: "Traceability", to: "/traceability", icon: ShieldCheck },
  { label: "Imports", to: "/imports", icon: FileStack },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {nav.map((item) => {
        const target = item.to as string;
        const active = item.exact ? pathname === target : pathname.startsWith(target);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-[0.9375rem] font-medium transition-colors duration-200",
              active
                ? "bg-white font-semibold text-cluster-deep"
                : "text-white/80 hover:bg-white/12 hover:text-white",
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
  dataset = "Sample dataset · demo-eg-01",
  mode = "SAMPLE",
  source = "Fixture preview",
}: {
  title: string;
  subtitle?: string;
  dataset?: string;
  mode?: "SAMPLE" | "IMPORTED REAL" | "LIVE";
  source?: string;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold text-ink">{title}</p>
          {subtitle ? <p className="cl-meta truncate">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="cl-meta hidden sm:inline">{dataset}</span>
          <DatasetModeChip mode={mode} />
          <SourceBadge label={source} />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="fixed top-0 bottom-0 left-0 z-30 hidden w-[236px] flex-col bg-cluster-nav px-4 py-6 lg:flex">
        <Link to="/" className="mb-8 block rounded-[8px] px-2" aria-label="Cluster Resolve home">
          <img src={logo.url} alt="Cluster" width={140} height={43} className="w-[140px]" />
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-white transition-colors duration-200 hover:bg-white/15"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link to="/" aria-label="Cluster Resolve home" className="shrink-0">
          <img src={logo.url} alt="Cluster" width={116} height={35} className="w-[116px]" />
        </Link>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/45"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-cluster-nav px-4 py-6"
          >
            <div className="mb-8 flex items-center justify-between">
              <img src={cMark.url} alt="Cluster" width={36} height={36} className="h-9 w-9" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-white hover:bg-white/15"
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
        "mx-auto px-4 py-8 md:px-8 md:py-12",
        wide ? "max-w-[1440px]" : "max-w-[1200px]",
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
