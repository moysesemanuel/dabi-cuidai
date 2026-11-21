"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useReadyApp } from "@/components/AppData";
import { Avatar, BottleIcon, CalendarIcon, EditIcon, Mascot, PlusIcon, TrashIcon } from "@/components/Art";
import { ChildFilter } from "@/components/ChildFilter";
import { ScreenHeader } from "@/components/ScreenHeader";
import { fmtDate } from "@/lib/format";
import { formatClock, previewDay, repeatsDaily } from "@/lib/schedule";
import type { Medication } from "@/lib/types";

/** "10:00", "10:00 e 22:00" ou "06:00, 14:00 e 22:00". */
function listTimes(med: Medication): string {
  const first = new Date(med.firstDoseAt);
  const times = previewDay(first.getHours() * 60 + first.getMinutes(), med.intervalMinutes)
    .map((d) => d.minuteOfDay)
    .sort((a, b) => a - b)
    .map(formatClock);
  return times.length <= 1 ? times.join("") : `${times.slice(0, -1).join(", ")} e ${times[times.length - 1]}`;
}

export function RemediosScreen() {
  const { state, actions } = useReadyApp();
  const [filter, setFilter] = useState<number | null>(null);

  const groups = useMemo(
    () =>
      state.children
        .filter((k) => filter === null || k.id === filter)
        .map((child) => ({
          child,
          meds: state.medications.filter((m) => m.childId === child.id).sort((a, b) => b.createdAt - a.createdAt),
        }))
        .filter((g) => g.meds.length > 0),
    [state, filter],
  );

  async function onRemove(id: number, name: string) {
    if (window.confirm(`Remover ${name} e todas as doses agendadas?`)) {
      await actions.deleteMedication(id);
    }
  }

  const empty = state.medications.length === 0;

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Remédios" />

      <div className="flex flex-col gap-5">
        <ChildFilter label="Filtrar por criança:" kids={state.children} value={filter} onChange={setFilter} />

        {empty && (
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <Mascot size={150} />
            <p className="text-ink-soft">Nenhum remédio cadastrado ainda.</p>
          </section>
        )}

        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          {groups.map(({ child, meds }) => (
            <li key={child.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 bg-brand-soft px-4 py-2.5">
                <Avatar fill={child.fill} photo={child.photoUrl} size={36} />
                <h2 className="min-w-0 break-words text-xl font-extrabold">{child.name}</h2>
              </div>
              <div className="flex flex-col px-4">
                {meds.map((med, i) => {
                  const end = med.firstDoseAt + (med.days - 1) * 86_400_000;
                  return (
                    <Fragment key={med.id}>
                      {i > 0 && <hr className="border-dashed border-line" />}
                      <div className="flex flex-col gap-2.5 py-3.5">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-cta">
                            <BottleIcon size={24} />
                          </span>
                          <div className="min-w-0">
                            <h3 className="break-words text-lg font-extrabold leading-tight">{med.name}</h3>
                            {med.doseText && <p className="text-sm text-ink-soft">Dose prescrita: {med.doseText}</p>}
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-ink-soft">
                            <CalendarIcon size={24} />
                          </span>
                          <div className="min-w-0 text-[15px] leading-snug">
                            <p>
                              <b>Horários:</b> {listTimes(med)}
                              {!repeatsDaily(med.intervalMinutes) && (
                                <span className="text-ink-soft"> (mudam a cada dia)</span>
                              )}
                            </p>
                            <p>
                              <b>Duração:</b> por {med.days} {med.days === 1 ? "dia" : "dias"}
                              <span className="text-ink-soft">
                                {" "}
                                · {fmtDate(med.firstDoseAt)} a {fmtDate(end)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <Link href={`/remedios/${med.id}`} className="btn btn-outline h-10 text-[15px]">
                            <EditIcon /> Editar
                          </Link>
                          <button onClick={() => onRemove(med.id, med.name)} className="btn btn-danger h-10 text-[15px]">
                            <TrashIcon /> Remover
                          </button>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <Link
          href="/novo"
          className="btn btn-brand sticky bottom-[calc(84px+env(safe-area-inset-bottom,0px)+0.75rem)] h-14 text-lg shadow-[0_8px_20px_-8px_rgb(15_110_108/0.7)] lg:static lg:self-start lg:px-8"
        >
          <PlusIcon size={22} /> Adicionar remédio
        </Link>
      </div>
    </div>
  );
}
