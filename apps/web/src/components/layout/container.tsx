import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: ReactNode;
}

// note : Conteneur responsive avec padding latéral adaptatif KAZA
export function Container({
  size = 'xl',
  className,
  children,
  ...props
}: ContainerProps) {
  const sizeClasses = {
    sm: 'max-w-3xl',
    md: 'max-w-5xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full',
  }[size];

  return (
    <div
      className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', sizeClasses, className)}
      {...props}
    >
      {children}
    </div>
  );
}
