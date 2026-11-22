"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, CalendarIcon, CheckIcon, TrashIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { ScreenHeader } from "@/components/ScreenHeader";
import { toIso, todayCivil } from "@/lib/age";
import { api, ApiError } from "@/lib/api";
import { cmInput, kgInput, parseCm, parseKg, type GrowthInput, type GrowthMeasurement } from "@/lib/growth";

/** Medição de crescimento: nova (com a criança sugerida) ou, com `measurement`, edição. */
export function GrowthForm({ measurement, initialChildId }: { measurement?: GrowthMeasurement; initialChildId?: number }) {
  const router = useRouter();
  const { state, now } = useReadyApp();
  const kids = state.children;
  const editing = measurement !== undefined;
  const today = toIso(todayCivil(now));

  const [childId, setChildId] = useState<number | null>(
    measurement?.childId ?? (kids.some((k) => k.id === initialChildId) ? initialChildId! : kids.length === 1 ? kids[0].id : null),
  );
  const [date, setDate] = useState(measurement?.measuredOn ?? today);
  const [weight, setWeight] = useState(measurement?.weightG !== undefined ? kgInput(measurement.weightG) : "");
  const [length, setLength] = useState(measurement?.lengthMm !== undefined ? cmInput(measurement.lengthMm) : "");
  const [note, setNote] = useState(measurement?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = "/diario/crescimento";

  async function onSave() {
    setError(null);
    if (childId === null) return setError("Escolha a criança.");
    if (!date) return setError("Escolha a data da medição.");
    const weightG = weight.trim() ? parseKg(weight) : null;
    if (weight.trim() && weightG === null) return setError("Digite o peso em kg, como 9,32.");
    const lengthMm = length.trim() ? parseCm(length) : null;
    if (length.trim() && lengthMm === null) return setError("Digite o comprimento em cm, como 75,1.");
    if (weightG === null && lengthMm === null) return setError("Informe o peso, o comprimento ou os dois.");

    const input: GrowthInput = { childId, measuredOn: date, weightG, lengthMm, note: note.trim() };
    setSaving(true);
    try {
      if (measurement) await api("PUT", `/api/growth/${measurement.id}`, input);
      else await api("POST", "/api/growth", input);
      router.push(back);
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente de novo.");
    }
  }

  async function onDelete() {
    if (!measurement || !window.confirm("Excluir esta medição?")) return;
    setSaving(true);
    try {
      await api("DELETE", `/api/growth/${measurement.id}`);
      router.push(back);
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title={editing ? "Editar medição" : "Nova medição"} back={back} />

      <div className="flex flex-col gap-5">
        <fieldset>
          <legend className="label">
            Para qual criança? <span className="req">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            {kids.map((k) => {
              const on = childId === k.id;
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
          <label htmlFor="data" className="label">
            Data da medição <span className="req">*</span>
          </label>
          <div className="field-wrap">
            <CalendarIcon />
            <input id="data" type="date" className="field" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="peso" className="label">Peso</label>
            <div className="flex items-center gap-2">
              <input
                id="peso"
                className="field tabular-nums"
                inputMode="decimal"
                placeholder="9,32"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <span className="font-bold">kg</span>
            </div>
          </div>
          <div>
            <label htmlFor="comprimento" className="label">Comprimento</label>
            <div className="flex items-center gap-2">
              <input
                id="comprimento"
                className="field tabular-nums"
                inputMode="decimal"
                placeholder="75,1"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              />
              <span className="font-bold">cm</span>
            </div>
          </div>
        </div>
        <p className="-mt-2 text-sm text-ink-soft">Preencha um ou os dois, como estão na caderneta ou no que o pediatra anotou.</p>

        <div>
          <label htmlFor="obs" className="label">Observação</label>
          <textarea
            id="obs"
            className="field h-auto min-h-20 py-3 leading-snug"
            maxLength={500}
            placeholder="Ex.: consulta de rotina, balança da farmácia"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl border border-line bg-coral p-3 text-base font-bold">
            {error}
          </p>
        )}

        <button onClick={onSave} disabled={saving} className="btn btn-primary h-[3.75rem] text-xl">
          <CheckIcon size={24} /> {editing ? "Salvar alterações" : "Salvar medição"}
        </button>
        {editing && (
          <button onClick={onDelete} disabled={saving} className="btn btn-outline h-12 gap-2 text-base text-danger">
            <TrashIcon size={18} /> Excluir medição
          </button>
        )}
      </div>
    </div>
  );
}
