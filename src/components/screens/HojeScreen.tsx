"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, CheckIcon, Mascot, PlusIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import type { Child, DoseEvent, Medication } from "@/lib/types";
import { fmtLongDate, fmtTime, relativeLabel, startOfDay } from "@/lib/format";

function greeting(ms: number): string {
  const h = new Date(ms).getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
import { formatInterval } from "@/lib/schedule";

interface Row {
  dose: DoseEvent;
  med: Medication;
  child: Child;
}

export function HojeScreen() {
  const { state, now, actions } = useReadyApp();
  const [filter, setFilter] = useState<number | null>(null);
  const dayStart = startOfDay(now);

  const data = useMemo(() => {
    const medMap = new Map(state.medications.map((m) => [m.id, m]));
    const kidMap = new Map(state.children.map((k) => [k.id, k]));
    const rows: Row[] = [];
    for (const dose of state.doses) {
      // Doses de antes da meia-noite só aparecem se ainda estiverem pendentes (atrasadas).
      if (dose.scheduledAt < dayStart && dose.status === "given") continue;
      const med = medMap.get(dose.medicationId);
      const child = med ? kidMap.get(med.childId) : undefined;
      if (med && child) rows.push({ dose, med, child });
    }
    rows.sort((a, b) => a.dose.scheduledAt - b.dose.scheduledAt);
    return { rows, kids: state.children, hasMeds: state.medications.length > 0 };
  }, [state, dayStart]);

  const visible = data.rows.filter((r) => filter === null || r.child.id === filter);
  const pending = visible.filter((r) => r.dose.status === "pending");
  const given = visible.filter((r) => r.dose.status === "given");
  const next = pending[0];
  const later = pending.slice(1);
  const todays = visible.filter((r) => r.dose.scheduledAt >= dayStart);
  const givenToday = todays.filter((r) => r.dose.status === "given").length;
  const focus = data.kids.find((k) => k.id === filter);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        {focus ? <Avatar fill={focus.fill} size={48} /> : <Mascot size={52} />}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-ink-soft">{greeting(now)},</p>
          <h1 className="break-words text-[1.4rem] font-medium leading-tight">
            {focus ? `como está ${focus.name} hoje?` : "hora do remedinho"}
          </h1>
        </div>
        <Link href="/novo" aria-label="Novo remédio" className="fab shrink-0">
          <PlusIcon />
        </Link>
      </header>

      {data.kids.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por bebê">
          <button onClick={() => setFilter(null)} aria-pressed={filter === null} className="chip">
            Todos
            <span className="rounded-full bg-track px-1.5 text-xs">{data.kids.length}</span>
          </button>
          {data.kids.map((k) => (
            <button key={k.id} onClick={() => setFilter(k.id)} aria-pressed={filter === k.id} className="chip pl-1.5">
              <Avatar fill={k.fill} size={26} />
              {k.name}
            </button>
          ))}
        </div>
      )}

      {!data.hasMeds ? (
        <section className="card flex flex-col items-center gap-3 p-6 text-center">
          <Mascot size={96} />
          <h2 className="text-xl font-semibold">Nenhum remedinho ainda</h2>
          <p className="text-ink-soft">Cadastre o primeiro e veja como os horários vão ficar.</p>
          <Link href="/novo" className="btn btn-primary h-14 px-6 text-lg">
            <PlusIcon size={22} /> Novo remédio
          </Link>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3" aria-label="Resumo de hoje">
            <div className="card flex items-center gap-3 p-3" style={{ background: "var(--c-cream)" }}>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-semibold tabular-nums">
                {todays.length - givenToday}
              </span>
              <span className="text-[15px] font-medium leading-tight">
                para dar
                <br />
                hoje
              </span>
            </div>
            <div className="card flex items-center gap-3 p-3" style={{ background: "var(--c-pale)" }}>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-semibold tabular-nums">
                {givenToday}
              </span>
              <span className="text-[15px] font-medium leading-tight">
                já
                <br />
                dadas
              </span>
            </div>
          </section>

          {next ? (
            <section
              className="card flex flex-col gap-3 p-4"
              style={{ background: "linear-gradient(115deg, var(--c-sun), var(--c-surface) 78%)" }}
            >
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-ink-soft">Próxima dose</p>
                  <h2 className="break-words text-[1.5rem] font-semibold leading-tight">{next.med.name}</h2>
                  <p className="text-[15px] font-medium">
                    {next.child.name} · a cada {formatInterval(next.med.intervalMinutes)}
                  </p>
                  {next.med.doseText && <p className="text-[15px]">Dose: {next.med.doseText}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-3xl font-semibold tabular-nums">{fmtTime(next.dose.scheduledAt)}</span>
                    <StatusBadge scheduledAt={next.dose.scheduledAt} now={now} />
                  </div>
                </div>
                <Mascot size={72} />
              </div>
              <button onClick={() => actions.markGiven(next.dose.id)} className="btn btn-primary h-[3.25rem] w-full text-lg">
                <CheckIcon /> Já dei
              </button>
            </section>
          ) : (
            <section className="card flex items-center gap-3 p-4" style={{ background: "var(--c-pale)" }}>
              <Mascot size={64} />
              <div>
                <h2 className="text-xl font-semibold">Tudo certo por hoje</h2>
                <p className="text-ink-soft">Nenhuma dose pendente agora.</p>
              </div>
            </section>
          )}

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            {later.length > 0 && (
              <section aria-labelledby="mais-tarde">
                <SectionHead id="mais-tarde" title="Mais tarde" tone="var(--c-sky)" count={later.length} />
                <ul className="flex flex-col gap-2">
                  {later.map((r) => (
                    <PendingRow key={r.dose.id} row={r} now={now} />
                  ))}
                </ul>
              </section>
            )}

            {given.length > 0 && (
              <section aria-labelledby="ja-dadas">
                <SectionHead id="ja-dadas" title="Já dadas" tone="var(--c-mint)" count={given.length} />
                <ul className="flex flex-col gap-2">
                  {given.map((r) => (
                    <GivenRow key={r.dose.id} row={r} />
                  ))}
                </ul>
              </section>
            )}
          </div>

          <p className="text-center text-sm text-ink-soft">{fmtLongDate(now)}</p>
        </>
      )}
    </div>
  );
}

