"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useReadyApp } from "@/components/AppData";
import { ApiError } from "@/lib/api";
import { Avatar, CheckIcon, MinusIcon, PlusIcon } from "@/components/Art";
import { TimelinePreview } from "@/components/TimelinePreview";
import type { Medication } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import {
  MAX_DAYS,
  clampDays,
  formatClock,
  formatInterval,
  parseClock,
  previewDay,
  repeatsDaily,
  toIntervalMinutes,
  totalDoses,
  type OtherDose,
} from "@/lib/schedule";

const INTERVAL_PRESETS = [4, 6, 8, 12];
const DAY_PRESETS = [3, 5, 7, 10];

/** Formulário de remédio: cria um novo ou, com `medication`, edita um já cadastrado. */
export function MedicationForm({ medication }: { medication?: Medication }) {
  const router = useRouter();
  const editing = medication !== undefined;
  const { state, actions } = useReadyApp();
  const kids = state.children;
  const meds = state.medications;

  const first = medication ? new Date(medication.firstDoseAt) : null;
  const [childId, setChildId] = useState<number | null>(medication?.childId ?? null);
  const [name, setName] = useState(medication?.name ?? "");
  const [doseText, setDoseText] = useState(medication?.doseText ?? "");
  const [time, setTime] = useState(first ? formatClock(first.getHours() * 60 + first.getMinutes()) : "08:00");
  const [startTomorrow, setStartTomorrow] = useState(false);
  const [ih, setIh] = useState(medication ? String(Math.floor(medication.intervalMinutes / 60)) : "8");
  const [im, setIm] = useState(medication ? String(medication.intervalMinutes % 60) : "0");
  const [days, setDays] = useState(String(medication?.days ?? 7));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChild = childId ?? kids[0]?.id ?? null;
  const intervalMinutes = toIntervalMinutes(Number(ih), Number(im));
  const daysN = clampDays(Number(days));
  const startMinute = parseClock(time) ?? 8 * 60;

  // Horários dos remédios já cadastrados, para avisar quando um novo cair junto.
  const others: OtherDose[] = useMemo(() => {
    return meds.filter((m) => m.id !== medication?.id).flatMap((m) => {
      const d = new Date(m.firstDoseAt);
      const minute = d.getHours() * 60 + d.getMinutes();
      return previewDay(minute, m.intervalMinutes).map((p) => ({ minuteOfDay: p.minuteOfDay, name: m.name }));
    });
  }, [meds, medication?.id]);

  const preview = useMemo(
    () => previewDay(startMinute, intervalMinutes, others),
    [startMinute, intervalMinutes, others],
  );
  const nightCount = preview.filter((d) => d.night).length;
  const total = totalDoses(intervalMinutes, daysN);
  const perDay = 1440 / intervalMinutes;

  async function onSave() {
    setError(null);
    if (selectedChild === null) return setError("Escolha para quem é o remédio.");
    if (!name.trim()) return setError("Digite o nome do remédio.");
    const parsed = parseClock(time);
    if (parsed === null) return setError("Escolha o horário da primeira dose.");

    // Ao editar, a data de início continua a mesma; só o horário muda.
    const firstDose = new Date(medication ? medication.firstDoseAt : Date.now());
    firstDose.setHours(Math.floor(parsed / 60), parsed % 60, 0, 0);
    if (!editing && startTomorrow) firstDose.setDate(firstDose.getDate() + 1);

    const input = {
      childId: selectedChild,
      name: name.trim(),
      doseText: doseText.trim(),
      intervalMinutes,
      firstDoseAt: firstDose.getTime(),
      days: daysN,
    };

    setSaving(true);
    try {
      if (medication) await actions.updateMedication(medication.id, input);
      else await actions.saveMedication(input);
      router.push(editing ? "/remedios" : "/");
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente de novo.");
    }
  }

  const presetBtn = (active: boolean) =>
    "btn h-[3.25rem] flex-1 text-lg " + (active ? "bg-sun" : "bg-white shadow-none");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href={editing ? "/remedios" : "/"} aria-label="Voltar" className="btn size-12 shrink-0 rounded-full bg-white shadow-[0_3px_0_var(--color-ink)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-[1.75rem] font-bold">{editing ? "Editar remedinho" : "Novo remedinho"}</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-[17px] font-semibold">Para quem?</legend>
            <div className="flex gap-2.5">
              {kids.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setChildId(k.id)}
                  aria-pressed={selectedChild === k.id}
                  className="btn h-14 flex-1 text-[17px]"
                  style={{
                    background: selectedChild === k.id ? k.fill : "#fff",
                    boxShadow: selectedChild === k.id ? undefined : "none",
                  }}
                >
                  <Avatar fill={k.fill} size={32} />
                  {k.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="nome" className="mb-2 block text-[17px] font-semibold">
              Nome do remédio
            </label>
            <input id="nome" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Amoxicilina" />
          </div>

          <div>
            <label htmlFor="dose" className="mb-2 block text-[17px] font-semibold">
              Dose (como está na receita)
            </label>
            <input id="dose" className="field" value={doseText} onChange={(e) => setDoseText(e.target.value)} placeholder="Ex.: conforme a receita" />
          </div>

          <div>
            <label htmlFor="inicio" className="mb-2 block text-[17px] font-semibold">
              Primeira dose às
            </label>
            <div className="flex items-center gap-2.5">
              <input id="inicio" type="time" className="field flex-1 text-[1.4rem] font-semibold" value={time} onChange={(e) => setTime(e.target.value)} />
              {medication ? (
                <p className="text-sm font-medium text-ink-soft">Começou em {fmtDate(medication.firstDoseAt)}</p>
              ) : (
              <div className="flex gap-1.5" role="group" aria-label="Dia da primeira dose">
                <button type="button" aria-pressed={!startTomorrow} onClick={() => setStartTomorrow(false)} className={"btn h-[3.25rem] px-3 text-base " + (!startTomorrow ? "bg-sun" : "bg-white shadow-none")}>
                  Hoje
                </button>
                <button type="button" aria-pressed={startTomorrow} onClick={() => setStartTomorrow(true)} className={"btn h-[3.25rem] px-3 text-base " + (startTomorrow ? "bg-sun" : "bg-white shadow-none")}>
                  Amanhã
                </button>
              </div>
              )}
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-[17px] font-semibold">De quanto em quanto tempo?</legend>
            <div className="flex gap-2">
              {INTERVAL_PRESETS.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={intervalMinutes === h * 60}
                  onClick={() => {
                    setIh(String(h));
                    setIm("0");
                  }}
                  className={presetBtn(intervalMinutes === h * 60)}
                >
                  {h}h
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-[1.1rem] border-[3px] border-dashed border-ink bg-white p-3">
              <p className="text-[15px] text-ink-soft">O médico passou outro tempo? Digite aqui:</p>
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="ih" className="sr-only">Horas</label>
                <input id="ih" type="number" inputMode="numeric" min={0} max={72} className="num" value={ih} onChange={(e) => setIh(e.target.value)} />
                <span className="text-lg font-semibold">h</span>
                <label htmlFor="im" className="sr-only">Minutos</label>
                <input id="im" type="number" inputMode="numeric" min={0} max={59} className="num" value={im} onChange={(e) => setIm(e.target.value)} />
                <span className="text-lg font-semibold">min</span>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[17px] font-semibold">Por quantos dias?</legend>
            <div className="flex gap-2">
              {DAY_PRESETS.map((d) => (
                <button key={d} type="button" aria-pressed={daysN === d} onClick={() => setDays(String(d))} className={presetBtn(daysN === d)}>
                  {d} dias
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-[1.1rem] border-[3px] border-dashed border-ink bg-white p-3">
              <p className="text-[15px] text-ink-soft">Outra duração? Ajuste os dias:</p>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" aria-label="Menos um dia" onClick={() => setDays(String(Math.max(1, daysN - 1)))} className="btn size-[3.25rem] rounded-[0.9rem] bg-blush shadow-[0_3px_0_var(--color-ink)]">
                  <MinusIcon />
                </button>
                <label htmlFor="dias" className="sr-only">Dias de tratamento</label>
                <input id="dias" type="number" inputMode="numeric" min={1} max={MAX_DAYS} className="num" value={days} onChange={(e) => setDays(e.target.value)} />
                <button type="button" aria-label="Mais um dia" onClick={() => setDays(String(Math.min(MAX_DAYS, daysN + 1)))} className="btn size-[3.25rem] rounded-[0.9rem] bg-pale shadow-[0_3px_0_var(--color-ink)]">
                  <PlusIcon size={22} />
                </button>
                <span className="text-lg font-semibold">dias</span>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <section className="sticker p-4" aria-labelledby="como-ficam">
            <h2 id="como-ficam" className="text-[1.4rem] font-bold">Como vão ficar as doses</h2>
            <p className="text-[15px] text-ink-soft">
              A cada {formatInterval(intervalMinutes)} ·{" "}
              {Number.isInteger(perDay) ? perDay : `cerca de ${Math.round(perDay * 10) / 10}`}{" "}
              {perDay === 1 ? "dose" : "doses"} por dia
            </p>

            <TimelinePreview
              doses={preview}
              others={others}
              firstDayLabel={editing ? "1º dia" : startTomorrow ? "Amanhã" : "Hoje"}
            />

            {!repeatsDaily(intervalMinutes) && (
              <p className="mt-1 rounded-2xl border-2 border-ink bg-[#DDF1FF] p-2.5 text-sm leading-snug">
                Com esse intervalo, os horários mudam um pouco a cada dia. O app recalcula tudo para você.
              </p>
            )}
            {nightCount > 0 && (
              <p className="mt-2 rounded-2xl border-2 border-ink bg-lilac p-2.5 text-sm leading-snug">
                {nightCount === 1 ? "1 dose cai na hora de dormir." : `${nightCount} doses caem na hora de dormir.`}{" "}
                Se o médico permitir, mude a primeira dose para encaixar melhor.
              </p>
            )}
            <p className="mt-2 border-t-2 border-dashed border-[#C9D6E6] pt-2.5 text-[17px] font-bold">
              {daysN} {daysN === 1 ? "dia" : "dias"} · {total} {total === 1 ? "dose" : "doses"} no total
            </p>
          </section>

          {error && (
            <p role="alert" className="rounded-2xl border-[2.5px] border-ink bg-blush p-3 text-base font-semibold">
              {error}
            </p>
          )}

          <button onClick={onSave} disabled={saving} className="btn h-[3.75rem] bg-mint text-xl shadow-[0_5px_0_var(--color-ink)]">
            <CheckIcon size={24} /> {editing ? "Salvar alterações" : "Salvar remedinho"}
          </button>
        </div>
      </div>
    </div>
  );
}
