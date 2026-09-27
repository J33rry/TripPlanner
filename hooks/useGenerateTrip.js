"use client";

import { useState, useRef, useCallback } from "react";

export function useGenerateTrip(onSuccess) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const generate = useCallback(
    async ({ userInput, existingTrip, refinement }) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

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

        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const data = await response.json();

        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok || !data.success) {
          setError({
            message: data.error || "Something went wrong",
            code: data.code,
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
        if (err.name === "AbortError") {
          return;
        }

        if (currentRequestId !== requestIdRef.current) {
          return;
        }

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
