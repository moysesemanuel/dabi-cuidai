"use client";

import { useId } from "react";
import { addDays, daysBetween, type CivilDate } from "@/lib/age";
import { ticks, type GrowthMetric } from "@/lib/growth";

export interface ChartPoint {
  date: CivilDate;
  /** Em kg ou cm (já convertido para o eixo). */
  value: number;
  label: string;
}

const W = 360;
const H = 244;
const L = 44;
const R = 14;
const T = 26;
const B = 40;
const MONTH_DAYS = 30.4375;

const monthShort = (d: CivilDate) =>
  new Date(d.y, d.m - 1, d.d)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(". de ", "/")
    .replace(" de ", "/")
    .replace(".", "");

/**
 * Linha das medições de uma criança. O eixo de baixo é a idade em meses, contada do nascimento
 * ou da data em que completaria 40 semanas (idade corrigida). Sem data de nascimento, mostra os meses no calendário.
 */
export function GrowthChart({
  points,
  metric,
  origin,
  corrected,
  selected,
  onSelect,
}: {
  points: ChartPoint[];
  metric: GrowthMetric;
  /** Nascimento ou data das 40 semanas; null = sem data de nascimento. */
  origin: CivilDate | null;
  corrected: boolean;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const gradientId = useId();
  if (!points.length) return null;

  const base = origin ?? points[0].date;
  const xs = points.map((p) => daysBetween(base, p.date) / MONTH_DAYS);
  const ys = points.map((p) => p.value);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xt = ticks(xMin, Math.max(xMax, xMin + 1), 5);
  const xStep = xt.step < 1 ? 1 : xt.step;
  // Antes das 40 semanas (idade corrigida negativa), o eixo começa só um pouco antes da primeira medição.
  const x0 = xMin < 0 ? Math.floor(xMin) : Math.floor(xMin / xStep) * xStep;
  const x1 = Math.max(Math.ceil(xMax / xStep) * xStep, x0 + xStep);
  const yt = ticks(Math.min(...ys), Math.max(...ys), 4);
  const sx = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v: number) => T + (1 - (v - yt.from) / (yt.to - yt.from)) * (H - T - B);

  const xValues: number[] = [];
  for (let v = Math.ceil(x0 / xStep) * xStep; v <= x1 + 1e-9; v += xStep) xValues.push(v);
  const xLabel = (v: number) => (origin ? String(Math.round(v)) : monthShort(addDays(base, Math.round(v * MONTH_DAYS))));
  const yDecimals = metric === "weight" && yt.step < 1 ? 1 : 0;

  const path = points.map((p, i) => `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)},${sy(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${sx(xs.at(-1)!).toFixed(1)},${H - B} L${sx(xs[0]).toFixed(1)},${H - B} Z`;
  const sel = Math.min(selected, points.length - 1);

  // Tocar em qualquer lugar escolhe a medição mais próxima na horizontal.
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    xs.forEach((v, i) => {
      if (Math.abs(sx(v) - x) < Math.abs(sx(xs[best]) - x)) best = i;
    });
    onSelect(best);
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full touch-pan-y"
      role="img"
      aria-label={`Gráfico de ${metric === "weight" ? "peso" : "comprimento"} com ${points.length} medições`}
      onPointerDown={pick}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--c-brand)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--c-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {corrected && x0 < 0 && (
        <g>
          <rect x={sx(x0)} y={T} width={sx(0) - sx(x0)} height={H - T - B} rx={6} fill="var(--c-field)" />
          {/* O texto só cabe quando a faixa é larga; estreita, ela fala por si e o eixo diz "idade corrigida". */}
          {sx(0) - sx(x0) >= 84 && (
          <text x={(sx(x0) + sx(0)) / 2} y={T + 12} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--c-ink-soft)">
            antes das 40 sem
          </text>
          )}
        </g>
      )}

      <g fontSize="11" fontWeight="700" fill="var(--c-ink-soft)">
        {yt.values.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="var(--c-line)" strokeWidth="1" opacity="0.7" />
            <text x={L - 8} y={sy(v) + 4} textAnchor="end">
              {v.toLocaleString("pt-BR", { minimumFractionDigits: yDecimals, maximumFractionDigits: yDecimals })}
            </text>
          </g>
        ))}
        {xValues.map((v) => (
          <g key={`x${v}`}>
            <line x1={sx(v)} x2={sx(v)} y1={H - B} y2={H - B + 4} stroke="var(--c-line)" strokeWidth="1.5" />
            <text x={sx(v)} y={H - B + 17} textAnchor="middle">
              {xLabel(v)}
            </text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize="10.5" fontWeight="800">
          {origin ? (corrected ? "idade corrigida (meses)" : "idade (meses)") : "mês da medição"}
        </text>
        <text x={L - 8} y={11} textAnchor="end" fontSize="10.5" fontWeight="800">
          {metric === "weight" ? "kg" : "cm"}
        </text>
      </g>

      <path d={area} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke="var(--c-brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <line
        x1={sx(xs[sel])}
        x2={sx(xs[sel])}
        y1={T}
        y2={H - B}
        stroke="var(--c-brand)"
        strokeWidth="1.5"
        strokeDasharray="3 4"
        opacity="0.6"
      />
      {points.map((p, i) => {
        const on = i === sel;
        return (
          <circle
            key={i}
            cx={sx(xs[i])}
            cy={sy(p.value)}
            r={on ? 7 : 4.5}
            fill={on ? "var(--c-cta)" : "var(--c-surface)"}
            stroke={on ? "var(--c-surface)" : "var(--c-brand)"}
            strokeWidth={on ? 3 : 2.5}
            tabIndex={0}
            role="button"
            aria-label={p.label}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(i);
              }
            }}
          />
        );
      })}
    </svg>
  );
}
