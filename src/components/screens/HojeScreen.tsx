"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, CheckIcon, Mascot, PlusIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import type { Child, DoseEvent, Medication } from "@/lib/types";
import { fmtLongDate, fmtTime, relativeLabel, startOfDay } from "@/lib/format";
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

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-ink-soft">Oi! Hoje é {fmtLongDate(now)}</p>
          <h1 className="text-3xl font-bold leading-tight">Hora do remedinho</h1>
        </div>
        <Link
          href="/novo"
          aria-label="Novo remédio"
          className="btn size-[3.1rem] shrink-0 rounded-full bg-sun"
        >
          <PlusIcon />
        </Link>
      </header>

      {data.kids.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por bebê">
          <button
            onClick={() => setFilter(null)}
            aria-pressed={filter === null}
            className={
              "pill h-11 px-4 text-[15px] font-semibold " +
              (filter === null ? "bg-ink text-white" : "bg-white")
            }
          >
            Todos
          </button>
          {data.kids.map((k) => (
            <button
              key={k.id}
              onClick={() => setFilter(k.id)}
              aria-pressed={filter === k.id}
              className={
                "pill flex h-11 items-center gap-1.5 pl-2 pr-4 text-[15px] font-semibold " +
                (filter === k.id ? "bg-ink text-white" : "bg-white")
              }
            >
              <Avatar fill={k.fill} size={28} />
              {k.name}
            </button>
          ))}
        </div>
      )}

      {!data.hasMeds ? (
        <section className="sticker flex flex-col items-center gap-3 p-6 text-center">
          <Mascot size={96} />
          <h2 className="text-xl font-bold">Nenhum remedinho ainda</h2>
          <p className="text-ink-soft">Cadastre o primeiro e veja como os horários vão ficar.</p>
          <Link href="/novo" className="btn h-14 bg-mint px-6 text-lg">
            <PlusIcon size={22} /> Novo remédio
          </Link>
        </section>
      ) : (
        <>
          {next ? (
            <section className="sticker flex flex-col gap-3 bg-sun p-4" style={{ background: "var(--color-sun)" }}>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold tracking-wider text-[#3d3200]">PRÓXIMA DOSE</p>
                  <h2 className="truncate text-[1.7rem] font-bold leading-tight">{next.med.name}</h2>
                  <p className="text-[15px] font-medium">
                    {next.child.name} · a cada {formatInterval(next.med.intervalMinutes)}
                  </p>
                  {next.med.doseText && <p className="text-[15px]">Dose: {next.med.doseText}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="pill bg-white px-3.5 text-2xl font-bold tabular-nums">
                      {fmtTime(next.dose.scheduledAt)}
                    </span>
                    <StatusBadge scheduledAt={next.dose.scheduledAt} now={now} />
                  </div>
                </div>
                <Mascot />
              </div>
              <button onClick={() => actions.markGiven(next.dose.id)} className="btn h-[3.25rem] w-full bg-mint text-xl">
                <CheckIcon /> Já dei!
              </button>
            </section>
          ) : (
            <section className="sticker flex items-center gap-3 bg-pale p-4" style={{ background: "var(--color-pale)" }}>
              <Mascot />
              <div>
                <h2 className="text-2xl font-bold">Tudo certo por hoje!</h2>
                <p className="text-ink-soft">Nenhuma dose pendente agora.</p>
              </div>
            </section>
          )}

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            {later.length > 0 && (
              <section aria-labelledby="mais-tarde">
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 id="mais-tarde" className="text-xl font-bold">
                    Mais tarde
                  </h2>
                  <span className="text-sm font-medium text-ink-soft">
                    {givenToday} de {todays.length} já dadas
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {later.map((r) => (
                    <PendingRow key={r.dose.id} row={r} />
                  ))}
                </ul>
              </section>
            )}

            {given.length > 0 && (
              <section aria-labelledby="ja-dadas">
                <h2 id="ja-dadas" className="mb-2.5 text-xl font-bold">
                  Já dadas
                </h2>
                <ul className="flex flex-col gap-2">
                  {given.map((r) => (
                    <GivenRow key={r.dose.id} row={r} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ scheduledAt, now }: { scheduledAt: number; now: number }) {
  const { text, late } = relativeLabel(scheduledAt, now);
  return (
    <span className={"pill px-2.5 py-0.5 text-[13px] font-semibold " + (late ? "bg-coral" : "bg-white")}>
      {text}
    </span>
  );
}

function PendingRow({ row }: { row: Row }) {
  const { actions } = useReadyApp();
  const { dose, med, child } = row;
  return (
    <li className="flex items-center gap-2.5">
      <div className="pill flex h-10 w-16 shrink-0 items-center justify-center bg-white text-base font-semibold tabular-nums">
        {fmtTime(dose.scheduledAt)}
      </div>
      <div className="flex min-h-[3.4rem] min-w-0 flex-1 items-center gap-2.5 rounded-[1.1rem] border-[2.5px] border-ink bg-white px-3 shadow-[0_3px_0_var(--color-ink)]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{med.name}</p>
          <p className="truncate text-[13px] text-ink-soft">
            {child.name} · a cada {formatInterval(med.intervalMinutes)}
          </p>
        </div>
        <Avatar fill={child.fill} size={30} />
        <button
          onClick={() => actions.markGiven(dose.id)}
          aria-label={`Marcar ${med.name} das ${fmtTime(dose.scheduledAt)} como dado`}
          className="btn size-10 shrink-0 rounded-full bg-pale shadow-[0_2px_0_var(--color-ink)]"
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
    <li className="flex items-center gap-2.5">
      <div className="pill flex h-10 w-16 shrink-0 items-center justify-center bg-[#EEF3F8] text-base font-semibold tabular-nums">
        {fmtTime(dose.scheduledAt)}
      </div>
      <div className="flex min-h-[3.4rem] min-w-0 flex-1 items-center gap-2.5 rounded-[1.1rem] border-[2.5px] border-ink bg-pale px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{med.name}</p>
          <p className="truncate text-[13px] text-ink-soft">
            {child.name} · dado às {dose.givenAt ? fmtTime(dose.givenAt) : "—"}
          </p>
        </div>
        <button onClick={() => actions.undoGiven(dose.id)} className="pill bg-white px-3 py-1 text-[13px] font-semibold">
          Desfazer
        </button>
      </div>
    </li>
  );
}
