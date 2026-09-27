"use client";

import { useState } from "react";
import { SendIcon, SparkleIcon } from "./icons";

export default function RefineInput({ onRefine, loading, placeholder = "Make day 2 more relaxed…" }) {
  const [value, setValue] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!value.trim() || loading) return;
    onRefine(value.trim());
    setValue("");
  };

  return (
    <form className={`refine-bar ${loading ? "is-loading" : ""}`} onSubmit={handleSubmit}>
      <span className="refine-spark" aria-hidden="true"><SparkleIcon /></span>
      <label className="sr-only" htmlFor="refine-input">Ask Roam to change this plan</label>
      <input
        id="refine-input"
        value={value}
        maxLength={400}
        onChange={(event) => setValue(event.target.value)}
        placeholder={loading ? "Reworking your plan…" : placeholder}
        disabled={loading}
      />
      <button type="submit" className="refine-send" disabled={!value.trim() || loading} aria-label="Update plan">
        {loading ? <span className="spinner" aria-hidden="true" /> : <SendIcon />}
      </button>
    </form>
  );
}
