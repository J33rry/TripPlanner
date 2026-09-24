"use client";

export default function ErrorBanner({ error, onRetry, onDismiss }) {
  if (!error) return null;

  return (
    <div className="animate-fade-in glass-card border-accent-rose/20 p-4 mb-4">
      <div className="flex items-start gap-3">
        {/* Error icon */}
        <div className="w-8 h-8 rounded-full bg-accent-rose/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-accent-rose text-sm">⚠️</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Error message */}
          <p className="text-text-primary text-sm font-medium mb-1">
            {error.message}
          </p>

          {/* Error details */}
          {error.details && (
            <ul className="text-xs text-text-secondary list-disc ml-4 mb-2">
              {error.details.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
          )}

          {/* Raw response (collapsed) */}
          {error.raw && (
            <details className="text-xs text-text-muted mt-2">
              <summary className="cursor-pointer hover:text-text-secondary transition-colors">
                View raw AI response
              </summary>
              <pre className="mt-2 p-2 bg-black/30 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
                {error.raw}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            {error.retryable && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-accent-rose/10 text-accent-rose
                  hover:bg-accent-rose/20 transition-colors"
              >
                ↻ Retry
              </button>
            )}
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg text-xs text-text-muted
                hover:text-text-secondary hover:bg-white/5 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
