"use client";

import { useState, type ReactNode } from "react";

/* Arte e ícones do Cuidaí Kids. Tudo em SVG, para ficar nítido em qualquer tela e seguir o tema. */

/**
 * Avatar da criança: a foto dela, com um anel na cor escolhida, ou um rostinho desenhado nessa cor.
 * Se a foto não carregar (sem internet, removida), volta para o desenho.
 */
export function Avatar({ fill, photo, size = 32 }: { fill: string; photo?: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (photo && failed !== photo) {
    const ring = Math.max(2, Math.round(size / 16));
    return (
      // A foto já vem do servidor em 256×256 e comprimida; não há o que o otimizador de imagens do Next acrescentar.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(photo)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, boxShadow: `0 0 0 ${ring}px ${fill}`, background: fill }}
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <circle cx="20" cy="20" r="20" fill={fill} />
      <circle cx="20" cy="22.5" r="11.5" fill="#f7cba5" />
      <path d="M8.6 21.5c-.6-7.6 4.6-12.6 11.4-12.6s12 5 11.4 12.6c-1.6-4.2-4.4-6.4-7.6-6.8-1.4 1.6-5.4 3-10 2.6-2.4.9-4.4 2.4-5.2 4.2z" fill="#7a4524" />
      <circle cx="15.6" cy="23.4" r="1.6" fill="#3a2418" />
      <circle cx="24.4" cy="23.4" r="1.6" fill="#3a2418" />
      <circle cx="13.2" cy="27" r="1.9" fill="#f29a8a" opacity=".55" />
      <circle cx="26.8" cy="27" r="1.9" fill="#f29a8a" opacity=".55" />
      <path d="M17 27.6c1.8 1.7 4.2 1.7 6 0" stroke="#3a2418" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function BearHead({ cx, cy, r, fur, inner }: { cx: number; cy: number; r: number; fur: string; inner: string }) {
  const k = r / 60;
  return (
    <g>
      <circle cx={cx - 40 * k} cy={cy - 44 * k} r={19 * k} fill={fur} />
      <circle cx={cx + 40 * k} cy={cy - 44 * k} r={19 * k} fill={fur} />
      <circle cx={cx - 40 * k} cy={cy - 44 * k} r={10 * k} fill={inner} />
      <circle cx={cx + 40 * k} cy={cy - 44 * k} r={10 * k} fill={inner} />
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.92} fill={fur} />
      <ellipse cx={cx} cy={cy + 20 * k} rx={26 * k} ry={19 * k} fill={inner} />
      <ellipse cx={cx} cy={cy + 11 * k} rx={9 * k} ry={6.5 * k} fill="#3a2418" />
      <path
        d={`M${cx - 8 * k} ${cy + 22 * k}q${8 * k} ${8 * k} ${16 * k} 0`}
        stroke="#3a2418"
        strokeWidth={2.6 * k}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={cx - 21 * k} cy={cy - 6 * k} r={5.2 * k} fill="#3a2418" />
      <circle cx={cx + 21 * k} cy={cy - 6 * k} r={5.2 * k} fill="#3a2418" />
      <circle cx={cx - 19.5 * k} cy={cy - 7.6 * k} r={1.6 * k} fill="#ffffff" />
      <circle cx={cx + 22.5 * k} cy={cy - 7.6 * k} r={1.6 * k} fill="#ffffff" />
      <ellipse cx={cx - 34 * k} cy={cy + 14 * k} rx={8 * k} ry={5.5 * k} fill="#f29a8a" opacity=".6" />
      <ellipse cx={cx + 34 * k} cy={cy + 14 * k} rx={8 * k} ry={5.5 * k} fill="#f29a8a" opacity=".6" />
    </g>
  );
}

function Heart({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 3.2C0-.6 4.6-1.8 6.4 1.4 8.2-1.8 12.8-.6 12.8 3.2c0 4-6.4 8.3-6.4 8.3S0 7.2 0 3.2z"
      fill={fill}
    />
  );
}

/** Mascote: a ursa abraçando o filhote, com corações. */
export function Mascot({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 200) / 240} viewBox="0 0 240 200" aria-hidden="true" className="shrink-0">
      <BearHead cx={98} cy={92} r={64} fur="#b9773f" inner="#eecb9f" />
      <BearHead cx={162} cy={142} r={42} fur="#dba566" inner="#f6dcb6" />
      <Heart x={178} y={34} s={2.1} fill="#f4604a" />
      <Heart x={208} y={66} s={1.3} fill="#f4604a" />
    </svg>
  );
}

/** Marca "Cuidaí Kids" com as faíscas. `size` é a altura do texto em px. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={"relative inline-flex items-baseline whitespace-nowrap font-display font-bold leading-none " + (className ?? "")}
      style={{ fontSize: size, letterSpacing: "-0.01em" }}
    >
      <span className="text-brand">Cuidaí</span>
      <span className="ml-[0.18em] text-cta">Kids</span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="absolute"
        style={{ width: size * 0.5, height: size * 0.5, right: -size * 0.42, top: -size * 0.3 }}
        fill="none"
        stroke="#f6b72f"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M5 13V5M12 15l6-6M14 21h7" />
      </svg>
    </span>
  );
}

function Stroke({ size = 22, sw = 2, children }: { size?: number; sw?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number };

export const CheckIcon = ({ size = 22 }: IconProps) => (
  <Stroke size={size} sw={3.2}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Stroke>
);
export const PlusIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size} sw={3}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
);
export const MinusIcon = ({ size = 22 }: IconProps) => (
  <Stroke size={size} sw={3.2}>
    <path d="M5 12h14" />
  </Stroke>
);
export const BackIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size} sw={2.6}>
    <path d="M20 12H5M11 5l-7 7 7 7" />
  </Stroke>
);
export const ChevronIcon = ({ size = 18 }: IconProps) => (
  <Stroke size={size} sw={2.6}>
    <path d="M9 5l7 7-7 7" />
  </Stroke>
);
export const ClockIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Stroke>
);
export const CalendarIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />
  </Stroke>
);
export const BottleIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size}>
    <rect x="7" y="2.5" width="10" height="4" rx="1.2" />
    <path d="M8 6.5h8v1.6l1.4 1.6c.4.5.6 1 .6 1.6V19a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19v-7.7c0-.6.2-1.1.6-1.6L8 8.1z" />
    <path d="M12 12.5v5M9.5 15h5" />
  </Stroke>
);
export const NoteIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size}>
    <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
    <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
  </Stroke>
);
export const RepeatIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size}>
    <path d="M4 11a8 8 0 0 1 14-4.5L20 8M20 4v4h-4M20 13a8 8 0 0 1-14 4.5L4 16M4 20v-4h4" />
  </Stroke>
);
export const InfoIcon = ({ size = 22 }: IconProps) => (
  <Stroke size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6v.1" />
  </Stroke>
);
export const BellIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
  </Stroke>
);
export const HeartIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  </Stroke>
);
export const FamilyIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
    <circle cx="12" cy="7.5" r="3.2" />
    <circle cx="5.2" cy="9.2" r="2.4" />
    <circle cx="18.8" cy="9.2" r="2.4" />
    <path d="M6.6 19.5c0-3.5 2.4-6.3 5.4-6.3s5.4 2.8 5.4 6.3zM.8 18.5c0-2.6 1.8-4.6 4.2-4.6 1 0 1.8.3 2.5.8a7.6 7.6 0 0 0-1.9 3.8zM23.2 18.5c0-2.6-1.8-4.6-4.2-4.6-1 0-1.8.3-2.5.8a7.6 7.6 0 0 1 1.9 3.8z" />
  </svg>
);
export const TicketIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size}>
    <path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a3.5 3.5 0 0 0 0 7v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-2a3.5 3.5 0 0 0 0-7z" transform="rotate(-12 12 12)" />
    <path d="M10 9.5l4 5" transform="rotate(-12 12 12)" />
  </Stroke>
);
export const CameraIcon = ({ size = 18 }: IconProps) => (
  <Stroke size={size} sw={2.4}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="12.5" r="3.3" />
  </Stroke>
);
export const EditIcon = ({ size = 18 }: IconProps) => (
  <Stroke size={size}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
  </Stroke>
);
export const TrashIcon = ({ size = 18 }: IconProps) => (
  <Stroke size={size}>
    <path d="M4 7h16M10 3.5h4M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  </Stroke>
);
export const HomeIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size}>
    <path d="M3.5 11 12 4l8.5 7M6 9.5V19a1.5 1.5 0 0 0 1.5 1.5H10v-5h4v5h2.5A1.5 1.5 0 0 0 18 19V9.5" />
  </Stroke>
);
export const GearIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </Stroke>
);
export const UserIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Stroke>
);
/** Ícone de remédio com cruz, usado na navegação e nos cartões. */
export const MedIcon = ({ size = 24 }: IconProps) => <BottleIcon size={size} />;
