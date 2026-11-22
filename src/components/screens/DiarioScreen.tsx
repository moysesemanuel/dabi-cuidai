"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, BottleIcon, ChevronIcon, Mascot, PlusIcon, ThermometerIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { ChildFilter } from "@/components/ChildFilter";
import { DiaryTabs } from "@/components/DiaryTabs";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useDiaryMonth, useDiaryMonths, type DiaryMonth } from "@/hooks/useDiary";
import { fmtDayLabel, fmtTemperature, fmtTime, startOfDay } from "@/lib/format";
import type { Child, DoseHistoryItem, HealthEntry } from "@/lib/types";

type Item = { kind: "entry"; at: number; entry: HealthEntry } | { kind: "dose"; at: number; dose: DoseHistoryItem };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Novembro de 2026". */
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const text = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Diário em sanfona por mês: o índice traz só as contagens, e cada mês carrega os registros quando é aberto.
 * O mês mais recente com algo registrado já vem aberto.
 */
export function DiarioScreen() {
  const { state } = useReadyApp();
  const [filter, setFilter] = useState<number | null>(null);
  const [showMeds, setShowMeds] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { data: months, error } = useDiaryMonths(filter);

  const visible = (months ?? []).filter((m) => m.entries > 0 || (showMeds && m.doses > 0));
  const isOpen = (month: string) => open[month] ?? month === visible[0]?.month;
  const newHref = filter === null ? "/diario/novo" : `/diario/novo?crianca=${filter}`;

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Diário"
        action={
          <Link href={newHref} aria-label="Novo registro" className="appbar-btn">
            <PlusIcon size={26} />
          </Link>
        }
      />

      <div className="flex flex-col gap-5">
        <DiaryTabs current="/diario" />
        <ChildFilter label="Ver registros de:" kids={state.children} value={filter} onChange={setFilter} />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="chip" aria-pressed={showMeds} onClick={() => setShowMeds((v) => !v)}>
            <BottleIcon size={18} />
            Mostrar remédios
          </button>
        </div>

        {error && !months && (
          <p role="alert" className="rounded-2xl border border-line bg-coral p-3 font-bold">
            {error}
          </p>
        )}

        {months && visible.length === 0 && (
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <Mascot size={130} />
            <h2 className="text-xl font-extrabold">Nada registrado ainda</h2>
            <p className="text-ink-soft">Anote temperatura, sintomas ou qualquer coisa que queira lembrar na consulta.</p>
            <Link href={newHref} className="btn btn-primary h-14 px-6 text-lg">
              <PlusIcon size={22} /> Novo registro
            </Link>
          </section>
        )}

        <div className="flex flex-col gap-3">
          {visible.map((m) => (
            <MonthSection
              key={m.month}
              month={m}
              childId={filter}
              showMeds={showMeds}
              open={isOpen(m.month)}
              onToggle={() => setOpen((o) => ({ ...o, [m.month]: !isOpen(m.month) }))}
            />
          ))}
        </div>

        <p className="text-center text-sm leading-snug text-ink-soft">
          Tudo aqui foi registrado pela família. O app guarda e organiza, mas não avalia sintomas: em caso de dúvida,
          procure o pediatra.
        </p>
      </div>
    </div>
  );
}

function MonthSection({
  month,
  childId,
  showMeds,
  open,
  onToggle,
}: {
  month: DiaryMonth;
  childId: number | null;
  showMeds: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const bodyId = `mes-${month.month}`;
  const summary = [
    month.entries > 0 && plural(month.entries, "registro", "registros"),
    showMeds && month.doses > 0 && plural(month.doses, "dose", "doses"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="card overflow-hidden">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="flex-1">
            <span className="block text-lg font-extrabold">{monthLabel(month.month)}</span>
            <span className="block text-sm font-semibold text-ink-soft">{summary}</span>
          </span>
          <span className={"text-ink-soft transition-transform " + (open ? "rotate-90" : "")}>
            <ChevronIcon size={22} />
          </span>
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="border-t border-line px-3 pb-4 pt-3">
          <MonthBody month={month.month} childId={childId} showMeds={showMeds} />
        </div>
      )}
    </section>
  );
}

