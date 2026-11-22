"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Avatar, ChevronIcon, Mascot, PlusIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { DiaryTabs } from "@/components/DiaryTabs";
import { GrowthChart, type ChartPoint } from "@/components/GrowthChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePolled } from "@/hooks/usePolled";
import { addDays, ageBetween, daysBetween, formatAge, parseCivilDate, TERM_DAYS, toIso, todayCivil, type CivilDate } from "@/lib/age";
import { api } from "@/lib/api";
import { fmtChange, fmtLength, fmtWeight, type GrowthMeasurement, type GrowthMetric } from "@/lib/growth";

/** A lista mostra só as últimas; o resto abre em "Ver todas". */
const SHOWN = 3;
const PERIODS = [
  { months: 6, label: "6 m" },
  { months: 12, label: "1 ano" },
  { months: 0, label: "Tudo" },
] as const;

const fmtDate = (d: CivilDate) => `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;

interface Point {
  m: GrowthMeasurement;
  date: CivilDate;
  /** Em gramas ou milímetros. */
  raw: number;
}

export function CrescimentoScreen() {
  const { state, now } = useReadyApp();
  const kids = state.children;
  const [childId, setChildId] = useState<number>(kids[0]?.id ?? 0);
  const [metric, setMetric] = useState<GrowthMetric>("weight");
  const [months, setMonths] = useState(0);
  const [corrected, setCorrected] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const child = kids.find((k) => k.id === childId) ?? kids[0];
  const fetcher = useCallback(
    () =>
      api<{ measurements: GrowthMeasurement[] }>("GET", `/api/growth?childId=${child.id}`).then((r) => ({
        childId: child.id,
        list: r.measurements,
      })),
    [child.id],
  );
  const { data, error } = usePolled(fetcher, "Não foi possível carregar as medições.");
  // Ao trocar de criança, não mostra por um instante as medições da anterior.
  const all = data?.childId === child.id ? data.list : null;

  const birth = child.birthDate ? parseCivilDate(child.birthDate) : null;
  const canCorrect = !!birth && child.premature === "yes" && !!child.gestationalAge;
  const useCorrected = canCorrect && corrected;
  const origin =
    birth && useCorrected && child.gestationalAge
      ? addDays(birth, TERM_DAYS - (child.gestationalAge.weeks * 7 + child.gestationalAge.days))
      : birth;

  // Datas civis "AAAA-MM-DD" se comparam como texto.
  const cutoff = months ? toIso(addDays(todayCivil(now), -Math.round(months * 30.4375))) : null;
  const points: Point[] = useMemo(() => {
    if (!all) return [];
    return all.flatMap((m) => {
      const raw = metric === "weight" ? m.weightG : m.lengthMm;
      const date = parseCivilDate(m.measuredOn);
      if (raw === undefined || !date || (cutoff && m.measuredOn < cutoff)) return [];
      return [{ m, date, raw }];
    });
  }, [all, metric, cutoff]);

  const sel = selected === null || selected >= points.length ? points.length - 1 : selected;
  const fmt = (raw: number) => (metric === "weight" ? fmtWeight(raw) : fmtLength(raw));
  const ageAt = (date: CivilDate) => {
    if (!origin) return null;
    const days = daysBetween(origin, date);
    if (days < 0) return "antes das 40 semanas";
    return formatAge(ageBetween(origin, date)) + (useCorrected ? " (corrigida)" : "");
  };
  const reset = () => {
    setSelected(null);
    setShowAll(false);
  };

  const chartPoints: ChartPoint[] = points.map((p) => ({
    date: p.date,
    value: metric === "weight" ? p.raw / 1000 : p.raw / 10,
    label: `${fmt(p.raw)} em ${fmtDate(p.date)}`,
  }));
  const last = points.at(-1);
  const prevOfLast = points.at(-2);
  const picked = points[sel];
  const beforePicked = points[sel - 1];

  const rows = points.map((p, i) => ({ p, i })).reverse();
  const visibleRows = showAll ? rows : rows.filter((r, k) => k < SHOWN || r.i === sel);
  const newHref = `/diario/crescimento/nova?crianca=${child.id}`;

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Diário"
        action={
          <Link href={newHref} aria-label="Nova medição" className="appbar-btn">
            <PlusIcon size={26} />
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        <DiaryTabs current="/diario/crescimento" />

        {kids.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Criança">
            {kids.map((k) => (
              <button
                key={k.id}
                type="button"
                className="chip pl-1.5"
                aria-pressed={k.id === child.id}
                onClick={() => {
                  setChildId(k.id);
                  setCorrected(false);
                  reset();
                }}
              >
                <Avatar fill={k.fill} photo={k.photoUrl} size={28} />
                {k.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-field p-1" role="group" aria-label="Medida">
          {(["weight", "length"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => {
                setMetric(m);
                reset();
              }}
              className={
                "h-10 rounded-xl text-[15px] font-extrabold " +
                (metric === m ? "bg-white text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]" : "text-ink-soft")
              }
            >
              {m === "weight" ? "Peso" : "Comprimento"}
            </button>
          ))}
        </div>

        {error && !all && (
          <p role="alert" className="rounded-2xl border border-line bg-coral p-3 font-bold">
            {error}
          </p>
        )}

        {all && all.length === 0 && (
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <Mascot size={120} />
            <h2 className="text-xl font-extrabold">Nenhuma medição de {child.name} ainda</h2>
            <p className="text-ink-soft">Anote o peso e o comprimento da consulta ou do nascimento para ver a evolução.</p>
            <Link href={newHref} className="btn btn-primary h-14 px-6 text-lg">
              <PlusIcon size={22} /> Nova medição
            </Link>
          </section>
        )}

        {all && all.length > 0 && (
          <>
            <section className="card p-4" aria-label="Gráfico">
              {last ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-display text-[2.1rem] font-semibold leading-none tabular-nums">{fmt(last.raw)}</p>
                    {prevOfLast && (
                      <span className="rounded-full bg-brand-soft px-2.5 py-1 text-sm font-extrabold text-brand tabular-nums">
                        {fmtChange(metric, last.raw - prevOfLast.raw)} em {daysBetween(prevOfLast.date, last.date)} dias
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-ink-soft">
                    Última medição em {fmtDate(last.date)}
                    {ageAt(last.date) ? ` · ${ageAt(last.date)}` : ""}
                  </p>

                  <div className="mt-3">
                    <GrowthChart
                      points={chartPoints}
                      metric={metric}
                      origin={origin}
                      corrected={useCorrected}
                      selected={sel}
                      onSelect={setSelected}
                    />
                  </div>

                  {picked && (
                    <p className="mt-2.5 rounded-xl bg-field px-3 py-2 text-sm font-bold leading-snug tabular-nums" aria-live="polite">
                      <span className="font-extrabold">{fmt(picked.raw)}</span> em {fmtDate(picked.date)}
                      {ageAt(picked.date) && <span className="text-ink-soft"> · {ageAt(picked.date)}</span>}
                      <br />
                      <span className="text-ink-soft">
                        {beforePicked
                          ? `${fmtChange(metric, picked.raw - beforePicked.raw)} em ${daysBetween(beforePicked.date, picked.date)} dias`
                          : "Primeira medição do período"}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-ink-soft">
                  Nenhuma medição de {metric === "weight" ? "peso" : "comprimento"} {months ? "neste período" : "ainda"}.
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1 rounded-xl bg-field p-[3px]" role="group" aria-label="Período">
                  {PERIODS.map((p) => (
                    <button
                      key={p.months}
                      type="button"
                      aria-pressed={months === p.months}
                      onClick={() => {
                        setMonths(p.months);
                        reset();
                      }}
                      className={
                        "h-8 rounded-[9px] px-3 text-[13.5px] font-extrabold " +
                        (months === p.months ? "bg-white text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]" : "text-ink-soft")
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {canCorrect && (
                  <button
                    type="button"
                    className="chip h-[2.4rem] text-[13.5px]"
                    aria-pressed={corrected}
                    onClick={() => {
                      setCorrected((v) => !v);
                      reset();
                    }}
                  >
                    Idade corrigida
                  </button>
                )}
              </div>
              {!birth && (
                <p className="mt-2.5 text-sm text-ink-soft">
                  Com a data de nascimento no Perfil, o gráfico mostra a idade em meses.
                </p>
              )}
            </section>

            {points.length > 0 && (
              <section aria-labelledby="ultimas">
                <h2 id="ultimas" className="mb-2 text-[15px] font-extrabold">
                  Últimas medições
                </h2>
                <ul className="flex flex-col gap-2">
                  {visibleRows.map(({ p, i }) => {
                    const before = points[i - 1];
                    return (
                      <li key={p.m.id}>
                        <Link
                          href={`/diario/crescimento/${p.m.id}`}
                          aria-current={i === sel ? "true" : undefined}
                          className={
                            "flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-2.5 " +
                            (i === sel ? "border-brand" : "border-line")
                          }
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[17px] font-extrabold tabular-nums">{fmt(p.raw)}</span>
                            <span className="block text-sm font-semibold text-ink-soft">
                              {fmtDate(p.date)}
                              {ageAt(p.date) ? ` · ${ageAt(p.date)}` : ""}
                            </span>
                          </span>
                          <span className={"text-sm font-extrabold tabular-nums " + (before ? "text-brand" : "text-ink-soft")}>
                            {before ? fmtChange(metric, p.raw - before.raw) : "—"}
                          </span>
                          <span className="text-ink-soft">
                            <ChevronIcon />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {rows.length > SHOWN && (
                  <button
                    type="button"
                    aria-expanded={showAll}
                    onClick={() => setShowAll((v) => !v)}
                    className="mt-2 h-11 w-full rounded-2xl border-[1.5px] border-dashed border-line text-[15px] font-extrabold text-brand"
                  >
                    {showAll ? "Mostrar só as últimas" : `Ver todas as ${rows.length} medições`}
                  </button>
                )}
              </section>
            )}

            <p className="text-center text-sm leading-snug text-ink-soft">
              O gráfico mostra só as medições registradas pela família. Ele não compara com outras crianças nem diz se o
              crescimento está adequado: isso é conversa para a consulta.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
