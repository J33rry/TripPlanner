"use client";

import { CheckIcon } from "./icons";

export default function PackingList({ items, onToggle }) {
  if (!items?.length) return null;
  const packed = items.filter((item) => item.checked).length;

  return (
    <details className="extra-card">
      <summary>
        <span>Packing list</span>
        <small>{packed}/{items.length} packed</small>
      </summary>
      <ul className="packing-list">
        {items.map((item, index) => (
          <li key={`${item.text}-${index}`}>
            {onToggle ? (
              <button type="button" className={item.checked ? "is-checked" : ""} onClick={() => onToggle(index)} aria-pressed={item.checked}>
                <span className="checkbox" aria-hidden="true">{item.checked && <CheckIcon />}</span>
                {item.text}
              </button>
            ) : (
              <span className={`packing-item ${item.checked ? "is-checked" : ""}`}>
                <span className="checkbox" aria-hidden="true">{item.checked && <CheckIcon />}</span>
                {item.text}
                {item.checked && <span className="sr-only"> (packed)</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
