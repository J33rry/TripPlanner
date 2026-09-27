// Minimal stroke icons matching the Roam designs. Decorative: callers label
// the surrounding button.
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export const GripIcon = () => (
  <svg {...base} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />))}
  </svg>
);
export const ChevronIcon = () => <svg {...base}><path d="m6 9 6 6 6-6" /></svg>;
export const CloseIcon = () => <svg {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const PencilIcon = () => <svg {...base}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>;
export const MoreIcon = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
  </svg>
);
export const SparkleIcon = () => (
  <svg {...base}><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /></svg>
);
export const SendIcon = () => <svg {...base}><path d="M4 12 20 4l-5 16-3.5-6.5L4 12Z" /><path d="m11.5 13.5 3-3" /></svg>;
export const ArrowIcon = () => <svg {...base}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const BookmarkIcon = () => <svg {...base}><path d="M7 4h10v16l-5-3.5L7 20V4Z" /></svg>;
export const PlusIcon = () => <svg {...base}><path d="M12 5v14M5 12h14" /></svg>;
export const TrashIcon = () => <svg {...base}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /></svg>;
export const SearchIcon = () => <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
export const CheckIcon =() => <svg {...base}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
