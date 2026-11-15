'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconDashboard,
  IconSmartphone,
  IconPackage,
  IconZap,
  IconDownload,
  IconBoxes,
  IconHistory,
  IconSettings,
  IconMenu,
  IconX,
  IconLogout,
  IconWallet,
  IconLayers,
  IconSearch,
} from './icons';

interface DashboardLayoutProps {
  username: string;
  onLogout: () => Promise<void>;
  children: ReactNode;
}

interface NavLink {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV_GROUPS: Array<{ title: string; links: NavLink[] }> = [
  {
    title: 'UTAMA',
    links: [{ href: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> }],
  },
  {
    title: 'TRANSAKSI',
    links: [
      { href: '/dashboard/transactions/pulsa', label: 'Beli Pulsa', icon: <IconSmartphone /> },
      { href: '/dashboard/transactions/data-package', label: 'Paket Data', icon: <IconPackage /> },
      { href: '/dashboard/transactions/cocktail-sf', label: 'Cocktail SF', icon: <IconZap /> },
      { href: '/dashboard/transactions/package-injection', label: 'Injeksi Paket', icon: <IconDownload /> },
    ],
  },
  {
    title: 'STOK DIGITAL',
    links: [
      { href: '/dashboard/stock', label: 'Stok', icon: <IconLayers /> },
      { href: '/dashboard/stock/history', label: 'Riwayat Stok', icon: <IconHistory /> },
      { href: '/dashboard/stock/transactions', label: 'Info Transaksi', icon: <IconSearch /> },
    ],
  },
  {
    title: 'MANAJEMEN',
    links: [
      { href: '/dashboard/products', label: 'Produk', icon: <IconBoxes /> },
      { href: '/dashboard/history', label: 'Riwayat', icon: <IconHistory /> },
    ],
  },
  {
    title: 'SISTEM',
    links: [{ href: '/dashboard/config', label: 'Konfigurasi API', icon: <IconSettings /> }],
  },
];

export function DashboardLayout({ username, onLogout, children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Highlight only the most specific matching link, so nested pages
  // (e.g. /dashboard/stock/inject) don't also light up their parent.
  const activeHref = NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href))
    .filter((href) => pathname === href || Boolean(pathname?.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  const isActive = (href: string) => href === activeHref;

  const navContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="mb-6">
          <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-4">
            {group.title}
          </p>
          <ul className="space-y-1">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-control text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-primary-subtle text-primary-hover'
                      : 'text-ink-2 hover:bg-canvas hover:text-ink'
                  }`}
                >
                  <span className="mr-3 shrink-0">{link.icon}</span>
                  <span className="truncate">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  const userFooter = (
    <div className="border-t border-line p-4 shrink-0">
      <div className="flex items-center">
        <div className="w-9 h-9 rounded-full bg-primary-subtle text-primary-hover flex items-center justify-center font-semibold shrink-0">
          {username.charAt(0).toUpperCase()}
        </div>
        <span className="ml-3 text-sm font-medium text-ink-2 truncate flex-1">{username}</span>
        <button
          onClick={onLogout}
          className="ml-2 p-2 text-ink-4 hover:text-danger hover:bg-danger-subtle rounded-control transition-colors"
          title="Keluar"
          aria-label="Keluar"
        >
          <IconLogout size={18} />
        </button>
      </div>
    </div>
  );

  const brand = (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center"
      onClick={() => setDrawerOpen(false)}
    >
      <span className="w-8 h-8 rounded-surface bg-primary text-white flex items-center justify-center shrink-0">
        <IconWallet size={18} />
      </span>
      <span className="ml-2.5 min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold text-ink">OPEN API SIDIVA</span>
        <span className="block truncate text-2xs font-semibold uppercase tracking-wider text-ink-4">
          Dashboard
        </span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col bg-surface border-r border-line">
        <div className="h-16 flex items-center px-6 border-b border-line shrink-0">{brand}</div>
        {navContent}
        {userFooter}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-surface border-b">
        <div className="flex items-center justify-between h-16 px-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 text-ink-2 hover:text-ink hover:bg-line rounded-control"
            aria-label="Buka menu"
          >
            <IconMenu size={24} />
          </button>
          <span className="min-w-0 flex-1 truncate px-2 text-center text-sm font-bold text-ink">
            OPEN API SIDIVA Dashboard
          </span>
          <div className="w-8 h-8 shrink-0 rounded-full bg-primary-subtle text-primary-hover flex items-center justify-center font-semibold text-sm">
            {username.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-ink/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-line shrink-0">
              {brand}
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 -mr-2 text-ink-4 hover:text-ink-2 hover:bg-line rounded-control"
                aria-label="Tutup menu"
              >
                <IconX size={22} />
              </button>
            </div>
            {navContent}
            {userFooter}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}