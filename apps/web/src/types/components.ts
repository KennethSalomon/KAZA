// note : Types pour les composants d'interface et layouts
import type { ReactNode } from 'react';

export type KazaVariant = 'primary' | 'secondary' | 'marketing' | 'ghost' | 'danger' | 'success';
export type KazaBadgeVariant = 'mint' | 'red' | 'amber' | 'vert' | 'peche' | 'neutral';
export type ComponentSize = 'sm' | 'md' | 'lg';

export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
  badge?: string | number;
}
