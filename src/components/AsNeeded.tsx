"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { Avatar, BottleIcon, CalendarIcon, CheckIcon, ClockIcon, InfoIcon, NoteIcon, ThermometerIcon, TrashIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePolled } from "@/hooks/usePolled";
import { api, ApiError } from "@/lib/api";
import { fmtDayLabel, fmtTemperature, fmtTime, parseTemperatureInput } from "@/lib/format";
import { AS_NEEDED_REASONS, type AsNeededDose, type AsNeededMedication } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "Hoje às 14:30", "Ontem às 22:00", "sexta, 14 de novembro às 09:00". */
export function whenText(ms: number, now: number): string {
  const day = fmtDayLabel(ms, now);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} às ${fmtTime(ms)}`;
}

/** Botões "Horário fixo / Se necessário" do cadastro de remédio. */
export function MedicationKindSwitch({ value, onChange }: { value: "scheduled" | "as_needed"; onChange: (v: "scheduled" | "as_needed") => void }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-field p-1" role="group" aria-label="Tipo de remédio">
      {(["scheduled", "as_needed"] as const).map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={
            "h-11 rounded-xl text-[15px] font-extrabold " +
            (value === k ? "bg-white text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]" : "text-ink-soft")
          }
        >
          {k === "scheduled" ? "Horário fixo" : "Se necessário"}
        </button>
      ))}
    </div>
  );
}

/** Cadastro ou edição de um remédio "se necessário": sem horários; a orientação da receita fica como texto. */
export function AsNeededForm({ medication, top }: { medication?: AsNeededMedication; top?: ReactNode }) {
  const router = useRouter();
  const { state, actions } = useReadyApp();
  const kids = state.children;
  const editing = medication !== undefined;
  const [childId, setChildId] = useState<number | null>(medication?.childId ?? (kids.length === 1 ? kids[0].id : null));
  const [name, setName] = useState(medication?.name ?? "");
  const [doseText, setDoseText] = useState(medication?.doseText ?? "");
  const [instructions, setInstructions] = useState(medication?.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    if (childId === null) return setError("Escolha para quem é o remédio.");
    if (!name.trim()) return setError("Digite o nome do remédio.");
    if (!doseText.trim()) return setError("Digite a dose como está na receita.");
    const input = { childId, name: name.trim(), doseText: doseText.trim(), instructions: instructions.trim() };
    setSaving(true);
    try {
      if (medication) await actions.updateAsNeeded(medication.id, input);
      else await actions.saveAsNeeded(input);
      router.push("/remedios");
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente de novo.");
    }
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title={editing ? "Editar remédio" : "Novo remédio"} back={editing ? "/remedios" : "/"} />
      {top}
      <div className="flex flex-col gap-5">
        <p className="flex gap-2 rounded-2xl bg-brand-soft p-3 text-[15px] leading-snug">
          <span className="mt-0.5 text-brand">
            <InfoIcon size={18} />
          </span>
          <span>
            Para remédios que a receita manda dar só quando precisar (febre, dor…). Não tem horários nem avisos: você
            registra cada vez que der, e o app guarda o histórico.
          </span>
        </p>

        <fieldset>
          <legend className="label">
            Para qual criança é o remédio? <span className="req">*</span>
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
          <label htmlFor="nome" className="label">
            Nome do remédio <span className="req">*</span>
          </label>
          <div className="field-wrap">
            <BottleIcon />
            <input id="nome" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Paracetamol gotas" />
          </div>
        </div>

        <div>
          <label htmlFor="dose" className="label">
            Dose prescrita <span className="req">*</span>
          </label>
          <div className="field-wrap">
            <NoteIcon />
            <input id="dose" className="field" value={doseText} onChange={(e) => setDoseText(e.target.value)} placeholder="Ex.: 10 gotas" />
          </div>
        </div>

        <div>
          <label htmlFor="orientacao" className="label">Orientação da receita</label>
          <textarea
            id="orientacao"
            className="field h-auto min-h-20 py-3 leading-snug"
            maxLength={300}
            placeholder="Ex.: se febre acima de 37,8 °C, no mínimo 6 horas entre as doses"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <p className="mt-1.5 text-sm text-ink-soft">
            Copie como está na receita ou como o pediatra orientou. O app só mostra este texto; não calcula nem decide
            quando dar.
          </p>
        </div>

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
  );
}

/** Registrar uma dose de remédio "se necessário": quando, motivo e temperatura; abaixo, as últimas registradas. */
export function RegisterAsNeededDose({ medication }: { medication: AsNeededMedication }) {
  const router = useRouter();
  const { state, now, actions } = useReadyApp();
  const child = state.children.find((k) => k.id === medication.childId);
  const start = new Date(now);
  const [date, setDate] = useState(toDateInput(start));
  const [time, setTime] = useState(toTimeInput(start));
  const [reason, setReason] = useState("");
  const [temperature, setTemperature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcher = useCallback(
    () => api<{ doses: AsNeededDose[] }>("GET", `/api/as-needed/${medication.id}/doses`).then((r) => r.doses),
    [medication.id],
  );
  const { data: recent, reload } = usePolled(fetcher, "Não foi possível carregar as últimas doses.");

  async function onSave() {
    setError(null);
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return setError("Escolha a data e a hora.");
    let temp: number | null = null;
    if (temperature.trim()) {
      temp = parseTemperatureInput(temperature);
      if (temp === null) return setError("Digite a temperatura como 37,8.");
    }
    setSaving(true);
    try {
      await actions.registerAsNeededDose(medication.id, {
        givenAt: new Date(y, m - 1, d, hh, mm).getTime(),
        reason: reason.trim(),
        temperature: temp,
      });
      router.push("/remedios");
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError && err.status !== 0 ? err.message : "Não deu para salvar. Confira a internet e tente de novo.");
    }
  }

  async function onDelete(dose: AsNeededDose) {
    if (!window.confirm(`Apagar a dose de ${whenText(dose.givenAt, now)}? Use só para um registro feito por engano.`)) return;
    try {
      await actions.deleteAsNeededDose(dose.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível apagar.");
    }
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Registrar dose" back="/remedios" />
      <div className="flex flex-col gap-5">
        <section className="card flex flex-col gap-2 p-4">
          <div className="flex items-center gap-3">
            {child && <Avatar fill={child.fill} photo={child.photoUrl} size={44} />}
            <div className="min-w-0">
              <p className="break-words text-lg font-extrabold leading-tight">{medication.name}</p>
              <p className="text-sm text-ink-soft">
                {child?.name} · {medication.doseText} · se necessário
              </p>
            </div>
          </div>
          {medication.instructions && (
            <p className="rounded-xl bg-brand-soft px-3 py-2 text-[15px] leading-snug">
              <b>Orientação da receita:</b> {medication.instructions}
            </p>
          )}
          <p className="text-sm text-ink-soft">
            {medication.lastGivenAt ? `Última dose registrada: ${whenText(medication.lastGivenAt, now)}.` : "Nenhuma dose registrada ainda."}
          </p>
        </section>

        <fieldset>
          <legend className="label">Quando foi dado?</legend>
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
          <label htmlFor="motivo" className="label">Motivo</label>
          <div className="mb-2.5 flex flex-wrap gap-2">
            {AS_NEEDED_REASONS.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => setReason(reason === r ? "" : r)}>
                {r}
              </button>
            ))}
          </div>
          <input
            id="motivo"
            className="field"
            maxLength={120}
            placeholder="Ou escreva o motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="temperatura" className="label">Temperatura no momento</label>
          <div className="flex items-center gap-2.5">
            <div className="field-wrap w-40">
              <ThermometerIcon />
              <input
                id="temperatura"
                className="field tabular-nums"
                inputMode="decimal"
                placeholder="Ex.: 38,2"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
            <span className="text-lg font-bold">°C</span>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl border border-line bg-coral p-3 text-base font-bold">
            {error}
          </p>
        )}

        <button onClick={onSave} disabled={saving} className="btn btn-primary h-[3.75rem] text-xl">
          {saving ? "Salvando…" : (
            <>
              <CheckIcon size={24} /> Registrar dose
            </>
          )}
        </button>

        {recent && recent.length > 0 && (
          <section aria-labelledby="ultimas" className="flex flex-col gap-2">
            <h2 id="ultimas" className="text-[15px] font-extrabold">Últimas doses</h2>
            <ul className="flex flex-col gap-2">
              {recent.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 text-[15px] leading-snug">
                    <span className="block font-extrabold">{whenText(d.givenAt, now)}</span>
                    <span className="block text-sm text-ink-soft">
                      {[d.reason, d.temperature !== undefined ? fmtTemperature(d.temperature) : ""].filter(Boolean).join(" · ") || "Sem motivo anotado"}
                    </span>
                  </span>
                  <button onClick={() => onDelete(d)} aria-label="Apagar este registro" className="btn btn-outline size-9 shrink-0 text-danger">
                    <TrashIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href="/remedios" className="self-center text-sm font-semibold text-ink-soft underline">
          Voltar para Remédios
        </Link>
      </div>
    </div>
  );
}
