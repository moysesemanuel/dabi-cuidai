"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useReadyApp } from "@/components/AppData";
import { ApiError } from "@/lib/api";
import {
  Avatar,
  BottleIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
  MinusIcon,
  NoteIcon,
  PlusIcon,
  RepeatIcon,
} from "@/components/Art";
import { ScreenHeader } from "@/components/ScreenHeader";
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

/** Intervalos e durações mais comuns nas receitas; outros valores são digitados à mão. */
const INTERVAL_PRESETS = [4, 6, 8, 12, 24];
const DAY_PRESETS = [1, 3, 5, 7, 10, 14];

/** Formulário de remédio: cria um novo ou, com `medication`, edita um já cadastrado. */
export function MedicationForm({ medication, top }: { medication?: Medication; top?: React.ReactNode }) {
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
  const [intervalMode, setIntervalMode] = useState<"preset" | "custom">("preset");
  const [daysMode, setDaysMode] = useState<"preset" | "custom">("preset");
  const [doseHelp, setDoseHelp] = useState(false);
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
    if (!doseText.trim()) return setError("Digite a dose como está na receita.");
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

  const customInterval = intervalMode === "custom";
  const customDays = daysMode === "custom";

  return (
    <div className="flex flex-col">
      <ScreenHeader title={editing ? "Editar remédio" : "Novo remédio"} back={editing ? "/remedios" : "/"} />
      {top}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="label">
              Para qual criança é o remédio? <span className="req">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              {kids.map((k) => {
                const on = selectedChild === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setChildId(k.id)}
                    aria-pressed={on}
                    className={
                      "flex h-14 min-w-0 items-center gap-2.5 rounded-2xl border-[1.5px] px-3 text-left text-[17px] font-extrabold " +
                      (on ? "border-brand bg-brand-soft" : "border-line bg-white")
                    }
                  >
                    <Avatar fill={k.fill} photo={k.photoUrl} size={34} />
                    <span className="min-w-0 flex-1 truncate">{k.name}</span>
                    {on && (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[#ffffff]">
                        <CheckIcon size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="nome" className="label">
              Nome do remédio <span className="req">*</span>
            </label>
            <div className="field-wrap">
              <BottleIcon />
              <input id="nome" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Xarope Infantil" />
            </div>
          </div>

          <div>
            <label htmlFor="dose" className="label">
              Dose prescrita <span className="req">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="field-wrap flex-1">
                <NoteIcon />
                <input id="dose" className="field" value={doseText} onChange={(e) => setDoseText(e.target.value)} placeholder="Ex.: conforme orientação" />
              </div>
              <button
                type="button"
                onClick={() => setDoseHelp((v) => !v)}
                aria-expanded={doseHelp}
                aria-controls="dose-ajuda"
                aria-label="Sobre a dose"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-soft"
              >
                <InfoIcon />
              </button>
            </div>
            {doseHelp && (
              <p id="dose-ajuda" className="mt-2 rounded-2xl bg-brand-soft p-3 text-sm leading-snug">
                Escreva a dose exatamente como está na receita (por exemplo, &quot;5 ml&quot; ou &quot;1 gota em cada narina&quot;).
                O app não calcula nem sugere doses.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="inicio" className="label">
              Horário da primeira dose <span className="req">*</span>
            </label>
            <div className="flex items-center gap-2.5">
              <div className="field-wrap flex-1">
                <ClockIcon />
                <input id="inicio" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              {medication ? (
                <p className="text-sm font-semibold text-ink-soft">Começou em {fmtDate(medication.firstDoseAt)}</p>
              ) : (
                <div className="flex gap-1 rounded-2xl bg-track p-1" role="group" aria-label="Dia da primeira dose">
                  {[false, true].map((tomorrow) => (
                    <button
                      key={String(tomorrow)}
                      type="button"
                      aria-pressed={startTomorrow === tomorrow}
                      onClick={() => setStartTomorrow(tomorrow)}
                      className={
                        "h-11 rounded-xl px-3 text-[15px] font-bold " +
                        (startTomorrow === tomorrow ? "bg-brand text-[#ffffff]" : "text-ink-soft")
                      }
                    >
                      {tomorrow ? "Amanhã" : "Hoje"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="intervalo" className="label whitespace-nowrap text-[13px]">
                Intervalo entre doses <span className="req">*</span>
              </label>
              <div className="field-wrap">
                <RepeatIcon />
                <select
                  id="intervalo"
                  className="field text-[15px]"
                  value={customInterval ? "custom" : String(intervalMinutes)}
                  onChange={(e) => {
                    if (e.target.value === "custom") return setIntervalMode("custom");
                    const min = Number(e.target.value);
                    setIntervalMode("preset");
                    setIh(String(Math.floor(min / 60)));
                    setIm(String(min % 60));
                  }}
                >
                  {!customInterval && !INTERVAL_PRESETS.includes(intervalMinutes / 60) && (
                    <option value={String(intervalMinutes)}>a cada {formatInterval(intervalMinutes)}</option>
                  )}
                  {INTERVAL_PRESETS.map((h) => (
                    <option key={h} value={String(h * 60)}>
                      a cada {h} h
                    </option>
                  ))}
                  <option value="custom">Outro intervalo…</option>
                </select>
              </div>
            </div>
            <div className="min-w-0">
              <label htmlFor="duracao" className="label whitespace-nowrap text-[13px]">
                Duração <span className="req">*</span>
              </label>
              <div className="field-wrap">
                <CalendarIcon />
                <select
                  id="duracao"
                  className="field text-[15px]"
                  value={customDays ? "custom" : String(daysN)}
                  onChange={(e) => {
                    if (e.target.value === "custom") return setDaysMode("custom");
                    setDaysMode("preset");
                    setDays(e.target.value);
                  }}
                >
                  {!customDays && !DAY_PRESETS.includes(daysN) && (
                    <option value={String(daysN)}>por {daysN} {daysN === 1 ? "dia" : "dias"}</option>
                  )}
                  {DAY_PRESETS.map((d) => (
                    <option key={d} value={String(d)}>
                      por {d} {d === 1 ? "dia" : "dias"}
                    </option>
                  ))}
                  <option value="custom">Outra duração…</option>
                </select>
              </div>
            </div>
          </div>

          {customInterval && (
            <div className="rounded-2xl border-[1.5px] border-dashed border-line bg-white p-3">
              <p className="text-[15px] text-ink-soft">O médico passou outro intervalo? Digite aqui:</p>
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="ih" className="sr-only">Horas</label>
                <input id="ih" type="number" inputMode="numeric" min={0} max={72} className="num" value={ih} onChange={(e) => setIh(e.target.value)} />
                <span className="text-lg font-bold">h</span>
                <label htmlFor="im" className="sr-only">Minutos</label>
                <input id="im" type="number" inputMode="numeric" min={0} max={59} className="num" value={im} onChange={(e) => setIm(e.target.value)} />
                <span className="text-lg font-bold">min</span>
              </div>
            </div>
          )}

          {customDays && (
            <div className="rounded-2xl border-[1.5px] border-dashed border-line bg-white p-3">
              <p className="text-[15px] text-ink-soft">Por quantos dias?</p>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" aria-label="Menos um dia" onClick={() => setDays(String(Math.max(1, daysN - 1)))} className="btn size-[3.25rem] rounded-[0.9rem] bg-coral">
                  <MinusIcon />
                </button>
                <label htmlFor="dias" className="sr-only">Dias de tratamento</label>
                <input id="dias" type="number" inputMode="numeric" min={1} max={MAX_DAYS} className="num" value={days} onChange={(e) => setDays(e.target.value)} />
                <button type="button" aria-label="Mais um dia" onClick={() => setDays(String(Math.min(MAX_DAYS, daysN + 1)))} className="btn size-[3.25rem] rounded-[0.9rem] bg-mint">
                  <PlusIcon size={22} />
                </button>
                <span className="text-lg font-bold">dias</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <section className="card p-4" aria-labelledby="como-ficam">
            <h2 id="como-ficam" className="text-[1.25rem] font-extrabold">Como vão ficar as doses</h2>
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
              <p className="mt-1 rounded-2xl border border-line bg-brand-soft p-2.5 text-sm leading-snug">
                Com esse intervalo, os horários mudam um pouco a cada dia. O app recalcula tudo para você.
              </p>
            )}
            {nightCount > 0 && (
              <p className="mt-2 rounded-2xl border border-line bg-lilac p-2.5 text-sm leading-snug">
                {nightCount === 1 ? "1 dose cai na hora de dormir." : `${nightCount} doses caem na hora de dormir.`}{" "}
                Se o médico permitir, mude a primeira dose para encaixar melhor.
              </p>
            )}
            <p className="mt-2 border-t border-dashed border-line pt-2.5 text-[17px] font-extrabold">
              {daysN} {daysN === 1 ? "dia" : "dias"} · {total} {total === 1 ? "dose" : "doses"} no total
            </p>
          </section>

          {error && (
            <p role="alert" className="rounded-2xl border border-line bg-coral p-3 text-base font-bold">
              {error}
            </p>
          )}

          <button onClick={onSave} disabled={saving} className="btn btn-primary h-[3.75rem] text-xl">
            <CheckIcon size={24} /> {editing ? "Salvar alterações" : "Salvar remédio"}
          </button>
        </div>
      </div>
    </div>
  );
}
