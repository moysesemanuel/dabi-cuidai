"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, BottleIcon, CheckIcon, ChevronIcon, ClockIcon, Mascot, PlusIcon, UserIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { ChildFilter } from "@/components/ChildFilter";
import { ScreenHeader } from "@/components/ScreenHeader";
import type { Child, DoseEvent, Medication } from "@/lib/types";
import { fmtLongDate, fmtTime, greeting, relativeLabel, startOfDay } from "@/lib/format";

interface Row {
  dose: DoseEvent;
  med: Medication;
  child: Child;
}

/** "Hoje às 10:00", "Ontem às 22:00" ou "Amanhã às 02:00". */
function dayTime(ms: number, dayStart: number): string {
  const day = ms < dayStart ? "Ontem" : ms >= dayStart + 86_400_000 ? "Amanhã" : "Hoje";
  return `${day} às ${fmtTime(ms)}`;
}

export function InicioScreen() {
  const { state, now, actions } = useReadyApp();
  const [filter, setFilter] = useState<number | null>(null);
  const dayStart = startOfDay(now);

  const rows = useMemo(() => {
    const medMap = new Map(state.medications.map((m) => [m.id, m]));
    const kidMap = new Map(state.children.map((k) => [k.id, k]));
    const list: Row[] = [];
    for (const dose of state.doses) {
      // Doses de antes da meia-noite só aparecem se ainda estiverem pendentes (atrasadas).
      if (dose.scheduledAt < dayStart && dose.status === "given") continue;
      const med = medMap.get(dose.medicationId);
      const child = med ? kidMap.get(med.childId) : undefined;
      if (med && child) list.push({ dose, med, child });
    }
    return list.sort((a, b) => a.dose.scheduledAt - b.dose.scheduledAt);
  }, [state, dayStart]);

  const visible = rows.filter((r) => filter === null || r.child.id === filter);
  const pending = visible.filter((r) => r.dose.status === "pending");
  const given = visible.filter((r) => r.dose.status === "given");
  const next = pending[0];
  const later = pending.slice(1);
  const hasMeds = state.medications.length > 0;

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title={greeting(now, state.deviceName)}
        action={
          <Link href="/novo" aria-label="Novo remédio" className="appbar-btn">
            <PlusIcon size={26} />
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {!state.deviceName && (
          <Link href="/perfil#voce" className="card flex items-center gap-3 p-3.5 text-[15px] font-semibold">
            <span className="icon-tile">
              <UserIcon size={22} />
            </span>
            <span className="flex-1">Como podemos te chamar? Coloque seu nome no Perfil.</span>
            <ChevronIcon />
          </Link>
        )}
        <ChildFilter label="Ver remédios de:" kids={state.children} value={filter} onChange={setFilter} />

        {!hasMeds ? (
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <Mascot size={150} />
            <h2 className="text-xl font-extrabold">Nenhum remédio ainda</h2>
            <p className="text-ink-soft">Cadastre o primeiro e veja como os horários vão ficar.</p>
            <Link href="/novo" className="btn btn-primary h-14 px-6 text-lg">
              <PlusIcon size={22} /> Novo remédio
            </Link>
          </section>
        ) : (
          <>
            <section aria-labelledby="proxima">
              <h2 id="proxima" className="mb-3 flex items-center gap-1.5 text-[1.35rem] font-extrabold">
                <span className="text-cta" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 4l8 8-8 8" />
                  </svg>
                </span>
                Próxima dose
              </h2>
              {next ? (
                <NextDose row={next} now={now} dayStart={dayStart} onGiven={() => actions.markGiven(next.dose.id)} />
              ) : (
                <div className="card flex items-center gap-4 bg-mint p-4">
                  <Mascot size={88} />
                  <div>
                    <p className="text-lg font-extrabold">Tudo certo por hoje</p>
                    <p className="text-ink-soft">Nenhuma dose pendente agora.</p>
                  </div>
                </div>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              {later.length > 0 && (
                <section aria-labelledby="mais-doses">
                  <h2 id="mais-doses" className="mb-2.5 text-lg font-extrabold">Mais doses de hoje</h2>
                  <ul className="flex flex-col gap-2.5">
                    {later.map((r) => (
                      <PendingRow key={r.dose.id} row={r} now={now} />
                    ))}
                  </ul>
                </section>
              )}

              {given.length > 0 && (
                <section aria-labelledby="ja-dadas">
                  <h2 id="ja-dadas" className="mb-2.5 text-lg font-extrabold">Já dadas</h2>
                  <ul className="flex flex-col gap-2.5">
                    {given.map((r) => (
                      <GivenRow key={r.dose.id} row={r} />
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <p className="text-center text-sm font-semibold text-ink-soft">
              {fmtLongDate(now).replace(/^./, (c) => c.toUpperCase())}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ scheduledAt, now }: { scheduledAt: number; now: number }) {
  const { text, late } = relativeLabel(scheduledAt, now);
  return late ? <span className="badge badge-late">{text[0].toUpperCase() + text.slice(1)}</span> : <span className="badge badge-pending">Pendente</span>;
}

function NextDose({ row, now, dayStart, onGiven }: { row: Row; now: number; dayStart: number; onGiven: () => void }) {
  const { dose, med, child } = row;
  return (
    <div className="card flex flex-col gap-3 bg-brand-soft p-4">
      <div className="flex items-center gap-3">
        <Avatar fill={child.fill} photo={child.photoUrl} size={48} />
        <p className="min-w-0 break-words text-[1.4rem] font-extrabold">{child.name}</p>
      </div>
      <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-3">
        <span className="mt-0.5 text-cta">
          <BottleIcon size={26} />
        </span>
        <div className="min-w-0">
          <p className="break-words text-lg font-extrabold leading-tight">{med.name}</p>
          {med.doseText && <p className="text-[15px] text-ink-soft">Dose prescrita: {med.doseText}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <ClockIcon />
        <span className="flex-1 text-base font-bold tabular-nums">{dayTime(dose.scheduledAt, dayStart)}</span>
        <StatusBadge scheduledAt={dose.scheduledAt} now={now} />
      </div>
      <button onClick={onGiven} className="btn btn-primary h-[3.25rem] w-full text-lg">
        <CheckIcon /> Já dei
      </button>
    </div>
  );
}

function PendingRow({ row, now }: { row: Row; now: number }) {
  const { actions } = useReadyApp();
  const { dose, med, child } = row;
  const { text, late } = relativeLabel(dose.scheduledAt, now);
  return (
    <li className="card flex min-w-0 items-center gap-3 py-2.5 pl-3 pr-2.5">
      <Avatar fill={child.fill} photo={child.photoUrl} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-extrabold">{child.name}</p>
        <p className="truncate text-sm text-ink-soft">{med.name}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="flex items-center gap-1 text-base font-bold tabular-nums">
          <ClockIcon size={18} />
          {fmtTime(dose.scheduledAt)}
        </span>
        {late && <span className="text-xs font-extrabold text-danger">{text}</span>}
      </div>
      <button
        onClick={() => actions.markGiven(dose.id)}
        aria-label={`Marcar ${med.name} das ${fmtTime(dose.scheduledAt)} como dado`}
        className="btn size-10 shrink-0 rounded-full border-brand/30 bg-brand-soft"
      >
        <CheckIcon size={18} />
      </button>
    </li>
  );
}

function GivenRow({ row }: { row: Row }) {
  const { actions } = useReadyApp();
  const { dose, med, child } = row;
  return (
    <li className="card flex min-w-0 items-center gap-3 bg-mint py-2.5 pl-3 pr-2.5">
      <Avatar fill={child.fill} photo={child.photoUrl} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-extrabold">
          {child.name} <span className="font-semibold text-ink-soft">· {fmtTime(dose.scheduledAt)}</span>
        </p>
        <p className="truncate text-sm text-ink-soft">
          {med.name} · dado às {dose.givenAt ? fmtTime(dose.givenAt) : "—"}
        </p>
      </div>
      <button onClick={() => actions.undoGiven(dose.id)} className="btn h-9 shrink-0 bg-white px-3 text-[13px]">
        Desfazer
      </button>
    </li>
  );
}
