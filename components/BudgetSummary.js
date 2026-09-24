"use client";

export default function BudgetSummary({ budget }) {
  if (!budget) return null;

  return (
    <div className="glass-card p-4 animate-fade-in">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-1">
        <span>💰</span> Estimated Budget
      </h3>
      <p className="text-2xl font-bold text-accent-green">{budget}</p>
    </div>
  );
}
