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
    title: 'MAIN',
    links: [{ href: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> }],
  },
  {
    title: 'TRANSACTIONS',
    links: [
      { href: '/dashboard/transactions/pulsa', label: 'Buy Pulsa', icon: <IconSmartphone /> },
      { href: '/dashboard/transactions/data-package', label: 'Data Package', icon: <IconPackage /> },
      { href: '/dashboard/transactions/cocktail-sf', label: 'Cocktail SF', icon: <IconZap /> },
      { href: '/dashboard/transactions/package-injection', label: 'Package Injection', icon: <IconDownload /> },
    ],
  },
  {
    title: 'MANAGEMENT',
    links: [
      { href: '/dashboard/products', label: 'Products', icon: <IconBoxes /> },
      { href: '/dashboard/history', label: 'History', icon: <IconHistory /> },
    ],
  },
  {
    title: 'SYSTEM',
    links: [{ href: '/dashboard/config', label: 'API Config', icon: <IconSettings /> }],
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

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && Boolean(pathname?.startsWith(href)));

  const navContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="mb-6">
          <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {group.title}
          </p>
          <ul className="space-y-1">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
    <div className="border-t border-gray-200 p-4 shrink-0">
      <div className="flex items-center">
        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold shrink-0">
          {username.charAt(0).toUpperCase()}
        </div>
        <span className="ml-3 text-sm font-medium text-gray-700 truncate flex-1">{username}</span>
        <button
          onClick={onLogout}
          className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          title="Logout"
          aria-label="Logout"
        >
          <IconLogout size={18} />
        </button>
      </div>
    </div>
  );

  const brand = (
    <Link href="/dashboard" className="flex items-center" onClick={() => setDrawerOpen(false)}>
      <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
        <IconWallet size={18} />
      </span>
      <span className="ml-2.5 text-base font-bold text-gray-900 truncate">Transaction Dashboard</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">{brand}</div>
        {navContent}
        {userFooter}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b">
        <div className="flex items-center justify-between h-16 px-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            aria-label="Open menu"
          >
            <IconMenu size={24} />
          </button>
          <span className="text-base font-bold text-gray-900">Transaction Dashboard</span>
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
            {username.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-gray-900/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
              {brand}
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                aria-label="Close menu"
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