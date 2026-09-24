"use client";

export default function PackingList({ items, onToggle }) {
  if (!items || items.length === 0) return null;

  const checkedCount = items.filter((item) => item.checked).length;

  return (
    <div className="glass-card p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <span>🎒</span> Packing List
        </h3>
        <span className="text-xs text-text-muted">
          {checkedCount}/{items.length} packed
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onToggle(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left
              transition-all duration-200 hover:bg-white/[0.03]
              ${item.checked ? "opacity-50" : ""}`}
          >
            <span
              className={`w-4 h-4 rounded border flex-shrink-0
                flex items-center justify-center transition-all
                ${
                  item.checked
                    ? "bg-accent-green border-accent-green"
                    : "border-white/20"
                }`}
            >
              {item.checked && (
                <svg
                  width="8"
                  height="6"
                  viewBox="0 0 10 8"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M1 4l3 3 5-6" />
                </svg>
              )}
            </span>
            <span
              className={`${
                item.checked ? "line-through text-text-muted" : "text-text-secondary"
              }`}
            >
              {item.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
