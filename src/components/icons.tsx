interface P {
  className?: string;
}

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconMarker = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M4.5 19.5 13 11l3.5 3.5-8.5 8.5H4.5v-3.5Z" fill="currentColor" stroke="none" />
    <path d="m14.5 9.5 2.2-2.2a1.9 1.9 0 0 1 2.7 0l.8.8a1.9 1.9 0 0 1 0 2.7L18 13" {...s} />
    <path d="M13 11l3.5 3.5" {...s} />
    <path d="M4.5 23h7" {...s} strokeWidth={2.2} />
  </svg>
);

export const IconSpark = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9Z" fill="currentColor" stroke="none" />
    <path d="M18.5 3v3.4M20.2 4.7h-3.4" {...s} strokeWidth={1.6} />
  </svg>
);

export const IconDownload = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" {...s} />
  </svg>
);

export const IconCompare = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" {...s} />
    <path d="M12 3.5v17" {...s} strokeDasharray="2.5 2.5" />
    <path d="m7.5 10-2 2 2 2M16.5 10l2 2-2 2" {...s} />
  </svg>
);

export const IconCheck = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7" {...s} strokeWidth={2.2} />
  </svg>
);

export const IconX = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...s} />
  </svg>
);

export const IconShield = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 3.5 18.5 6v5.2c0 4.4-2.8 7.3-6.5 8.8-3.7-1.5-6.5-4.4-6.5-8.8V6Z" {...s} />
    <path d="m9.2 11.8 2 2 3.6-4" {...s} />
  </svg>
);

export const IconFile = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M6.5 3.5h7.5l4 4v13h-11.5Z" {...s} />
    <path d="M14 3.5v4h4" {...s} />
    <path d="M9 12h6M9 15.5h6" {...s} strokeWidth={1.5} />
  </svg>
);

export const IconRefresh = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L20 9" {...s} />
    <path d="M20 4.5V9h-4.5" {...s} />
    <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L4 15" {...s} />
    <path d="M4 19.5V15h4.5" {...s} />
  </svg>
);

export const IconArrow = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M4.5 12h15m-6.5-6.5L19.5 12 13 18.5" {...s} />
  </svg>
);

export const IconWand = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="m5 19 9.5-9.5M17 4.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" {...s} />
    <path d="m19 13 .6 1.4L21 15l-1.4.6L19 17l-.6-1.4L17 15l1.4-.6Z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconEye = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M3.5 12S6.5 6.5 12 6.5 20.5 12 20.5 12 17.5 17.5 12 17.5 3.5 12 3.5 12Z" {...s} />
    <circle cx="12" cy="12" r="2.4" {...s} />
  </svg>
);

export const IconTrash = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 13h8.4L17 7" {...s} />
  </svg>
);

export const IconInstall = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" {...s} />
    <path d="M12 7v6M9.5 10.5 12 13l2.5-2.5" {...s} strokeWidth={1.6} />
    <path d="M10.5 18.5h3" {...s} strokeWidth={1.6} />
  </svg>
);

export const IconOffline = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M4 8.8A12.5 12.5 0 0 1 12 6c2.9 0 5.6 1 7.7 2.7M7 12.2a8 8 0 0 1 5-1.8c.9 0 1.8.15 2.6.45M10 15.6a4 4 0 0 1 4 .4" {...s} />
    <circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none" />
    <path d="m4 4 16 16" {...s} />
  </svg>
);

export const IconLock = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" {...s} />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...s} />
    <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconImage = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" {...s} />
    <circle cx="9" cy="10" r="1.6" {...s} strokeWidth={1.5} />
    <path d="m5 17.5 4.5-4.5 3 3 2.5-2.5 4 4" {...s} strokeWidth={1.6} />
  </svg>
);
