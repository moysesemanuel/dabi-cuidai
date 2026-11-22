"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, BottleIcon, CalendarIcon, CheckIcon, ChevronIcon, ClockIcon, Mascot, PlusIcon, ThermometerIcon, UserIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { whenText } from "@/components/AsNeeded";
import { ChildFilter } from "@/components/ChildFilter";
import { ScreenHeader } from "@/components/ScreenHeader";
import type { Child, DoseEvent, Medication } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { fmtLongDate, fmtTime, greeting, relativeLabel, startOfDay } from "@/lib/format";

interface Row {
  dose: DoseEvent;
  /** Nome e dose como estavam quando a dose foi agendada. */
  med: Pick<Medication, "name" | "doseText">;
  child: Child;
}

/**
 * "Já dei" e "Desfazer" com confirmação do servidor: enquanto salva, o botão diz "Salvando…";
 * se não salvar, a dose continua como estava e aparece o aviso para tentar de novo.
 */
function useDoseAction(doseId: number) {
  const { actions } = useReadyApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (given: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await (given ? actions.markGiven(doseId) : actions.undoGiven(doseId));
    } catch (err) {
      const offline = !(err instanceof ApiError) || err.status === 0;
      setError(
        !offline
          ? (err as ApiError).message
          : given
            ? "Não deu para salvar. Confira a internet e toque de novo."
            : "Não deu para desfazer. Confira a internet e tente de novo.",
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** "Hoje às 10:00", "Ontem às 22:00" ou "Amanhã às 02:00". */
function dayTime(ms: number, dayStart: number): string {
  const day = ms < dayStart ? "Ontem" : ms >= dayStart + 86_400_000 ? "Amanhã" : "Hoje";
  return `${day} às ${fmtTime(ms)}`;
}

export function InicioScreen() {
  const { state, now } = useReadyApp();
  const [filter, setFilter] = useState<number | null>(null);
  const dayStart = startOfDay(now);

  const rows = useMemo(() => {
    const kidMap = new Map(state.children.map((k) => [k.id, k]));
    const list: Row[] = [];
    for (const dose of state.doses) {
      // Doses de antes da meia-noite só aparecem se ainda estiverem pendentes (atrasadas).
      if (dose.scheduledAt < dayStart && dose.status === "given") continue;
      // A criança e o remédio são os da dose: editar o remédio depois não troca a dose de criança na tela.
      const child = kidMap.get(dose.childId);
      if (child) list.push({ dose, med: { name: dose.medName, doseText: dose.doseText }, child });
    }
    return list.sort((a, b) => a.dose.scheduledAt - b.dose.scheduledAt);
  }, [state, dayStart]);

  const visible = rows.filter((r) => filter === null || r.child.id === filter);
  const pending = visible.filter((r) => r.dose.status === "pending");
  const given = visible.filter((r) => r.dose.status === "given");
  const next = pending[0];
  const later = pending.slice(1);
  const hasMeds = state.medications.length > 0 || state.asNeeded.length > 0;
  const prn = state.asNeeded.filter((m) => filter === null || m.childId === filter);

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
        <CompleteProfileInvite kids={state.children} />
        <Link href="/diario/novo" className="card flex items-center gap-3 p-3.5">
          <span className="icon-tile">
            <ThermometerIcon size={22} />
          </span>
          <span className="flex-1">
            <span className="block text-base font-extrabold">Registrar no diário</span>
            <span className="block text-sm text-ink-soft">Temperatura, sintomas ou uma anotação</span>
          </span>
          <ChevronIcon />
        </Link>
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
                <NextDose key={next.dose.id} row={next} now={now} dayStart={dayStart} />
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

            {prn.length > 0 && (
              <section aria-labelledby="se-necessario">
                <h2 id="se-necessario" className="mb-2.5 text-lg font-extrabold">Se necessário</h2>
                <ul className="flex flex-col gap-2.5">
                  {prn.map((m) => {
                    const child = state.children.find((k) => k.id === m.childId);
                    return (
                      <li key={m.id} className="card flex min-w-0 items-center gap-3 py-2.5 pl-3 pr-2.5">
                        {child && <Avatar fill={child.fill} photo={child.photoUrl} size={40} />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-extrabold">{m.name}</p>
                          <p className="truncate text-sm text-ink-soft">
                            {m.lastGivenAt ? `Última: ${whenText(m.lastGivenAt, now)}` : "Nenhuma dose registrada"}
                          </p>
                        </div>
                        <Link href={`/remedios/${m.id}/dose`} className="btn btn-outline h-10 shrink-0 px-3 text-sm">
                          Registrar
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <p className="text-center text-sm font-semibold text-ink-soft">
              {fmtLongDate(now).replace(/^./, (c) => c.toUpperCase())}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Convite para completar o perfil enquanto faltar a data de nascimento de alguma criança. */
function CompleteProfileInvite({ kids }: { kids: Child[] }) {
  const missing = kids.filter((k) => !k.birthDate);
  if (!missing.length) return null;
  const names = new Intl.ListFormat("pt-BR", { type: "conjunction" }).format(missing.map((k) => k.name));
  return (
    <Link href={`/perfil#crianca-${missing[0].id}`} className="card flex items-center gap-3 p-3.5 text-[15px] font-semibold">
      <span className="icon-tile">
        <CalendarIcon size={22} />
      </span>
      <span className="flex-1">
        Adicione a data de nascimento de {names} para ver a idade no Perfil.
      </span>
      <ChevronIcon />
    </Link>
  );
}

function StatusBadge({ scheduledAt, now }: { scheduledAt: number; now: number }) {
  const { text, late } = relativeLabel(scheduledAt, now);
  return late ? <span className="badge badge-late">{text[0].toUpperCase() + text.slice(1)}</span> : <span className="badge badge-pending">Pendente</span>;
}

function NextDose({ row, now, dayStart }: { row: Row; now: number; dayStart: number }) {
  const { dose, med, child } = row;
  const { busy, error, run } = useDoseAction(dose.id);
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
      <button onClick={() => run(true)} disabled={busy} aria-busy={busy} className="btn btn-primary h-[3.25rem] w-full text-lg">
        {busy ? "Salvando…" : <><CheckIcon /> Já dei</>}
      </button>
      {error && (
        <p role="alert" className="rounded-xl bg-coral px-3 py-2 text-sm font-bold">
          {error}
        </p>
      )}
    </div>
  );
}

function PendingRow({ row, now }: { row: Row; now: number }) {
  const { dose, med, child } = row;
  const { busy, error, run } = useDoseAction(dose.id);
  const { text, late } = relativeLabel(dose.scheduledAt, now);
  return (
    <li className="card flex min-w-0 flex-col gap-2 py-2.5 pl-3 pr-2.5">
      <div className="flex min-w-0 items-center gap-3">
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
          onClick={() => run(true)}
          disabled={busy}
          aria-busy={busy}
          aria-label={busy ? "Salvando" : `Marcar ${med.name} das ${fmtTime(dose.scheduledAt)} como dado`}
          className="btn size-10 shrink-0 rounded-full border-brand/30 bg-brand-soft"
        >
          {busy ? <span className="text-xs font-extrabold">…</span> : <CheckIcon size={18} />}
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-coral px-3 py-1.5 text-sm font-bold">
          {error}
        </p>
      )}
    </li>
  );
}

function GivenRow({ row }: { row: Row }) {
  const { dose, med, child } = row;
  const { busy, error, run } = useDoseAction(dose.id);
  return (
    <li className="card flex min-w-0 flex-col gap-2 bg-mint py-2.5 pl-3 pr-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar fill={child.fill} photo={child.photoUrl} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold">
            {child.name} <span className="font-semibold text-ink-soft">· {fmtTime(dose.scheduledAt)}</span>
          </p>
          <p className="truncate text-sm text-ink-soft">
            {med.name} · dado às {dose.givenAt ? fmtTime(dose.givenAt) : "—"}
          </p>
        </div>
        <button onClick={() => run(false)} disabled={busy} aria-busy={busy} className="btn h-9 shrink-0 bg-white px-3 text-[13px]">
          {busy ? "Salvando…" : "Desfazer"}
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold">
          {error}
        </p>
      )}
    </li>
  );
}
