"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, CalendarIcon, CheckIcon, ClockIcon, PlusIcon, ThermometerIcon, TrashIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api, ApiError } from "@/lib/api";
import { parseTemperatureInput } from "@/lib/format";
import { COMMON_SYMPTOMS, type HealthEntry, type HealthEntryInput } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Registro do diário: novo (com a criança sugerida) ou, com `entry`, edição de um existente. */
export function HealthEntryForm({ entry, initialChildId }: { entry?: HealthEntry; initialChildId?: number }) {
  const router = useRouter();
  const { state, now } = useReadyApp();
  const kids = state.children;
  const editing = entry !== undefined;

  const start = new Date(entry?.occurredAt ?? now);
  const [childId, setChildId] = useState<number | null>(
    entry?.childId ?? (kids.some((k) => k.id === initialChildId) ? initialChildId! : kids.length === 1 ? kids[0].id : null),
  );
  const [date, setDate] = useState(toDateInput(start));
  const [time, setTime] = useState(toTimeInput(start));
  const [temperature, setTemperature] = useState(
    entry?.temperature !== undefined ? entry.temperature.toFixed(1).replace(".", ",") : "",
  );
  const [symptoms, setSymptoms] = useState<string[]>(entry?.symptoms ?? []);
  const [other, setOther] = useState("");
  const [note, setNote] = useState(entry?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Atalhos comuns mais os sintomas próprios já escolhidos (para aparecerem marcados ao editar).
  const options = [...COMMON_SYMPTOMS, ...symptoms.filter((s) => !(COMMON_SYMPTOMS as readonly string[]).includes(s))];
  const toggle = (s: string) => setSymptoms((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  const addOther = () => {
    const clean = other.trim().replace(/\s+/g, " ");
    if (clean && !symptoms.some((s) => s.toLowerCase() === clean.toLowerCase())) setSymptoms((list) => [...list, clean]);
    setOther("");
  };

  async function onSave() {
    setError(null);
    if (childId === null) return setError("Escolha a criança.");
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return setError("Escolha a data e a hora.");
    const occurredAt = new Date(y, m - 1, d, hh, mm).getTime();

    let temp: number | null = null;
    if (temperature.trim()) {
      temp = parseTemperatureInput(temperature);
      if (temp === null) return setError("Digite a temperatura como 37,8.");
    }
    const pending = other.trim() ? [...symptoms, other.trim()] : symptoms;
    const input: HealthEntryInput = { childId, occurredAt, temperature: temp, symptoms: pending, note: note.trim() };
    if (input.temperature === null && !input.symptoms.length && !input.note) {
      return setError("Registre uma temperatura, um sintoma ou uma anotação.");
    }

    setSaving(true);
    try {
      if (entry) await api("PUT", `/api/diary/${entry.id}`, input);
      else await api("POST", "/api/diary", input);
      router.push("/diario");
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente de novo.");
    }
  }

  async function onDelete() {
    if (!entry || !window.confirm("Excluir este registro do diário?")) return;
    setSaving(true);
    try {
      await api("DELETE", `/api/diary/${entry.id}`);
      router.push("/diario");
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title={editing ? "Editar registro" : "Novo registro"} back="/diario" />

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

        <fieldset>
          <legend className="label">Quando aconteceu?</legend>
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <div className="field-wrap">
              <CalendarIcon />
              <label htmlFor="data" className="sr-only">Data</label>
              <input id="data" type="date" className="field" value={date} max={toDateInput(new Date(now))} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field-wrap w-36">
              <ClockIcon />
              <label htmlFor="hora" className="sr-only">Hora</label>
              <input id="hora" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        </fieldset>

        <div>
          <label htmlFor="temperatura" className="label">Temperatura medida</label>
          <div className="flex items-center gap-2.5">
            <div className="field-wrap w-40">
              <ThermometerIcon />
              <input
                id="temperatura"
                className="field tabular-nums"
                inputMode="decimal"
                placeholder="Ex.: 37,8"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
            <span className="text-lg font-bold">°C</span>
          </div>
        </div>

        <fieldset>
          <legend className="label">Sintomas observados</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={symptoms.includes(s)} onClick={() => toggle(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <label htmlFor="outro" className="sr-only">Outro sintoma</label>
            <input
              id="outro"
              className="field"
              placeholder="Outro sintoma"
              maxLength={40}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOther();
                }
              }}
            />
            <button type="button" onClick={addOther} aria-label="Adicionar sintoma" className="btn btn-outline size-[3.25rem] shrink-0">
              <PlusIcon size={22} />
            </button>
          </div>
        </fieldset>

        <div>
          <label htmlFor="anotacao" className="label">Anotações</label>
          <textarea
            id="anotacao"
            className="field h-auto min-h-28 py-3 leading-snug"
            maxLength={1000}
            placeholder="Ex.: estava mais quietinha, dormiu mal, comeu pouco"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <p className="text-sm leading-snug text-ink-soft">
          O registro fica salvo para a família toda e ajuda a contar ao pediatra o que aconteceu. O app não avalia
          sintomas nem temperatura.
        </p>

        {error && (
          <p role="alert" className="rounded-2xl border border-line bg-coral p-3 text-base font-bold">
            {error}
          </p>
        )}

        <button onClick={onSave} disabled={saving} className="btn btn-primary h-[3.75rem] text-xl">
          <CheckIcon size={24} /> {editing ? "Salvar alterações" : "Salvar registro"}
        </button>
        {editing && (
          <button onClick={onDelete} disabled={saving} className="btn btn-outline h-12 gap-2 text-base text-danger">
            <TrashIcon size={18} /> Excluir registro
          </button>
        )}
      </div>
    </div>
  );
}
