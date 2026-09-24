"use client";

import { useState, useRef, useEffect } from "react";

export default function TripInput({ onSubmit, loading, onCancel }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit(value.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  // Allow setting value from parent (for example prompts)
  const setInput = (text) => {
    setValue(text);
  };

  // Expose setInput via ref
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.setInputValue = setInput;
    }
  });

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="glass-card p-1 transition-all duration-300 focus-within:border-primary/30 focus-within:shadow-[0_0_24px_rgba(108,99,255,0.15)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your dream trip... e.g., '5-day trip to Tokyo on a $3000 budget focusing on food and culture'"
          className="w-full bg-transparent border-none outline-none resize-none
            text-text-primary placeholder-text-muted text-sm leading-relaxed
            p-3 min-h-[80px] max-h-[200px]"
          disabled={loading}
          id="trip-input"
        />

        <div className="flex items-center justify-between px-3 pb-2">
          {/* Character count */}
          <span
            className={`text-xs transition-colors ${
              value.length > 500 ? "text-accent-rose" : "text-text-muted"
            }`}
          >
            {value.length}/500
          </span>

          <div className="flex items-center gap-2">
            {/* Keyboard shortcut hint */}
            {!loading && value.trim() && (
              <span className="text-xs text-text-muted hidden sm:inline">
                ⌘+Enter
              </span>
            )}

            {/* Cancel button (while loading) */}
            {loading && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs text-text-secondary
                  hover:text-text-primary transition-colors rounded-lg
                  hover:bg-white/5"
              >
                Cancel
              </button>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={!value.trim() || loading}
              className="px-4 py-1.5 rounded-lg text-sm font-medium
                bg-primary text-white
                hover:bg-primary-hover
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200
                flex items-center gap-2"
              id="generate-button"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// Allow parent to imperatively set input value
TripInput.setInputRef = null;
