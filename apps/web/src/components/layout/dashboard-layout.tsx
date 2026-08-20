import type { ReactNode } from 'react';
import { Navbar } from './navbar';
import { Sidebar } from './sidebar';
import type { NavItem } from '@/types/components';
import { cn } from '@/lib/utils/cn';

export interface DashboardLayoutProps {
  children: ReactNode;
  sidebarItems?: ReadonlyArray<NavItem>;
  headerActions?: ReactNode;
  className?: string;
}

// note : Layout sémantique standardisé pour les espaces de gestion (<nav>, <aside>, <main>)
export function DashboardLayout({
  children,
  sidebarItems,
  className,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-kaza-bg">
      <Navbar />

      <div className="flex flex-1">
        {sidebarItems && sidebarItems.length > 0 && (
          <Sidebar items={sidebarItems} className="hidden lg:flex" />
        )}

        <main
          className={cn(
            'flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8',
            className,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
