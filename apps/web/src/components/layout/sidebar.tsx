'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import type { NavItem } from '@/types/components';

export interface SidebarProps {
  items: ReadonlyArray<NavItem>;
  title?: string;
  footer?: React.ReactNode;
  className?: string;
}

// note : Barre latérale sémantique <aside> avec navigation active pour les espaces KAZA
export function Sidebar({ items, title = 'Navigation', footer, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label={title}
      className={cn(
        'flex w-64 shrink-0 flex-col justify-between border-r border-kaza-border bg-white p-4',
        className,
      )}
    >
      <div className="space-y-6">
        <nav aria-label="Menu principal" className="space-y-1.5">
          {items.map((item) => {
            const isActive =
              item.active !== undefined
                ? item.active
                : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between rounded-kaza px-3.5 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-kaza-vert text-white shadow-sm font-semibold'
                    : 'text-kaza-muted hover:bg-kaza-raised hover:text-kaza-text',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-3">
                  {item.icon && (
                    <span className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-kaza-muted')}>
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive ? 'bg-white/20 text-white' : 'bg-kaza-raised text-kaza-muted',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {footer && <div className="border-t border-kaza-border pt-4">{footer}</div>}
    </aside>
  );
}
