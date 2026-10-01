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
export const UserIcon = () => <svg {...base}><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6" /></svg>;
export const MailIcon = () => <svg {...base}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.8 7 8.2 6 8.2-6" /></svg>;
export const LockIcon = () => <svg {...base}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><path d="M12 14.5v2" /></svg>;
export const EyeIcon = () => <svg {...base}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
export const EyeOffIcon = () => (
  <svg {...base}>
    <path d="M10 5.7A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3.5 3.5 17 17" />
  </svg>
);
export const MapIcon = () => <svg {...base}><path d="m3.5 6.5 5.5-2.5 6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5Z" /><path d="M9 4v13.5M15 6.5V20" /></svg>;
export const LogoutIcon = () => <svg {...base}><path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" /><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" /></svg>;
export const GoogleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5Z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5Z" />
  </svg>
);

// Travel modes, drawn on the same 24px grid and stroke as the icons above.
export const WalkIcon = () => (
  <svg {...base}>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="m11.4 8.2-1.7 6.1 3 2.6.9 4.6" />
    <path d="M9.7 14.3 8 21" />
    <path d="m11.4 8.2 3 2.7 2.8.5" />
    <path d="m11.4 8.2-3.1 1.8-1.1 3" />
  </svg>
);
export const BikeIcon = () => (
  <svg {...base}>
    <circle cx="5.5" cy="16.5" r="3.5" />
    <circle cx="18.5" cy="16.5" r="3.5" />
    <path d="M5.5 16.5h6l-2-7-4 7" />
    <path d="M9.5 9.5H15l3.5 7" />
    <path d="m15 9.5-3.5 7" />
    <path d="M14 6.5h2.5" />
    <path d="m15 9.5.3-3" />
  </svg>
);
export const TramIcon = () => (
  <svg {...base}>
    <rect x="6" y="5.5" width="12" height="12.5" rx="3" />
    <path d="M6 12h12" />
    <path d="M9.5 2.5h5M12 2.5v3" />
    <path d="m9 18-2 3M15 18l2 3" />
    <path d="M9.5 15h.5M14 15h.5" />
  </svg>
);
export const BusIcon = () => (
  <svg {...base}>
    <rect x="5" y="3.5" width="14" height="15" rx="2.5" />
    <path d="M5 11h14M5 7h14" />
    <path d="M8 18.5V21M16 18.5V21" />
    <path d="M8 14.8h1M15 14.8h1" />
  </svg>
);
export const CarIcon = () => (
  <svg {...base}>
    <path d="m5 11 1.6-4.2a2 2 0 0 1 1.9-1.3h7a2 2 0 0 1 1.9 1.3L19 11" />
    <rect x="3.5" y="11" width="17" height="6" rx="2" />
    <path d="M6 17v2M18 17v2" />
    <path d="M7 14h1.5M15.5 14H17" />
  </svg>
);
export const TrainIcon = () => (
  <svg {...base}>
    <path d="M6 16V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
    <path d="M6 10.5h12" />
    <path d="M9.5 14.5h.5M14 14.5h.5" />
    <path d="M8.5 18 6.5 21M15.5 18l2 3" />
  </svg>
);
export const FerryIcon = () => (
  <svg {...base}>
    <path d="M3.5 13.5h17l-2 4.5H5.5Z" />
    <path d="M7 13.5V10h8.5l1.5 3.5" />
    <path d="M11 10V6.5h3" />
    <path d="M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
  </svg>
);
export const PlaneIcon = () => (
  <svg {...base}>
    <path
      transform="rotate(45 12 12)"
      d="M12 2.5c.9 0 1.5.9 1.5 2V9l7 4v2l-7-2v4.5l2 1.5v1.5L12 19.5l-3.5 1V19l2-1.5V13l-7 2v-2l7-4V4.5c0-1.1.6-2 1.5-2Z"
    />
  </svg>
);

export const MODE_ICONS = {
  walk: WalkIcon,
  bike: BikeIcon,
  transit: TramIcon,
  bus: BusIcon,
  drive: CarIcon,
  train: TrainIcon,
  ferry: FerryIcon,
  flight: PlaneIcon,
};
