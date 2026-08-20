'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isVerified?: boolean;
}

// note : Avatar avec gestion de fallback initiales et badge vérifié
export function Avatar({
  src,
  name = 'Utilisateur',
  size = 'md',
  className,
  isVerified = false,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  const getInitials = (fullName: string): string => {
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  };

  const sizeStyles = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  }[size];

  const dimensionPixels = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  }[size];

  const showImage = src && !hasError;

  return (
    <div className={cn('relative inline-block select-none', className)}>
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold transition-transform',
          'bg-kaza-raised border border-kaza-border text-kaza-vert',
          sizeStyles,
        )}
      >
        {showImage ? (
          <Image
            src={src}
            alt={name}
            width={dimensionPixels}
            height={dimensionPixels}
            className="h-full w-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <span>{getInitials(name) || 'K'}</span>
        )}
      </div>

      {isVerified && (
        <span
          title="Bailleur vérifié KAZA"
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-kaza-vert text-white ring-2 ring-white"
        >
          <svg
            className="h-2.5 w-2.5 fill-current"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
          </svg>
        </span>
      )}
    </div>
  );
}
