"use client";

export default function ErrorBanner({ error, onRetry, onDismiss }) {
  if (!error) return null;

  // Guardrail rejections aren't failures — show them as a gentle notice.
  const notice = error.code === "guardrail";

  return (
    <div className={`error-banner ${notice ? "is-notice" : ""}`} role={notice ? "status" : "alert"}>
      <div className="error-body">
        <strong>{error.message}</strong>
        {error.details?.length > 0 && (
          <ul>{error.details.map((detail, i) => <li key={i}>{detail}</li>)}</ul>
        )}
        {error.raw && (
          <details>
            <summary>View raw AI response</summary>
            <pre>{error.raw}</pre>
          </details>
        )}
      </div>
      <div className="error-actions">
        {error.retryable && <button type="button" className="dark-pill small" onClick={onRetry}>Try again</button>}
        <button type="button" className="ghost-pill" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}