function SectionHead({ id, title, tone, count }: { id: string; title: string; tone: string; count: number }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <span className="size-7 rounded-lg" style={{ background: tone }} aria-hidden="true" />
      <h2 id={id} className="flex-1 text-lg font-semibold">
        {title}
      </h2>
      <span className="text-sm text-ink-soft">{count === 1 ? "1 dose" : `${count} doses`}</span>
    </div>
  );
}

function StatusBadge({ scheduledAt, now }: { scheduledAt: number; now: number }) {
  const { text, late } = relativeLabel(scheduledAt, now);
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold" style={{ background: late ? "var(--c-coral)" : "var(--c-surface)" }}>
      {text}
    </span>
  );
}

/** Linha do tempo: hora à esquerda, cartão à direita com a cor do bebê na lateral. */
function PendingRow({ row, now }: { row: Row; now: number }) {
  const { actions } = useReadyApp();
  const { dose, med, child } = row;
  const { text, late } = relativeLabel(dose.scheduledAt, now);
  return (
    <li className="grid grid-cols-[3.75rem_1fr] items-center gap-2">
      <div className="text-center">
        <p className="text-base font-semibold tabular-nums">{fmtTime(dose.scheduledAt)}</p>
        <p className={"text-[11px] leading-tight " + (late ? "font-semibold" : "text-ink-soft")}>{text}</p>
      </div>
      <div
        className="card flex min-h-[3.6rem] min-w-0 items-center gap-2.5 py-2 pl-3 pr-2.5"
        style={{ borderLeft: `5px solid ${child.fill}` }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{med.name}</p>
          <p className="truncate text-[13px] text-ink-soft">
            {child.name} · a cada {formatInterval(med.intervalMinutes)}
          </p>
        </div>
        <button
          onClick={() => actions.markGiven(dose.id)}
          aria-label={`Marcar ${med.name} das ${fmtTime(dose.scheduledAt)} como dado`}
          className="btn size-10 shrink-0 rounded-full bg-pale"
        >
          <CheckIcon size={18} />
        </button>
      </div>
    </li>
  );
}

function GivenRow({ row }: { row: Row }) {
  const { actions } = useReadyApp();
  const { dose, med, child } = row;
  return (
    <li className="grid grid-cols-[3.75rem_1fr] items-center gap-2">
      <p className="text-center text-base font-semibold tabular-nums text-ink-soft">{fmtTime(dose.scheduledAt)}</p>
      <div
        className="card flex min-h-[3.6rem] min-w-0 items-center gap-2.5 py-2 pl-3 pr-2.5"
        style={{ borderLeft: `5px solid ${child.fill}`, background: "var(--c-pale)" }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{med.name}</p>
          <p className="truncate text-[13px] text-ink-soft">
            {child.name} · dado às {dose.givenAt ? fmtTime(dose.givenAt) : "—"}
          </p>
        </div>
        <button onClick={() => actions.undoGiven(dose.id)} className="btn h-9 bg-white px-3 text-[13px]">
          Desfazer
        </button>
      </div>
    </li>
  );
}
