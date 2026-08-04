const shimmer = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded'

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`${shimmer} h-4 ${className}`} />
}

export function SkeletonCircle({ className = '' }: { className?: string }) {
  return <div className={`${shimmer} rounded-full h-10 w-10 ${className}`} />
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <SkeletonLine className="w-24 h-3" />
        <div className={`${shimmer} h-10 w-10 rounded-xl`} />
      </div>
      <SkeletonLine className="w-16 h-8" />
      <SkeletonLine className="w-20 h-3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card-flush">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} className="flex-1 h-3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50 last:border-0">
          <SkeletonCircle className="h-9 w-9" />
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <SkeletonLine key={c} className="flex-1 h-3.5" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonLine className="w-40 h-6" />
        <SkeletonLine className="w-48 h-3 mt-2" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card space-y-3">
          <SkeletonLine className="w-32 h-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <SkeletonLine className="w-20 h-3" />
                <SkeletonLine className="w-16 h-3" />
              </div>
              <SkeletonLine className="w-full h-2" />
            </div>
          ))}
        </div>
        <div className="card space-y-3">
          <SkeletonLine className="w-36 h-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="space-y-1.5">
                <SkeletonLine className="w-28 h-3.5" />
                <SkeletonLine className="w-20 h-3" />
              </div>
              <SkeletonLine className="w-20 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine className="w-32 h-6" />
        <SkeletonLine className="w-28 h-9 rounded-lg" />
      </div>
      <div className="card-sm space-y-3">
        <SkeletonLine className="w-full h-9 rounded-lg" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLine key={i} className="flex-1 h-9 rounded-lg" />
          ))}
        </div>
      </div>
      <SkeletonTable rows={rows} />
    </div>
  )
}
