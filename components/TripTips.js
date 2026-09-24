"use client";

export default function TripTips({ tips }) {
  if (!tips || tips.length === 0) return null;

  return (
    <div className="glass-card p-4 animate-fade-in">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
        <span>💡</span> Travel Tips
      </h3>

      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-text-secondary"
          >
            <span className="text-primary mt-0.5 flex-shrink-0">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
