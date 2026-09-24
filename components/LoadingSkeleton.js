"use client";

export default function LoadingSkeleton() {
  return (
    <div className="w-full animate-fade-in">
      {/* Title skeleton */}
      <div className="skeleton h-8 w-64 mb-2" />
      <div className="skeleton h-4 w-96 max-w-full mb-8" />

      {/* Day cards skeleton */}
      {[1, 2, 3].map((day) => (
        <div key={day} className="glass-card p-5 mb-4" style={{ animationDelay: `${day * 0.15}s` }}>
          {/* Day header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div>
              <div className="skeleton h-5 w-32 mb-1.5" />
              <div className="skeleton h-3 w-48" />
            </div>
          </div>

          {/* Activity skeletons */}
          {[1, 2, 3].map((act) => (
            <div key={act} className="flex items-start gap-3 py-3 border-t border-white/5">
              <div className="skeleton h-6 w-16 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-4 w-40 mb-1.5" />
                <div className="skeleton h-3 w-full max-w-xs" />
              </div>
              <div className="skeleton h-4 w-12" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
