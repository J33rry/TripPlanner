"use client";

import { EXAMPLE_PROMPTS } from "@/lib/constants";

export default function EmptyState({ onExampleClick }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse-glow">
        <span className="text-4xl">✈️</span>
      </div>

      {/* Heading */}
      <h2 className="text-2xl font-bold text-text-primary mb-2 text-center">
        Plan Your Dream Trip
      </h2>
      <p className="text-text-secondary text-center max-w-md mb-8">
        Describe your ideal trip and our AI will create a detailed, interactive
        day-by-day itinerary you can customize.
      </p>

      {/* Example prompts */}
      <div className="w-full max-w-lg">
        <p className="text-xs uppercase tracking-wider text-text-muted mb-3 text-center">
          Try an example
        </p>
        <div className="flex flex-col gap-2">
          {EXAMPLE_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onExampleClick(prompt)}
              className="glass-card px-4 py-3 text-sm text-text-secondary text-left
                hover:text-text-primary hover:border-primary/30
                transition-all duration-200 cursor-pointer
                hover:translate-x-1"
            >
              <span className="text-primary mr-2">→</span>
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
