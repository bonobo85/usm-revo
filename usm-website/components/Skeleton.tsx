export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-fond-clair animate-pulse rounded ${className}`} />;
}

export function SkeletonCarte() {
  return (
    <div className="carte">
      <Skeleton className="h-4 w-1/3 mb-3" />
      <Skeleton className="h-8 w-1/2 mb-2" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function SkeletonListe({ nombre = 5 }: { nombre?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: nombre }).map((_, i) => (
        <div key={i} className="carte flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
