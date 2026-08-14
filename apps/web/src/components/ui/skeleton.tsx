// skeleton loader — respecte prefers-reduced-motion via animation conditionnelle
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-kaza bg-kaza-raised/60 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent motion-reduce:animate-none" />
    </div>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="kaza-card overflow-hidden">
      <Skeleton className="h-44 w-full rounded-b-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between pt-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}