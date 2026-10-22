import { SLEEP_END_MINUTE, SLEEP_START_MINUTE, formatClock, type OtherDose, type PreviewDose } from "@/lib/schedule";

const MAX_ROWS = 8;
const pct = (minute: number, half: number) => `calc(${((minute / 1440) * 100).toFixed(2)}% - ${half}px)`;

const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function Track({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mt-1.5 h-6 rounded-xl border-2 border-ink bg-[#EEF3F8]">
      {/* faixa de dormir: 20h–6h */}
      <div className="absolute left-0 top-0 h-5 rounded-l-[10px] bg-lilac" style={{ width: `${(SLEEP_END_MINUTE / 1440) * 100}%` }} />
      <div
        className="absolute right-0 top-0 h-5 rounded-r-[10px] bg-lilac"
        style={{ width: `${((1440 - SLEEP_START_MINUTE) / 1440) * 100}%` }}
      />
      {TICK_HOURS.slice(1, -1).map((h) => (
        <div key={h} className="absolute top-0 h-5 w-px bg-ink/20" style={{ left: `${(h / 24) * 100}%` }} />
      ))}
      {children}
    </div>
  );
}

/** Régua com os números das horas, alinhada às faixas da timeline. */
function HourRuler() {
  return (
    <div className="relative mt-1 h-4 text-[12px] font-semibold tabular-nums text-ink-soft" aria-hidden="true">
      {TICK_HOURS.map((h) => (
        <span
          key={h}
          className="absolute top-0"
          style={{
            left: `${(h / 24) * 100}%`,
            transform: h === 0 ? "none" : h === 24 ? "translateX(-100%)" : "translateX(-50%)",
          }}
        >
          {h}h
        </span>
      ))}
    </div>
  );
}

/** Versão compacta para a lista de remédios: só as doses do dia e a régua de horas. */
export function DayTimeline({ doses }: { doses: PreviewDose[] }) {
  return (
    <div>
      <Track>
        {doses.map((d, i) => (
          <div
            key={i}
            className="absolute top-0 size-5 rounded-full border-[2.5px] border-ink"
            style={{ left: pct(d.minuteOfDay, 10), background: d.night ? "#D9D2FF" : "#7BE0B5" }}
          />
        ))}
      </Track>
      <HourRuler />
      <p className="mt-1 text-[13px] text-ink-soft">
        {doses.map((d) => formatClock(d.minuteOfDay)).join(" · ")}
      </p>
    </div>
  );
}

export function TimelinePreview({
  doses,
  others,
  firstDayLabel = "Hoje",
}: {
  doses: PreviewDose[];
  others: OtherDose[];
  /** Como chamar o dia da primeira dose ("Hoje", "Amanhã", "1º dia"). */
  firstDayLabel?: string;
}) {
  const dayLabel = (offset: number) =>
    offset === 0 ? firstDayLabel : offset === 1 ? (firstDayLabel === "Hoje" ? "Amanhã" : "Dia seguinte") : "Depois";
  const shown = doses.slice(0, MAX_ROWS);
  const extra = doses.length - shown.length;

  return (
    <div>
      <p className="mt-4 text-[13px] font-semibold tracking-wide text-ink-soft">ESTE REMÉDIO</p>
      <Track>
        {doses.map((d, i) => (
          <div
            key={i}
            className="absolute top-0 size-5 rounded-full border-[2.5px] border-ink"
            style={{ left: pct(d.minuteOfDay, 10), background: d.night ? "#D9D2FF" : "#7BE0B5" }}
          />
        ))}
      </Track>

      <p className="mt-3.5 text-[13px] font-semibold tracking-wide text-ink-soft">
        JÁ CADASTRADOS
      </p>
      <Track>
        {others.map((o, i) => (
          <div
            key={i}
            className="absolute top-[3px] size-3.5 rounded-full border-2 border-ink bg-[#8FD0FF]"
            style={{ left: pct(o.minuteOfDay, 7) }}
          />
        ))}
      </Track>

      <HourRuler />
      <p className="mt-1 text-[13px] text-ink-soft">Faixa roxa = hora de dormir (20h às 6h)</p>

      <ul className="mt-3.5">
        {shown.map((d, i) => {
          const ok = !d.night && !d.conflictWith;
          return (
            <li key={i} className="flex items-center gap-3 border-t-2 border-dashed border-[#C9D6E6] py-2.5">
              <div className="w-[4.75rem] shrink-0 rounded-2xl border-[2.5px] border-ink bg-cream py-1 text-center">
                <div className="text-[1.3rem] font-bold leading-tight tabular-nums">
                  {formatClock(d.minuteOfDay)}
                </div>
                <div className="text-xs text-ink-soft">
                  {dayLabel(d.dayOffset)}
                </div>
              </div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {d.night && <span className="pill bg-lilac px-2.5 py-0.5 text-[13px] font-semibold">Hora de dormir</span>}
                {d.conflictWith && (
                  <span className="pill bg-blush px-2.5 py-0.5 text-[13px] font-semibold">
                    Junto com {d.conflictWith}
                  </span>
                )}
                {ok && <span className="pill bg-pale px-2.5 py-0.5 text-[13px] font-semibold">Horário tranquilo</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {extra > 0 && (
        <p className="border-t-2 border-dashed border-[#C9D6E6] py-2 text-sm font-semibold text-ink-soft">
          + {extra} doses ao longo do dia
        </p>
      )}
    </div>
  );
}
