"use client";

import { useState, useRef, useCallback } from "react";

/**
 * Hook that manages the AI generation lifecycle:
 * - Loading / error / success state
 * - AbortController to prevent stale responses
 * - Retry functionality
 */
export function useGenerateTrip(onSuccess) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const generate = useCallback(
    async ({ userInput, existingTrip, refinement }) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Track request ID to prevent stale responses
      const currentRequestId = ++requestIdRef.current;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userInput, existingTrip, refinement }),
          signal: controller.signal,
        });

        // Check if this request is still the latest
        if (currentRequestId !== requestIdRef.current) {
          return; // A newer request was made; discard this response
        }

        const data = await response.json();

        // Check again after parsing (in case a new request started during parse)
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok || !data.success) {
          setError({
            message: data.error || "Something went wrong",
            details: data.details,
            raw: data.raw,
            retryable: data.retryable !== false,
          });
          setLoading(false);
          return;
        }

        onSuccess(data.data);
        setLoading(false);
      } catch (err) {
        // Don't update state if the request was aborted (replaced by newer one)
        if (err.name === "AbortError") {
          return;
        }

        // Check if still latest request
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Network error or other fetch failure
        setError({
          message: navigator.onLine
            ? "Failed to connect to the server. Please try again."
            : "You appear to be offline. Please check your connection.",
          retryable: true,
        });
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const cancel = useCallback(() => {
    // Invalidate even a response that has arrived but is still being parsed.
    requestIdRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, generate, cancel, clearError };
}
