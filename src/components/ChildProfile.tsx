"use client";

import { useState } from "react";
import { Avatar, InfoIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import {
  childAges,
  CORRECTED_AGE_UNTIL_MONTHS,
  formatAge,
  formatUntilTerm,
  MIN_GA_WEEKS,
  parseCivilDate,
  PRETERM_WEEKS_LIMIT,
  toIso,
  todayCivil,
} from "@/lib/age";
import { ApiError } from "@/lib/api";
import type { Child, ChildPatch } from "@/lib/types";

const WEEKS = Array.from({ length: PRETERM_WEEKS_LIMIT - MIN_GA_WEEKS }, (_, i) => MIN_GA_WEEKS + i);
const DAYS = [0, 1, 2, 3, 4, 5, 6];

const PREMATURE_OPTIONS = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
  { value: null, label: "Não sei" },
] as const;

/** Nascimento da criança (data, prematuridade, idade gestacional) e as idades calculadas. */
export function ChildBirthFields({ child, now }: { child: Child; now: number }) {
  const { state, actions } = useReadyApp();
  // Gêmeos: enquanto esta criança não tem data, oferece copiar o nascimento de um irmão que já tem.
  // É uma cópia: depois cada criança tem os seus dados e corrigir um não muda o outro.
  const twins = child.birthDate ? [] : state.children.filter((k) => k.id !== child.id && k.birthDate);
  const [error, setError] = useState<string | null>(null);
  const today = toIso(todayCivil(now));

  const save = async (patch: ChildPatch) => {
    setError(null);
    try {
      await actions.updateChild(child.id, patch);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    }
  };

  const ga = child.gestationalAge;

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      {twins.map((twin) => (
        <button
          key={twin.id}
          type="button"
          onClick={() =>
            save({
              birthDate: twin.birthDate ?? null,
              premature: twin.premature ?? null,
              gestationalAge: twin.premature === "yes" ? (twin.gestationalAge ?? null) : null,
            })
          }
          className="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-brand/50 bg-brand-soft p-3 text-left"
        >
          <Avatar fill={twin.fill} photo={twin.photoUrl} size={36} />
          <span className="flex-1 text-[15px] leading-snug">
            <span className="font-extrabold">
              {child.name} é gêmeo(a) de {twin.name}?
            </span>{" "}
            <span className="text-ink-soft">Toque para usar a mesma data de nascimento, prematuridade e idade gestacional.</span>
          </span>
        </button>
      ))}
      <div className="flex flex-col gap-1">
        <label htmlFor={`nasc-${child.id}`} className="text-sm font-semibold text-ink-soft">
          Data de nascimento
        </label>
        <input
          id={`nasc-${child.id}`}
          type="date"
          className="field"
          // A chave força o campo a mostrar o valor salvo depois de cada atualização vinda do servidor.
          key={child.birthDate ?? "vazio"}
          defaultValue={child.birthDate ?? ""}
          max={today}
          onBlur={(e) => {
            const value = e.target.value;
            if (value === (child.birthDate ?? "")) return;
            if (!value) save({ birthDate: null });
            else if (parseCivilDate(value)) save({ birthDate: value });
          }}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Nasceu prematuro (antes de 37 semanas)?</legend>
        <div className="flex flex-wrap gap-2">
          {PREMATURE_OPTIONS.map((o) => {
            const active = (child.premature ?? null) === o.value;
            return (
              <button
                key={o.label}
                type="button"
                className="chip"
                aria-pressed={active}
                onClick={() => !active && save({ premature: o.value })}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {child.premature === "yes" && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold text-ink-soft">Idade gestacional ao nascer (opcional)</legend>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor={`ga-w-${child.id}`}>Semanas</label>
            <select
              id={`ga-w-${child.id}`}
              className="field"
              value={ga?.weeks ?? ""}
              onChange={(e) => {
                const weeks = e.target.value ? Number(e.target.value) : null;
                save({ gestationalAge: weeks === null ? null : { weeks, days: ga?.days ?? 0 } });
              }}
            >
              <option value="">Não sei</option>
              {WEEKS.map((w) => (
                <option key={w} value={w}>
                  {w} semanas
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`ga-d-${child.id}`}>Dias</label>
            <select
              id={`ga-d-${child.id}`}
              className="field"
              value={ga?.days ?? 0}
              disabled={!ga}
              onChange={(e) => ga && save({ gestationalAge: { weeks: ga.weeks, days: Number(e.target.value) } })}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? "1 dia" : `${d} dias`}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-ink-soft">Está na caderneta ou no resumo de alta da maternidade.</p>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}

      <AgeSummary child={child} now={now} />
    </div>
  );
}

/** As idades da criança, ou o convite para informar a data de nascimento. */
export function AgeSummary({ child, now }: { child: Child; now: number }) {
  const birth = child.birthDate ? parseCivilDate(child.birthDate) : null;
  if (!birth) {
    return <p className="text-sm text-ink-soft">Com a data de nascimento, o app mostra a idade de {child.name}.</p>;
  }
  const premature = child.premature === "yes";
  const ages = childAges(birth, todayCivil(now), premature, child.gestationalAge);
  const pastCorrectedPeriod = premature && !!child.gestationalAge && ages.chronological.months >= CORRECTED_AGE_UNTIL_MONTHS;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-brand-soft p-3">
      <dl className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="text-sm font-semibold text-ink-soft">Idade</dt>
          <dd className="text-base font-extrabold">{formatAge(ages.chronological)}</dd>
        </div>
        {ages.corrected && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <dt className="text-sm font-semibold text-ink-soft">Idade corrigida</dt>
            <dd className="text-base font-extrabold">{formatAge(ages.corrected)}</dd>
          </div>
        )}
        {ages.daysUntilTerm !== undefined && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <dt className="text-sm font-semibold text-ink-soft">Idade corrigida</dt>
            <dd className="text-[15px] font-bold">
              começa em {formatUntilTerm(ages.daysUntilTerm)}
            </dd>
          </div>
        )}
      </dl>

      {premature && !child.gestationalAge && (
        <p className="text-sm text-ink-soft">Informe a idade gestacional ao nascer para ver também a idade corrigida.</p>
      )}

      {(ages.corrected || ages.daysUntilTerm !== undefined) && (
        <p className="flex gap-2 text-sm leading-snug text-ink-soft">
          <span className="mt-0.5 text-brand">
            <InfoIcon size={18} />
          </span>
          <span>
            A idade corrigida desconta as semanas que faltaram para completar 40 semanas de gestação. É uma referência
            para acompanhar quem nasceu prematuro: converse com o pediatra sobre como usá-la.
          </span>
        </p>
      )}

      {pastCorrectedPeriod && (
        <p className="text-sm text-ink-soft">Depois dos 2 anos, o app mostra só a idade pela data de nascimento.</p>
      )}
    </div>
  );
}
