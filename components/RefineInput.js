"use client";

import { useState } from "react";

export default function RefineInput({ onRefine, loading }) {
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onRefine(value.trim());
    setValue("");
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full glass-card px-4 py-3 text-sm text-text-secondary
          hover:text-text-primary hover:border-primary/30
          transition-all duration-200 text-left
          flex items-center gap-2"
      >
        <span className="text-primary">✏️</span>
        Refine this itinerary...
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in">
      <div className="glass-card p-1 focus-within:border-primary/30 transition-all duration-300">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g., 'Make day 2 more budget-friendly' or 'Add vegetarian dinner spots'"
          className="w-full bg-transparent border-none outline-none resize-none
            text-text-primary placeholder-text-muted text-sm leading-relaxed
            p-3 min-h-[60px] max-h-[120px]"
          disabled={loading}
          autoFocus
        />
        <div className="flex items-center justify-end gap-2 px-3 pb-2">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setValue("");
            }}
            className="px-3 py-1.5 text-xs text-text-muted
              hover:text-text-secondary transition-colors rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim() || loading}
            className="px-4 py-1.5 rounded-lg text-xs font-medium
              bg-primary/80 text-white hover:bg-primary
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200
              flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Refining...
              </>
            ) : (
              <>
                <span>✨</span>
                Refine
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
