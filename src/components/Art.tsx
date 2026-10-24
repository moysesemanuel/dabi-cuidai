export function Avatar({ fill, size = 32 }: { fill: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 text-ink">
      <circle cx="16" cy="16" r="14" fill={fill} stroke="currentColor" strokeWidth="2" />
      <circle cx="11.5" cy="14" r="1.8" fill="currentColor" />
      <circle cx="20.5" cy="14" r="1.8" fill="currentColor" />
      <path d="M11 19.5c2.5 3 7.5 3 10 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Mascot({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true" className="shrink-0 text-ink">
      <g transform="rotate(-30 40 40)">
        <path d="M28 24h12v32H28a16 16 0 0 1 0-32z" fill="var(--color-white)" />
        <path d="M40 24h12a16 16 0 0 1 0 32H40z" fill="var(--color-coral)" />
        <rect x="12" y="24" width="56" height="32" rx="16" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M40 24v32" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="29" cy="37" r="2.4" fill="currentColor" />
        <circle cx="51" cy="37" r="2.4" fill="currentColor" />
        <path d="M33 45c4 4 10 4 14 0" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function CheckIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PlusIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}
