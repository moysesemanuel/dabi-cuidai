"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useReadyApp } from "@/components/AppData";
import { Avatar, Mascot, PlusIcon } from "@/components/Art";
import { fmtDate, fmtTime } from "@/lib/format";
import { formatInterval, previewDay, totalDoses } from "@/lib/schedule";
import { DayTimeline } from "@/components/TimelinePreview";

export function RemediosScreen() {
  const { state, actions } = useReadyApp();
  const data = useMemo(() => {
    const kidMap = new Map(state.children.map((k) => [k.id, k]));
    return state.medications
      .map((m) => ({ med: m, child: kidMap.get(m.childId) }))
      .sort((a, b) => b.med.createdAt - a.med.createdAt);
  }, [state]);

  async function onRemove(id: number, name: string) {
    if (window.confirm(`Remover ${name} e todas as doses agendadas?`)) {
      await actions.deleteMedication(id);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Remédios</h1>
        <Link href="/novo" aria-label="Novo remédio" className="btn size-[3.1rem] rounded-full bg-sun">
          <PlusIcon />
        </Link>
      </header>

      {data.length === 0 && (
        <section className="sticker flex flex-col items-center gap-3 p-6 text-center">
          <Mascot size={96} />
          <p className="text-ink-soft">Nenhum remédio cadastrado ainda.</p>
          <Link href="/novo" className="btn h-14 bg-mint px-6 text-lg">
            <PlusIcon size={22} /> Novo remédio
          </Link>
        </section>
      )}

      <ul className="grid gap-3 lg:grid-cols-2">
        {data.map(({ med, child }) => {
          const end = med.firstDoseAt + med.days * 86_400_000;
          const first = new Date(med.firstDoseAt);
          const day = previewDay(first.getHours() * 60 + first.getMinutes(), med.intervalMinutes);
          return (
            <li key={med.id} className="sticker flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <Avatar fill={child?.fill ?? "#ddd"} size={40} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold">{med.name}</h2>
                  <p className="text-[15px] text-ink-soft">
                    {child?.name ?? "—"} · a cada {formatInterval(med.intervalMinutes)}
                  </p>
                  {med.doseText && <p className="text-[15px]">Dose: {med.doseText}</p>}
                  <p className="mt-1 text-sm text-ink-soft">
                    {med.days} {med.days === 1 ? "dia" : "dias"} · {totalDoses(med.intervalMinutes, med.days)} doses ·
                    1ª às {fmtTime(med.firstDoseAt)} de {fmtDate(med.firstDoseAt)} · até {fmtDate(end)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Link
                    href={`/remedios/${med.id}`}
                    className="pill bg-sun px-3 py-1.5 text-center text-sm font-semibold"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => onRemove(med.id, med.name)}
                    className="pill bg-blush px-3 py-1.5 text-sm font-semibold"
                  >
                    Remover
                  </button>
                </div>
              </div>
              <DayTimeline doses={day} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
