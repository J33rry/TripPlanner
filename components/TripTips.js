"use client";

export default function TripTips({ tips }) {
  if (!tips?.length) return null;

  return (
    <details className="extra-card">
      <summary>
        <span>Good to know</span>
        <small>{tips.length} tips</small>
      </summary>
      <ul className="tips-list">
        {tips.map((tip, index) => <li key={index}>{tip}</li>)}
      </ul>
    </details>
  );
}