/** Só existe quando o mês está aberto: é aí que os registros do mês são buscados. */
function MonthBody({ month, childId, showMeds }: { month: string; childId: number | null; showMeds: boolean }) {
  const { state, now } = useReadyApp();
  const { data, error } = useDiaryMonth(childId, month);
  const kids = useMemo(() => new Map(state.children.map((k) => [k.id, k])), [state.children]);
  const manyKids = state.children.length > 1;

  const days = useMemo(() => {
    if (!data) return [];
    // A dose fica no dia em que estava prevista, mesmo se foi dada depois da meia-noite.
    const items: Item[] = [
      ...data.entries.map((entry): Item => ({ kind: "entry", at: entry.occurredAt, entry })),
      ...(showMeds ? data.doses.map((dose): Item => ({ kind: "dose", at: dose.scheduledAt, dose })) : []),
    ].sort((a, b) => b.at - a.at);
    const byDay = new Map<number, Item[]>();
    for (const item of items) {
      const day = startOfDay(item.at);
      byDay.set(day, [...(byDay.get(day) ?? []), item]);
    }
    return [...byDay.entries()];
  }, [data, showMeds]);

  if (error && !data) {
    return (
      <p role="alert" className="text-sm font-bold text-danger">
        {error}
      </p>
    );
  }
  if (!data) return <p className="py-2 text-center text-sm text-ink-soft">Carregando…</p>;

  return (
    <div className="flex flex-col gap-4">
      {days.map(([day, items]) => (
        <section key={day} aria-label={fmtDayLabel(day, now)}>
          <h3 className="mb-2 text-base font-extrabold first-letter:uppercase">{fmtDayLabel(day, now)}</h3>
          <ul className="flex flex-col gap-2">
            {items.map((item) =>
              item.kind === "entry" ? (
                <EntryCard key={`e${item.entry.id}`} entry={item.entry} child={kids.get(item.entry.childId)} showChild={manyKids} />
              ) : (
                <DoseLine key={`d${item.dose.id}`} dose={item.dose} child={kids.get(item.dose.childId)} showChild={manyKids} />
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EntryCard({ entry, child, showChild }: { entry: HealthEntry; child?: Child; showChild: boolean }) {
  return (
    <li>
      <Link href={`/diario/${entry.id}`} className="flex gap-3 rounded-2xl border border-line bg-white p-3">
        {child && <Avatar fill={child.fill} photo={child.photoUrl} size={40} />}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-base font-extrabold">
            {showChild && child ? `${child.name} · ` : ""}
            <span className="tabular-nums">{fmtTime(entry.occurredAt)}</span>
          </p>
          {(entry.temperature !== undefined || entry.symptoms.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {entry.temperature !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-full bg-coral px-2.5 py-1 text-sm font-extrabold tabular-nums">
                  <ThermometerIcon size={16} />
                  {fmtTemperature(entry.temperature)}
                </span>
              )}
              {entry.symptoms.map((s) => (
                <span key={s} className="rounded-full bg-brand-soft px-2.5 py-1 text-sm font-bold">
                  {s}
                </span>
              ))}
            </div>
          )}
          {entry.note && <p className="line-clamp-4 whitespace-pre-line break-words text-[15px] leading-snug">{entry.note}</p>}
        </div>
        <span className="self-center text-ink-soft">
          <ChevronIcon />
        </span>
      </Link>
    </li>
  );
}

/** Dose do histórico, mais discreta que os registros: dada (com o horário) ou que ficou sem "Já dei". */
function DoseLine({ dose, child, showChild }: { dose: DoseHistoryItem; child?: Child; showChild: boolean }) {
  const given = dose.status === "given";
  const late = given && dose.givenAt !== undefined && Math.abs(dose.givenAt - dose.scheduledAt) >= 10 * 60_000;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-3.5 py-2.5">
      <span className={given ? "text-brand" : "text-ink-soft"}>
        <BottleIcon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[15px] font-bold leading-snug">
          {showChild && child ? `${child.name} · ` : ""}
          {dose.medName}
          {dose.doseText && <span className="font-semibold text-ink-soft"> · {dose.doseText}</span>}
        </p>
        <p className="text-sm text-ink-soft">
          {dose.asNeeded
            ? [
                `Dado às ${fmtTime(dose.givenAt ?? dose.scheduledAt)} · se necessário`,
                dose.reason,
                dose.temperature !== undefined ? fmtTemperature(dose.temperature) : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : given
            ? dose.givenAt === undefined
              ? `Dado (previsto às ${fmtTime(dose.scheduledAt)})`
              : late
                ? `Dado às ${fmtTime(dose.givenAt)} · previsto ${fmtTime(dose.scheduledAt)}`
                : `Dado às ${fmtTime(dose.givenAt)}`
            : `Previsto às ${fmtTime(dose.scheduledAt)} · sem "Já dei"`}
          {dose.medicationRemoved && " · remédio removido da lista"}
        </p>
      </div>
    </li>
  );
}
