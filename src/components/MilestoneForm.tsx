"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, CheckIcon, TrashIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { ScreenHeader } from "@/components/ScreenHeader";
import { parseCivilDate, toIso, todayCivil } from "@/lib/age";
import { api, ApiError } from "@/lib/api";
import {
  CATEGORIES,
  TITLE_SUGGESTIONS,
  type DatePrecision,
  type Milestone,
  type MilestoneCategory,
  type MilestoneInput,
} from "@/lib/milestones";

const PRECISIONS: { value: DatePrecision; label: string }[] = [
  { value: "day", label: "Data exata" },
  { value: "month", label: "Só o mês" },
  { value: "about", label: "Por volta de" },
];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Marco do desenvolvimento: novo (com a criança sugerida) ou, com `milestone`, edição. */
export function MilestoneForm({ milestone, initialChildId }: { milestone?: Milestone; initialChildId?: number }) {
  const router = useRouter();
  const { state, now } = useReadyApp();
  const kids = state.children;
  const editing = milestone !== undefined;
  const today = todayCivil(now);
  const start = (milestone && parseCivilDate(milestone.happenedOn)) || today;

  const [childId, setChildId] = useState<number | null>(
    milestone?.childId ?? (kids.some((k) => k.id === initialChildId) ? initialChildId! : kids.length === 1 ? kids[0].id : null),
  );
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [precision, setPrecision] = useState<DatePrecision>(milestone?.precision ?? "day");
  const [day, setDay] = useState(toIso(start));
  const [month, setMonth] = useState(start.m);
  const [year, setYear] = useState(start.y);
  const [category, setCategory] = useState<MilestoneCategory | null>(milestone?.category ?? null);
  const [note, setNote] = useState(milestone?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = "/diario/marcos";

  // Anos para "Só o mês": do nascimento (ou 6 anos atrás) até o atual.
  const child = kids.find((k) => k.id === childId);
  const firstYear = (child?.birthDate && parseCivilDate(child.birthDate)?.y) || today.y - 6;
  const years = Array.from({ length: today.y - Math.min(firstYear, year) + 1 }, (_, i) => today.y - i);

  async function onSave() {
    setError(null);
    if (childId === null) return setError("Escolha a criança.");
    if (!title.trim()) return setError("Escreva o que aconteceu.");
    const happenedOn = precision === "day" ? day : `${year}-${String(month).padStart(2, "0")}-01`;
    if (!parseCivilDate(happenedOn)) return setError("Escolha a data.");
    const input: MilestoneInput = { childId, title: title.trim(), happenedOn, precision, category, note: note.trim() };
    setSaving(true);
    try {
      if (milestone) await api("PUT", `/api/milestones/${milestone.id}`, input);
      else await api("POST", "/api/milestones", input);
      router.push(back);
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente de novo.");
    }
  }

  async function onDelete() {
    if (!milestone || !window.confirm("Excluir este marco?")) return;
    setSaving(true);
    try {
      await api("DELETE", `/api/milestones/${milestone.id}`);
      router.push(back);
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title={editing ? "Editar marco" : "Novo marco"} back={back} />

      <div className="flex flex-col gap-5">
        <fieldset>
          <legend className="label">
            De qual criança? <span className="req">*</span>
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
          <label htmlFor="titulo" className="label">
            O que aconteceu? <span className="req">*</span>
          </label>
          <input
            id="titulo"
            className="field"
            maxLength={120}
            placeholder="Ex.: primeiros passos"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {!editing && (
            <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Sugestões">
              {TITLE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTitle(s)}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-bold"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <fieldset>
          <legend className="label">Quando?</legend>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-field p-1" role="group">
            {PRECISIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={precision === p.value}
                onClick={() => setPrecision(p.value)}
                className={
                  "h-10 rounded-xl text-sm font-extrabold " +
                  (precision === p.value ? "bg-white text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]" : "text-ink-soft")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2.5">
            {precision === "day" ? (
              <>
                <label htmlFor="dia" className="sr-only">Data</label>
                <input id="dia" type="date" className="field" value={day} max={toIso(today)} onChange={(e) => setDay(e.target.value)} />
              </>
            ) : (
              <div className="grid grid-cols-[1fr_auto] gap-2.5">
                <label htmlFor="mes" className="sr-only">Mês</label>
                <select id="mes" className="field" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <label htmlFor="ano" className="sr-only">Ano</label>
                <select id="ano" className="field w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Tipo (opcional)</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                className="chip"
                aria-pressed={category === c.value}
                onClick={() => setCategory((cur) => (cur === c.value ? null : c.value))}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="obs" className="label">Observação</label>
          <textarea
            id="obs"
            className="field h-auto min-h-20 py-3 leading-snug"
            maxLength={500}
            placeholder="Ex.: foi do sofá até a mesa, na casa da avó"
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
          <CheckIcon size={24} /> {editing ? "Salvar alterações" : "Salvar marco"}
        </button>
        {editing && (
          <button onClick={onDelete} disabled={saving} className="btn btn-outline h-12 gap-2 text-base text-danger">
            <TrashIcon size={18} /> Excluir marco
          </button>
        )}
      </div>
    </div>
  );
}
