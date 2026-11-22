"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Avatar, ChevronIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { DiaryTabs } from "@/components/DiaryTabs";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePolled } from "@/hooks/usePolled";
import { addDays, childAges, formatAge, parseCivilDate, toIso, todayCivil } from "@/lib/age";
import { api } from "@/lib/api";
import { fmtTemperature, fmtTime } from "@/lib/format";
import { fmtChange, fmtLength, fmtWeight } from "@/lib/growth";
import { CATEGORIES, fmtMilestoneDate } from "@/lib/milestones";
import { formatInterval } from "@/lib/schedule";
import { buildSummary, type SummaryData } from "@/lib/summary";

const PERIODS = [7, 15, 30] as const;

/** "12/11" (com o ano quando não é o atual). */
const dm = (ms: number, year: number) => {
  const d = new Date(ms);
  const base = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return d.getFullYear() === year ? base : `${base}/${d.getFullYear()}`;
};
const civilDm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Começo do dia civil no relógio do aparelho. */
const localStart = (iso: string) => {
  const d = parseCivilDate(iso)!;
  return new Date(d.y, d.m - 1, d.d).getTime();
};

export function ResumoScreen() {
  const { state, now } = useReadyApp();
  const kids = state.children;
  const today = toIso(todayCivil(now));
  const [childId, setChildId] = useState<number>(kids[0]?.id ?? 0);
  const [days, setDays] = useState<number | "custom">(30);
  const [customFrom, setCustomFrom] = useState(toIso(addDays(todayCivil(now), -29)));
  const [customTo, setCustomTo] = useState(today);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const child = kids.find((k) => k.id === childId) ?? kids[0];

  const fromDate = days === "custom" ? customFrom : toIso(addDays(todayCivil(now), -(days - 1)));
  const toDate = days === "custom" ? customTo : today;
  const validRange = !!parseCivilDate(fromDate) && !!parseCivilDate(toDate) && fromDate <= toDate;

  const fetcher = useCallback(async () => {
    if (!validRange) return null;
    const params = new URLSearchParams({
      childId: String(child.id),
      from: String(localStart(fromDate)),
      to: String(localStart(toIso(addDays(parseCivilDate(toDate)!, 1)))),
      fromDate,
      toDate,
    });
    const data = await api<SummaryData>("GET", `/api/summary?${params}`);
    return { key: `${child.id}|${fromDate}|${toDate}`, data };
  }, [child.id, fromDate, toDate, validRange]);
  const { data: result, error } = usePolled(fetcher, "Não foi possível montar o resumo.");
  const current = result?.key === `${child.id}|${fromDate}|${toDate}` ? result.data : null;
  const summary = useMemo(() => (current ? buildSummary(current, fromDate) : null), [current, fromDate]);

  const year = new Date(now).getFullYear();
  const birth = child.birthDate ? parseCivilDate(child.birthDate) : null;
  const ages = birth ? childAges(birth, todayCivil(now), child.premature === "yes", child.gestationalAge) : null;
  const isOpen = (key: string) => open[key] ?? false;
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  function printAll() {
    // Tudo aberto no papel; depois da impressão, volta como estava.
    const before = open;
    setOpen({ temp: true, sintomas: true, remedios: true, notas: true, crescimento: true, marcos: true });
    const restore = () => {
      setOpen(before);
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    setTimeout(() => window.print(), 50);
  }

  const sections: { key: string; title: string; meta: string; body: ReactNode; empty: boolean }[] = summary
    ? [
        {
          key: "temp",
          title: "Temperatura",
          empty: !summary.temperatures.length,
          meta: summary.maxTemperature
            ? `${plural(summary.temperatures.length, "medição", "medições")} · maior: ${fmtTemperature(summary.maxTemperature.value)} em ${dm(summary.maxTemperature.at, year)} às ${fmtTime(summary.maxTemperature.at)}`
            : "",
          body: (
            <ul className="flex flex-col gap-1 tabular-nums">
              {summary.temperatures.map((t) => (
                <li key={t.at}>
                  {dm(t.at, year)} às {fmtTime(t.at)}: <span className="font-extrabold">{fmtTemperature(t.value)}</span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          key: "sintomas",
          title: "Sintomas observados",
          empty: !summary.symptoms.length,
          meta:
            summary.symptoms
              .slice(0, 3)
              .map((s) => s.name)
              .join(", ") + (summary.symptoms.length > 3 ? ` e mais ${summary.symptoms.length - 3}` : ""),
          body: (
            <ul className="flex flex-col gap-1">
              {summary.symptoms.map((s) => (
                <li key={s.name}>
                  <span className="font-extrabold">{s.name}</span>
                  <span className="text-ink-soft">
                    {" "}
                    · {dm(s.first, year) === dm(s.last, year) ? dm(s.first, year) : `de ${dm(s.first, year)} a ${dm(s.last, year)}`}
                  </span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          key: "remedios",
          title: "Remédios",
          empty: !summary.medications.length,
          meta: summary.medications.map((m) => m.name).join(", "),
          body: (
            <ul className="flex flex-col gap-1">
              {summary.medications.map((m) => (
                <li key={m.medicationId}>
                  <span className="font-extrabold">{m.name}</span>
                  {m.doseText && <span className="text-ink-soft"> · {m.doseText}</span>}
                  <span className="text-ink-soft">
                    {" "}
                    ·{" "}
                    {m.asNeeded || m.intervalMinutes === undefined
                      ? "se necessário"
                      : `de ${formatInterval(m.intervalMinutes)} em ${formatInterval(m.intervalMinutes)}`}
                  </span>
                  {m.uses.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-0.5 pl-3 tabular-nums">
                      {m.uses.map((u) => (
                        <li key={u.at}>
                          {dm(u.at, year)} às {fmtTime(u.at)}
                          {u.reason && <span>: {u.reason}</span>}
                          {u.temperature !== undefined && <span> · {fmtTemperature(u.temperature)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ),
        },
        {
          key: "notas",
          title: "Anotações",
          empty: !summary.notes.length,
          meta: "",
          body: (
            <ul className="flex flex-col gap-2">
              {summary.notes.map((n) => (
                <li key={n.id}>
                  <span className="font-extrabold tabular-nums">
                    {dm(n.at, year)} às {fmtTime(n.at)}:
                  </span>{" "}
                  <span className="whitespace-pre-line break-words">{n.text}</span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          key: "crescimento",
          title: "Crescimento",
          empty: !summary.measurements.length,
          meta: [
            summary.weightChange &&
              `${fmtWeight(summary.weightChange.to.weightG!)} (${fmtChange("weight", summary.weightChange.diff)} desde ${civilDm(summary.weightChange.from.measuredOn).slice(0, 5)})`,
            summary.lengthChange &&
              `${fmtLength(summary.lengthChange.to.lengthMm!)} (${fmtChange("length", summary.lengthChange.diff)})`,
          ]
            .filter(Boolean)
            .join(" · ") || plural(summary.measurements.length, "medição", "medições"),
          body: (
            <ul className="flex flex-col gap-1 tabular-nums">
              {summary.measurements.map((m) => (
                <li key={m.id}>
                  <span className="text-ink-soft">{civilDm(m.measuredOn)}</span>
                  {m.weightG !== undefined && <span className="font-extrabold"> · {fmtWeight(m.weightG)}</span>}
                  {m.lengthMm !== undefined && <span className="font-extrabold"> · {fmtLength(m.lengthMm)}</span>}
                  {m.note && <span className="text-ink-soft"> · {m.note}</span>}
                </li>
              ))}
            </ul>
          ),
        },
        {
          key: "marcos",
          title: "Marcos do desenvolvimento",
          empty: !summary.milestones.length,
          meta: summary.milestones.map((m) => m.title).slice(0, 2).join(", ") + (summary.milestones.length > 2 ? "…" : ""),
          body: (
            <ul className="flex flex-col gap-1">
              {summary.milestones.map((m) => (
                <li key={m.id}>
                  <span className="font-extrabold">{m.title}</span>
                  <span className="text-ink-soft">
                    {" "}
                    · {fmtMilestoneDate(m.happenedOn, m.precision)}
                    {m.category && ` · ${CATEGORIES.find((c) => c.value === m.category)?.label}`}
                  </span>
                  {m.note && <span> · {m.note}</span>}
                </li>
              ))}
            </ul>
          ),
        },
      ]
    : [];
  const filled = sections.filter((s) => !s.empty);
  const emptyNames = sections.filter((s) => s.empty).map((s) => s.title);

  return (
    // No papel, a coluna ocupa a página inteira para o aviso final ficar no rodapé.
    <div className="flex flex-col print:min-h-[calc(100vh-16mm)]">
      <div className="print:hidden">
        <ScreenHeader title="Diário" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 print:hidden">
          <DiaryTabs current="/diario/resumo" />

          {kids.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Criança">
              {kids.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className="chip pl-1.5"
                  aria-pressed={k.id === child.id}
                  onClick={() => setChildId(k.id)}
                >
                  <Avatar fill={k.fill} photo={k.photoUrl} size={28} />
                  {k.name}
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="flex flex-wrap gap-1 rounded-2xl bg-field p-1" role="group" aria-label="Período">
              {[...PERIODS, "custom" as const].map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={days === p}
                  onClick={() => setDays(p)}
                  className={
                    "h-10 flex-1 rounded-xl px-2 text-sm font-extrabold " +
                    (days === p ? "bg-white text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]" : "text-ink-soft")
                  }
                >
                  {p === "custom" ? "Escolher" : `${p} dias`}
                </button>
              ))}
            </div>
            {days === "custom" && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="de" className="text-sm font-semibold text-ink-soft">De</label>
                  <input id="de" type="date" className="field" value={customFrom} max={today} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="ate" className="text-sm font-semibold text-ink-soft">Até</label>
                  <input id="ate" type="date" className="field" value={customTo} max={today} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </div>
            )}
            {!validRange && <p className="mt-2 text-sm font-bold text-danger">Escolha um período em que o início vem antes do fim.</p>}
          </div>
        </div>

        <section className="card flex flex-col gap-2 p-4 print:shadow-none">
          <div className="flex items-center gap-3">
            <Avatar fill={child.fill} photo={child.photoUrl} size={48} />
            <div className="min-w-0">
              <h2 className="break-words font-display text-2xl font-semibold leading-tight">Resumo de {child.name}</h2>
              <p className="text-sm font-semibold text-ink-soft">
                {civilDm(fromDate)} a {civilDm(toDate)}
              </p>
            </div>
          </div>
          {birth && ages && (
            <p className="text-[15px] leading-snug">
              Nasceu em {civilDm(child.birthDate!)}
              {child.premature === "yes" &&
                ` · prematuro${child.gestationalAge ? `, ${child.gestationalAge.weeks} semanas${child.gestationalAge.days ? ` e ${child.gestationalAge.days} ${child.gestationalAge.days === 1 ? "dia" : "dias"}` : ""}` : ""}`}
              <br />
              Idade: <b>{formatAge(ages.chronological)}</b>
              {ages.corrected && (
                <>
                  {" "}
                  · idade corrigida: <b>{formatAge(ages.corrected)}</b>
                </>
              )}
            </p>
          )}
        </section>

        {error && !summary && (
          <p role="alert" className="rounded-2xl border border-line bg-coral p-3 font-bold">
            {error}
          </p>
        )}
        {validRange && !summary && !error && <p className="text-center text-sm text-ink-soft">Montando o resumo…</p>}

        {summary && filled.length === 0 && (
          <p className="card p-4 text-ink-soft">Nada foi registrado para {child.name} neste período.</p>
        )}

        {filled.map((s) => (
          <section key={s.key} className="card overflow-hidden print:break-inside-avoid print:shadow-none">
            <h3>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                aria-expanded={isOpen(s.key)}
                aria-controls={`resumo-${s.key}`}
                className="flex w-full items-center gap-3 p-4 text-left print:pb-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold">{s.title}</span>
                  {s.meta && (
                    <span className="block break-words text-sm font-semibold text-ink-soft print:hidden">{s.meta}</span>
                  )}
                </span>
                <span className={"text-ink-soft transition-transform print:hidden " + (isOpen(s.key) ? "rotate-90" : "")}>
                  <ChevronIcon size={22} />
                </span>
              </button>
            </h3>
            {isOpen(s.key) && (
              <div id={`resumo-${s.key}`} className="border-t border-line px-4 pb-4 pt-3 text-[15px] leading-snug print:border-0 print:pt-0">
                {s.body}
              </div>
            )}
          </section>
        ))}

        {summary && filled.length > 0 && emptyNames.length > 0 && (
          <p className="text-sm text-ink-soft">
            Sem registros de {new Intl.ListFormat("pt-BR", { type: "conjunction" }).format(emptyNames).toLowerCase()} no período.
          </p>
        )}

        {summary && filled.length > 0 && (
          <button type="button" onClick={printAll} className="btn btn-outline h-12 text-base print:hidden">
            Imprimir ou salvar em PDF
          </button>
        )}
      </div>

      {summary && (
        <p className="mt-6 border-t border-line pt-3 text-sm leading-snug text-ink-soft print:mt-auto">
          Informações registradas pela família no Cuidaí Kids, gerado em {civilDm(today)}. Não foram conferidas por um
          profissional de saúde.
        </p>
      )}
    </div>
  );
}
